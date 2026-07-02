import type { EntitlementKey } from '@/lib/entitlements'
import type { createClient } from '@/lib/supabase/server'

// ============================================================
// Onboarding "Misi Pertama" — step catalogue (SSOT). Ported from ja-stock-platform
// (ONBOARDING_PLAYBOOK.md), specialised for the pharmacy domain.
// Two tracks by role: owner (owner/superadmin) = business-setup checklist, all
// derived from real data so it can never lie; operator (admin/apoteker/kasir) = a
// lighter "learn the ropes" list marked manually as the user visits each area.
// Steps are further filtered by tenant entitlements at read time (see state.ts).
// ============================================================

type SB = Awaited<ReturnType<typeof createClient>>

export type OnboardingTrack = 'owner' | 'operator'

export interface StepDef {
  key: string
  title: string
  desc: string
  ctaLabel: string
  href: string
  /** Only show this step when the tenant holds this entitlement (omit = always). */
  feature?: EntitlementKey
  /**
   * Derived completion check against real data (tenant-level). When present the step
   * is auto-ticked and cannot be marked manually. When absent the step is "manual" and
   * its completion is persisted per-user in user_onboarding.completed_steps.
   */
  resolver?: (sb: SB, tenantId: string) => Promise<boolean>
}

// ---- derived resolvers (real data, tenant-scoped; RLS also filters) ----

async function hasMedicines(sb: SB, tenantId: string): Promise<boolean> {
  const { count } = await sb
    .from('medicines')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
  return (count ?? 0) > 0
}

async function hasStock(sb: SB, tenantId: string): Promise<boolean> {
  const { count } = await sb
    .from('medicine_batches')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  return (count ?? 0) > 0
}

async function hasWhatsApp(sb: SB, tenantId: string): Promise<boolean> {
  const { data } = await sb
    .from('tenant_configs')
    .select('wa_token, wa_sender')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return !!data?.wa_token || !!data?.wa_sender
}

async function hasFirstSale(sb: SB, tenantId: string): Promise<boolean> {
  const { count } = await sb
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'COMPLETED')
  return (count ?? 0) > 0
}

async function hasTeamMember(sb: SB, tenantId: string): Promise<boolean> {
  const { count } = await sb
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
  return (count ?? 0) > 1
}

// ---- step catalogues per track ----

const OWNER_STEPS: StepDef[] = [
  {
    key: 'add_medicine',
    title: 'Tambah obat pertama',
    desc: 'Isi master obat dengan minimal satu item agar apotek siap melayani.',
    ctaLabel: 'Tambah obat',
    href: '/medicines',
    feature: 'medicines',
    resolver: hasMedicines,
  },
  {
    key: 'stock_in',
    title: 'Input stok masuk pertama',
    desc: 'Catat batch stok (jumlah + kedaluwarsa) supaya kasir bisa menjual.',
    ctaLabel: 'Input stok',
    href: '/inventory',
    feature: 'inventory',
    resolver: hasStock,
  },
  {
    key: 'invite_team',
    title: 'Undang anggota tim',
    desc: 'Tambahkan apoteker atau kasir agar mereka bisa bantu operasional.',
    ctaLabel: 'Kelola pengguna',
    href: '/users',
    resolver: hasTeamMember,
  },
  {
    key: 'connect_wa',
    title: 'Hubungkan WhatsApp',
    desc: 'Sambungkan WhatsApp untuk notifikasi otomatis ke pelanggan.',
    ctaLabel: 'Buka pengaturan',
    href: '/settings',
    feature: 'wa_notif',
    resolver: hasWhatsApp,
  },
  {
    key: 'first_sale',
    title: 'Catat penjualan pertama',
    desc: 'Selesaikan satu transaksi di kasir untuk menuntaskan penyiapan.',
    ctaLabel: 'Buka kasir',
    href: '/pos',
    feature: 'pos',
    resolver: hasFirstSale,
  },
]

const OPERATOR_STEPS: StepDef[] = [
  {
    key: 'visit_pos',
    title: 'Buka kasir',
    desc: 'Kenali layar kasir — scan barcode, keranjang, dan pembayaran.',
    ctaLabel: 'Buka kasir',
    href: '/pos',
    feature: 'pos',
  },
  {
    key: 'visit_inventory',
    title: 'Cek stok & batch',
    desc: 'Pantau ketersediaan stok dan tanggal kedaluwarsa tiap batch.',
    ctaLabel: 'Buka inventori',
    href: '/inventory',
    feature: 'inventory',
  },
  {
    key: 'visit_expiry',
    title: 'Pantau kedaluwarsa',
    desc: 'Lihat obat yang mendekati kedaluwarsa supaya tidak terjual.',
    ctaLabel: 'Buka monitoring',
    href: '/expiry',
    feature: 'expiry_monitoring',
  },
]

export const STEPS_BY_TRACK: Record<OnboardingTrack, StepDef[]> = {
  owner: OWNER_STEPS,
  operator: OPERATOR_STEPS,
}

/** Map a portal role to an onboarding track. owner/superadmin = owner; rest = operator. */
export function trackForRole(role: string): OnboardingTrack {
  return role === 'owner' || role === 'superadmin' ? 'owner' : 'operator'
}
