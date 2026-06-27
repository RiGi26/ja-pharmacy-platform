// ============================================================
// src/lib/entitlements.ts — fine-grained per-tier feature contract for the
// pharmacy (Apotek) portal.
//
// Source of truth for the SHAPE of features. The actual tier a tenant holds is
// mirrored from the superadmin Core DB into `tenant_entitlements` (see
// lib/tenant-entitlements.ts). This file just defines which features each tier
// grants, plus seat limits and helpers. Server-only-safe (no client imports).
//
// Owner-approved matrix (TIER_MATRIX_PROPOSAL — "Portal Farmasi (POS)"):
//   Starter : POS/kasir (+barcode), master obat, inventory & terima stok,
//             shift kasir + rekap                                      · 1 user
//   Growth  : + stok opname, monitoring expiry + retur/musnah,
//             laporan & analitik (ekspor Excel/PDF), notifikasi WA     · 3 user
//   Pro     : + integrasi resep klinik (webhook), mode offline (PWA),
//             cetak struk hardware (QZ Tray)                           · ∞ user
//   Trial = akses penuh setara Pro. Tier kumulatif.
// ============================================================

export type EntitlementKey =
  // ── Starter (baseline, always granted) ──
  | 'pos'                // POS / kasir (+ barcode)
  | 'medicines'          // master obat
  | 'inventory'          // inventory & terima stok
  | 'shift'              // shift kasir + rekap
  // ── Growth ──
  | 'stock_opname'       // stok opname
  | 'expiry_monitoring'  // monitoring kedaluwarsa
  | 'disposals'          // retur & musnah
  | 'reports'            // laporan & analitik (+ ekspor Excel/PDF)
  | 'wa_notif'           // notifikasi WhatsApp
  // ── Pro ──
  | 'prescription'       // integrasi resep klinik (webhook + antrian)
  | 'offline_mode'       // mode offline (PWA) + sinkron
  | 'hardware_print'     // cetak struk hardware (QZ Tray)

export type PlanTier = 'starter' | 'growth' | 'pro'

const STARTER: EntitlementKey[] = ['pos', 'medicines', 'inventory', 'shift']
const GROWTH: EntitlementKey[] = ['stock_opname', 'expiry_monitoring', 'disposals', 'reports', 'wa_notif']
const PRO: EntitlementKey[] = ['prescription', 'offline_mode', 'hardware_print']

/** Cumulative feature set per tier (each tier includes the lower tiers'). */
export const TIER_FEATURES: Record<PlanTier, EntitlementKey[]> = {
  starter: STARTER,
  growth: [...STARTER, ...GROWTH],
  pro: [...STARTER, ...GROWTH, ...PRO],
}

/** Every key — granted to tenants without an entitlement row (legacy/full access). */
export const ALL_FEATURES: EntitlementKey[] = [...STARTER, ...GROWTH, ...PRO]

/** Active staff/kasir quota per tier (null = unlimited). */
export const TIER_SEATS: Record<PlanTier, number | null> = {
  starter: 1,
  growth: 3,
  pro: null,
}

export const DEFAULT_TIER: PlanTier = 'starter'

export function isPlanTier(tier: string | null | undefined): tier is PlanTier {
  return tier === 'starter' || tier === 'growth' || tier === 'pro'
}

export function tierFeatures(tier: string | null | undefined): EntitlementKey[] {
  return isPlanTier(tier) ? TIER_FEATURES[tier] : TIER_FEATURES[DEFAULT_TIER]
}

export function tierSeatLimit(tier: string | null | undefined): number | null {
  return isPlanTier(tier) ? TIER_SEATS[tier] : TIER_SEATS[DEFAULT_TIER]
}

// ────────────────────────────────────────────────────────────
// Core → pharmacy tier map. Core's superadmin plans use a different vocabulary
// (starter/pro/enterprise) than the pharmacy portal display (Starter/Growth/Pro).
//   Core starter     → pharmacy starter (display "Starter")
//   Core pro         → pharmacy growth  (display "Growth")
//   Core enterprise  → pharmacy pro     (display "Pro")
// ────────────────────────────────────────────────────────────
export function coreTierToPharmacy(coreTier: string | null | undefined): PlanTier {
  switch (coreTier) {
    case 'pro':
      return 'growth'
    case 'enterprise':
      return 'pro'
    case 'starter':
    default:
      return 'starter'
  }
}

// ────────────────────────────────────────────────────────────
// Subscription status — "good standing" lets a tenant use the features its tier
// grants. 'legacy' = tenants without a tenant_entitlements row (never synced) →
// always allowed. Anything not in this set (past_due/suspended/cancelled/expired)
// revokes gated features even if the entitlements array still lists them.
// ────────────────────────────────────────────────────────────
export const ACTIVE_STATUSES = new Set(['active', 'trialing', 'trial', 'legacy'])

export function isSubscriptionActive(status: string | null | undefined): boolean {
  return ACTIVE_STATUSES.has(status ?? 'legacy')
}

/** Human label per key (upsell banner, errors). */
export const FEATURE_LABEL: Record<EntitlementKey, string> = {
  pos:               'Kasir (POS)',
  medicines:         'Master Obat',
  inventory:         'Inventori & Terima Stok',
  shift:             'Shift Kasir',
  stock_opname:      'Stok Opname',
  expiry_monitoring: 'Monitoring Kedaluwarsa',
  disposals:         'Retur & Musnah',
  reports:           'Laporan & Analitik',
  wa_notif:          'Notifikasi WhatsApp',
  prescription:      'Integrasi Resep Klinik',
  offline_mode:      'Mode Offline (PWA)',
  hardware_print:    'Cetak Struk Hardware',
}
