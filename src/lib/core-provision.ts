// ============================================================
// lib/core-provision.ts — register a pharmacy tenant in the superadmin Core DB.
//
// Pharmacy tenants live in this portal's own Supabase, but billing/subscriptions
// live in Core (SoR). On self-service signup we call Core to create a matching
// `tenants` row (platform='pharmacy'). Pharmacy uses the SAME-ID model (Core tenant
// id == this portal's tenant id) to match its existing Core-side sync
// (pharmacy-sync sends tenant_id; /api/billing/sync resolves by id), so we pass our
// own tenant id to the provision endpoint. Signed with BILLING_SYNC_SECRET
// (HMAC-SHA256 over `${ts}\n${nonce}\n${body}`). Server-only.
// ============================================================
import crypto from 'crypto'
import { superadminBaseUrl } from '@/lib/billing-link'

export type ProvisionArgs = {
  tenantId: string // this portal's tenants.id — sent as the Core tenant id (same-id)
  slug: string
  name: string
  email: string
  phone?: string | null
}

export type ProvisionResult =
  | { ok: true; coreTenantId: string }
  | { ok: false; error: string }

/**
 * Call Core `POST /api/tenants/provision` (same-id: we pass tenant_id). Returns the
 * Core tenant id (== tenantId). Non-fatal for signup — the pharmacy can still use
 * the trial; a reconcile backfills the Core row later.
 */
export async function provisionCoreTenant(args: ProvisionArgs): Promise<ProvisionResult> {
  const secret = process.env.BILLING_SYNC_SECRET
  if (!secret) return { ok: false, error: 'BILLING_SYNC_SECRET belum di-set.' }

  const body = JSON.stringify({
    tenant_id: args.tenantId,
    slug: args.slug,
    name: args.name,
    email: args.email,
    phone: args.phone ?? null,
    platform: 'pharmacy',
    linked_tenant_id: args.tenantId, // == tenant_id for the same-id model
  })

  const ts = String(Date.now())
  const nonce = crypto.randomBytes(16).toString('hex')
  const sig = crypto.createHmac('sha256', secret).update(`${ts}\n${nonce}\n${body}`).digest('hex')

  try {
    const res = await fetch(`${superadminBaseUrl()}/api/tenants/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ja-timestamp': ts,
        'x-ja-nonce': nonce,
        'x-ja-signature': sig,
      },
      body,
      signal: AbortSignal.timeout(8000),
    })
    const data = (await res.json().catch(() => ({}))) as { core_tenant_id?: string; error?: string }
    if (!res.ok || !data.core_tenant_id) {
      return { ok: false, error: data.error || `provision_failed_${res.status}` }
    }
    return { ok: true, coreTenantId: data.core_tenant_id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'provision_error' }
  }
}
