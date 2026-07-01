import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { signBillingToken, superadminBaseUrl, appOrigin } from '@/lib/billing-link'

// ============================================================
// GET /api/billing/checkout?tier=pro&period=monthly — direct subscribe.
//
// Unlike /api/billing/upgrade (which sends the tenant to the superadmin plan
// PICKER), this mints the checkout token AND kicks off Core checkout-self for a
// PRESELECTED tier, then 302s the tenant straight to Midtrans Snap — no picker
// detour. Used by the register flow when a buyer picked a paid plan on the pricing
// page (intent=subscribe&tier=<coreTier>).
//
// `tier` = Core enum (starter|pro|enterprise) as the pricing page emits it
// (Growth→pro, Pro→enterprise); 'growth' accepted as a friendly alias for pro.
// Owner-only; tenant id is read server-side from the session, never client input.
// Mirrors ja-clinic-platform / ja-stock-platform billing/checkout.
// ============================================================
export const dynamic = 'force-dynamic'

/** Normalize an incoming tier param to the Core enum, or null when invalid. */
function toCoreTier(raw: string | null): 'starter' | 'pro' | 'enterprise' | null {
  switch ((raw || '').toLowerCase().trim()) {
    case 'starter':
      return 'starter'
    case 'pro':
    case 'growth': // pharmacy-vocab alias for Core 'pro'
      return 'pro'
    case 'enterprise':
      return 'enterprise'
    default:
      return null
  }
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile()

  const billingUrl = new URL('/billing', appOrigin())

  if (!profile) return NextResponse.redirect(new URL('/login', appOrigin()))
  if (profile.role !== 'owner' && profile.role !== 'superadmin') {
    billingUrl.searchParams.set('error', 'forbidden')
    return NextResponse.redirect(billingUrl)
  }

  const db = await createAdminClient()

  // Demo tenants can't subscribe (shared, reset nightly).
  const { data: tenant } = await db
    .from('tenants')
    .select('slug')
    .eq('id', profile.tenant_id)
    .maybeSingle()
  if (tenant?.slug === 'demo') {
    billingUrl.searchParams.set('error', 'demo')
    return NextResponse.redirect(billingUrl)
  }

  const params = new URL(request.url).searchParams
  const tier = toCoreTier(params.get('tier'))
  if (!tier) {
    billingUrl.searchParams.set('error', 'invalid_tier')
    return NextResponse.redirect(billingUrl)
  }
  const period = params.get('period') === 'yearly' ? 'yearly' : 'monthly'

  // Resolve the Core tenant id (synced into the local entitlement cache at signup).
  const { data: ent } = await db
    .from('tenant_entitlements')
    .select('linked_tenant_id')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()

  const coreTenantId = ent?.linked_tenant_id as string | null | undefined
  if (!coreTenantId) {
    billingUrl.searchParams.set('error', 'not_provisioned')
    return NextResponse.redirect(billingUrl)
  }

  let token: string
  try {
    token = signBillingToken(coreTenantId)
  } catch (err) {
    console.error('[billing/checkout] mint token failed:', err instanceof Error ? err.message : err)
    billingUrl.searchParams.set('error', 'billing_link_unavailable')
    return NextResponse.redirect(billingUrl)
  }

  // Kick off Core checkout-self for the preselected tier → Snap redirect_url.
  try {
    const res = await fetch(`${superadminBaseUrl()}/api/billing/checkout-self`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, tier, period }),
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as {
      kind?: string
      redirect_url?: string
      error?: string
    }

    if (!res.ok) {
      console.error('[billing/checkout] core checkout-self failed:', res.status, data?.error)
      billingUrl.searchParams.set('error', 'checkout_failed')
      return NextResponse.redirect(billingUrl)
    }

    // Fresh trial tenant has no active period → renew path → paid checkout w/ Snap link.
    if (data.kind === 'checkout' && data.redirect_url) {
      return NextResponse.redirect(data.redirect_url)
    }

    // Defensive: 'applied'/'scheduled' shouldn't occur for a brand-new trial tenant.
    billingUrl.searchParams.set('status', data.kind || 'unknown')
    return NextResponse.redirect(billingUrl)
  } catch (err) {
    console.error('[billing/checkout] core call error:', err instanceof Error ? err.message : err)
    billingUrl.searchParams.set('error', 'checkout_failed')
    return NextResponse.redirect(billingUrl)
  }
}
