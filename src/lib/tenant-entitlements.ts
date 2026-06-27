// ============================================================
// src/lib/tenant-entitlements.ts — server-side tier gating for the pharmacy portal.
//
// Resolves a tenant's entitlement row (mirrored from Core into tenant_entitlements)
// and exposes a page guard + an API/action guard + a kasir-seat guard.
//
// A tenant WITHOUT a row falls back to ALL_FEATURES with status 'legacy' → keeps
// its exact current access (behaviour-preserving). Only synced tenants get gated.
// ============================================================
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  ALL_FEATURES,
  FEATURE_LABEL,
  isSubscriptionActive,
  tierSeatLimit,
  type EntitlementKey,
} from '@/lib/entitlements'

export type TenantEntitlements = {
  tier: string | null
  entitlements: EntitlementKey[]
  /** Active staff/kasir quota; null = unlimited. */
  maxActiveUsers: number | null
  /** active | trialing | trial | past_due | suspended | cancelled | expired | legacy */
  status: string
}

const LEGACY: TenantEntitlements = {
  tier: null,
  entitlements: ALL_FEATURES,
  maxActiveUsers: null,
  status: 'legacy',
}

/**
 * Resolve a tenant's entitlement cache. Wrapped in React cache() so the layout
 * (nav) and the page guard share one DB round-trip per request. Reads via the
 * service-role client (bypasses RLS) — same pattern as the rest of the app.
 */
export const getTenantEntitlements = cache(async (tenantId: string): Promise<TenantEntitlements> => {
  if (!tenantId) return LEGACY
  const db = await createAdminClient()
  const { data } = await db
    .from('tenant_entitlements')
    .select('tier, entitlements, max_active_users, status')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) return LEGACY

  return {
    tier: (data.tier as string) ?? null,
    entitlements: (data.entitlements as EntitlementKey[]) ?? [],
    maxActiveUsers: (data.max_active_users as number | null) ?? null,
    status: (data.status as string) ?? 'active',
  }
})

/** Pure check: does this resolved tenant hold the given feature (and is it in good standing)? */
export function hasEntitlement(ent: TenantEntitlements, key: EntitlementKey): boolean {
  return isSubscriptionActive(ent.status) && ent.entitlements.includes(key)
}

/**
 * Page guard for a (dashboard) server component. Call AFTER you already have the
 * tenant id (pages fetch their profile anyway — avoids a second auth round-trip).
 * Redirects to `${redirectTo}?upsell=<key>` (or `?billing=<status>`) when the
 * feature/standing is missing. Returns the resolved entitlements for reuse.
 *
 *   await assertEntitled(profile.tenant_id, 'stock_opname')
 */
export async function assertEntitled(
  tenantId: string,
  key: EntitlementKey,
  redirectTo = '/dashboard',
): Promise<TenantEntitlements> {
  const ent = await getTenantEntitlements(tenantId)
  if (!isSubscriptionActive(ent.status)) {
    redirect(`${redirectTo}?billing=${ent.status}`)
  }
  if (!ent.entitlements.includes(key)) {
    redirect(`${redirectTo}?upsell=${key}`)
  }
  return ent
}

/**
 * Action/route guard. Returns a ready 403 NextResponse when the tenant lacks the
 * feature (or the subscription is not in good standing), otherwise null — so a route
 * handler can do:  const g = await guardEntitlementApi(tenantId, 'wa_notif'); if (g) return g
 *
 * Defence-in-depth behind the page-level assertEntitled(): a direct API call that
 * skips the gated page is blocked too.
 */
export async function guardEntitlementApi(
  tenantId: string,
  key: EntitlementKey,
): Promise<NextResponse | null> {
  const ent = await getTenantEntitlements(tenantId)
  if (!isSubscriptionActive(ent.status)) {
    return NextResponse.json(
      { error: 'Langganan Anda sedang tidak aktif. Perbarui pembayaran untuk melanjutkan.', billing: ent.status },
      { status: 403 },
    )
  }
  if (!ent.entitlements.includes(key)) {
    return NextResponse.json(
      {
        error: `Fitur "${FEATURE_LABEL[key] ?? key}" tidak tersedia di paket langganan Anda. Silakan tingkatkan paket.`,
        upsell: key,
      },
      { status: 403 },
    )
  }
  return null
}

const SUSPENDED_RESPONSE = (status: string) =>
  NextResponse.json(
    { error: 'Langganan Anda sedang tidak aktif. Perbarui pembayaran untuk melanjutkan.', billing: status },
    { status: 403 },
  )

/**
 * Block inviting a new staff account once the tenant's seat quota (TIER_SEATS) is
 * hit. Returns a ready 403 or null. Legacy tenants (no entitlement row) and Pro
 * (null limit) are unlimited — behaviour-preserving. Uses the synced
 * max_active_users when present, else the tier default. Counts active user_profiles.
 */
export async function guardKasirSeat(tenantId: string): Promise<NextResponse | null> {
  const ent = await getTenantEntitlements(tenantId)
  if (!isSubscriptionActive(ent.status)) return SUSPENDED_RESPONSE(ent.status)
  if (ent.status === 'legacy') return null // never billed here → unlimited

  const limit = ent.maxActiveUsers ?? tierSeatLimit(ent.tier)
  if (limit == null) return null // Pro / unlimited

  const db = await createAdminClient()
  const { count } = await db
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      {
        error: `Kuota pengguna paket Anda (${limit}) sudah penuh. Tingkatkan paket untuk menambah staf/kasir.`,
        upsell: 'pos',
      },
      { status: 403 },
    )
  }
  return null
}
