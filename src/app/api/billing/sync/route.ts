import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { verifySignedRequest, SIG_HEADERS } from '@/lib/portal/sign'
import { tierFeatures, type EntitlementKey, type PlanTier } from '@/lib/entitlements'

// ============================================================
// PHARMACY PLATFORM — POST /api/billing/sync. Receives a tenant's subscription/
// entitlement state from the superadmin Core DB (SoR) and mirrors it into
// tenant_entitlements (the local read cache that assertEntitled()/
// getTenantEntitlements() consult).
//
// Core calls this fire-and-forget (after()) on subscription change; the reconcile
// cron is the safety net. Auth = HMAC-SHA256 over the raw body (shared scheme,
// BILLING_SYNC_SECRET). Writes via service-role (bypasses RLS by design).
//
// Body: {
//   tenant_id?:        string,   // pharmacy tenants.id (Core mirrors the SAME id) — preferred
//   tenant_slug?:      string,   // fallback lookup if tenant_id absent
//   linked_tenant_id?: string,   // stored for parity (== tenant_id for pharmacy)
//   plan_tier:         'starter'|'growth'|'pro',
//   entitlements?:     string[], // explicit keys; derived from tier when omitted
//   max_active_users?: number|null, // null = unlimited (staff/kasir quota)
//   status?:           string,   // active | past_due | suspended | cancelled | expired
//   expires_at?:       string|null,
//   event?:            string    // audit label, optional
// }
// At least one of tenant_id / tenant_slug is required.
// ============================================================
export const dynamic = 'force-dynamic'

const VALID_TIERS: PlanTier[] = ['starter', 'growth', 'pro']
const KNOWN_KEYS = new Set<EntitlementKey>([
  'pos', 'medicines', 'inventory', 'shift',
  'stock_opname', 'expiry_monitoring', 'disposals', 'reports', 'wa_notif',
  'prescription', 'offline_mode', 'hardware_print',
])

export async function POST(request: Request) {
  const rl = rateLimit(`billing:sync:${clientIp(request)}`, 30, 60_000)
  if (!rl.allowed) return tooManyRequests(rl.retryAfter)

  const rawBody = await request.text()
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) {
    console.error('[billing/sync] BILLING_SYNC_SECRET belum di-set')
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  // 1. Verify HMAC over the raw body (sig + 5-min skew).
  const verify = verifySignedRequest({
    secret,
    timestamp: request.headers.get(SIG_HEADERS.timestamp),
    nonce: request.headers.get(SIG_HEADERS.nonce),
    signature: request.headers.get(SIG_HEADERS.signature),
    rawBody,
  })
  if (!verify.ok) {
    return NextResponse.json({ ok: false, error: verify.reason }, { status: 401 })
  }

  // 2. Parse + validate.
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : ''
  const tenantSlug = typeof body.tenant_slug === 'string' ? body.tenant_slug.trim() : ''
  const tier = body.plan_tier as string
  if (!tenantId && !tenantSlug) {
    return NextResponse.json({ ok: false, error: 'missing_tenant_ref' }, { status: 400 })
  }
  if (!VALID_TIERS.includes(tier as PlanTier)) {
    return NextResponse.json({ ok: false, error: 'invalid_plan_tier' }, { status: 400 })
  }

  // Explicit entitlements win (filtered to known keys); otherwise derive from tier.
  const entitlements: EntitlementKey[] = Array.isArray(body.entitlements)
    ? (body.entitlements as unknown[]).filter((k): k is EntitlementKey => KNOWN_KEYS.has(k as EntitlementKey))
    : tierFeatures(tier)

  const rawMax = body.max_active_users
  const maxActiveUsers =
    rawMax === null || rawMax === undefined ? null : Number(rawMax)
  const status = typeof body.status === 'string' ? body.status : 'active'
  const expiresAt = typeof body.expires_at === 'string' ? body.expires_at : null
  const linkedTenantId = typeof body.linked_tenant_id === 'string' ? body.linked_tenant_id : tenantId || null

  // 3. Resolve the local tenant (by id first — Core mirrors with the same id).
  const db = await createAdminClient()
  const lookup = tenantId
    ? db.from('tenants').select('id').eq('id', tenantId).maybeSingle()
    : db.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle()
  const { data: tenant } = await lookup
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'tenant_not_found' }, { status: 404 })
  }

  // 4. Upsert the entitlement cache (idempotent on tenant_id PK).
  const nowIso = new Date().toISOString()
  const { error: upErr } = await db
    .from('tenant_entitlements')
    .upsert(
      {
        tenant_id: tenant.id,
        tier,
        entitlements,
        max_active_users: Number.isFinite(maxActiveUsers as number) ? maxActiveUsers : null,
        status,
        linked_tenant_id: linkedTenantId,
        synced_at: nowIso,
        expires_at: expiresAt,
      },
      { onConflict: 'tenant_id' },
    )

  if (upErr) {
    console.error('[billing/sync] upsert failed:', upErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, tenant_id: tenant.id, tier, entitlements })
}
