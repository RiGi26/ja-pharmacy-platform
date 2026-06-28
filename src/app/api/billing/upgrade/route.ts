import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { signBillingToken, superadminBaseUrl, appOrigin } from '@/lib/billing-link'

// ============================================================
// GET /api/billing/upgrade — mint a checkout token for the logged-in tenant and
// redirect to the superadmin payment page (mint side of the cross-DB billing link).
//
// The token carries the tenant's *Core* id (tenant_entitlements.linked_tenant_id,
// set when Core provisioned this tenant). Owner-only; tenant id is read server-side
// from the session, never from client input.
// ============================================================
export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.redirect(new URL('/login', appOrigin()))

  if (profile.role !== 'owner' && profile.role !== 'superadmin') {
    return NextResponse.redirect(new URL('/billing?error=forbidden', appOrigin()))
  }

  const db = await createAdminClient()

  // Demo tenants can't subscribe (shared, reset nightly).
  const { data: tenant } = await db
    .from('tenants')
    .select('slug')
    .eq('id', profile.tenant_id)
    .maybeSingle()
  if (tenant?.slug === 'demo') {
    return NextResponse.redirect(new URL('/billing?error=demo', appOrigin()))
  }

  // Resolve the Core tenant id (synced into the local entitlement cache).
  const { data: ent } = await db
    .from('tenant_entitlements')
    .select('linked_tenant_id')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()

  const coreTenantId = ent?.linked_tenant_id as string | null | undefined
  if (!coreTenantId) {
    return NextResponse.redirect(new URL('/billing?error=not_provisioned', appOrigin()))
  }

  let token: string
  try {
    token = signBillingToken(coreTenantId)
  } catch (err) {
    console.error('[billing/upgrade] mint token failed:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(new URL('/billing?error=billing_link_unavailable', appOrigin()))
  }

  const dest = new URL('/billing/langganan', superadminBaseUrl())
  dest.searchParams.set('token', token)
  return NextResponse.redirect(dest)
}
