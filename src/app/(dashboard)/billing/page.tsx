import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import { getTenantEntitlements } from '@/lib/tenant-entitlements'
import { superadminBaseUrl } from '@/lib/billing-link'

// ============================================================
// /billing — subscription page. Shows the tenant's current plan/status and the
// Pharmacy plans, with a single CTA that mints a checkout token
// (/api/billing/upgrade) and hands off to the superadmin payment page.
// Core DB is SoR; prices come from its public /api/public/plans feed.
//
// UI follows the canonical portal billing standard (see /wire-self-billing SOP):
// Apple blue accent, rounded-[20px] cards, pill CTAs. Status-semantic colors
// (trial=amber, active=green, expired/past_due=red) are kept on purpose.
// ============================================================
export const dynamic = 'force-dynamic'

type PublicPlan = {
  platform: string
  tier: string
  tierDisplayName: string | null
  priceMonthly: number
  priceYearly: number
}

const TIER_ORDER: Record<string, number> = { starter: 1, pro: 2, enterprise: 3 }

const STATUS_NOTE: Record<string, string> = {
  past_due: 'Pembayaran Anda terlewat. Perbarui pembayaran untuk mengaktifkan kembali fitur.',
  suspended: 'Langganan Anda ditangguhkan. Selesaikan pembayaran untuk melanjutkan.',
  cancelled: 'Langganan Anda dibatalkan. Pilih paket untuk mengaktifkan kembali.',
  expired: 'Masa langganan/trial Anda berakhir. Pilih paket untuk lanjut.',
}

const ERROR_NOTE: Record<string, string> = {
  forbidden: 'Hanya pemilik akun yang dapat mengelola langganan.',
  demo: 'Akun demo tidak bisa berlangganan. Daftar akun asli untuk mulai berlangganan.',
  not_provisioned: 'Akun billing belum siap. Coba beberapa saat lagi atau hubungi kami.',
  billing_link_unavailable: 'Pembayaran online belum aktif. Hubungi kami untuk berlangganan.',
}

async function fetchPharmacyPlans(): Promise<PublicPlan[]> {
  try {
    const res = await fetch(`${superadminBaseUrl()}/api/public/plans`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = (await res.json()) as { plans?: PublicPlan[] }
    return (data.plans ?? [])
      .filter((p) => p.platform === 'pharmacy')
      .sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9))
  } catch {
    return []
  }
}

function rupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

const ACTIVE_STANDING = new Set(['active', 'trialing', 'trial', 'legacy'])

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; billing?: string }>
}) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const [ent, plans, sp] = await Promise.all([
    getTenantEntitlements(profile.tenant_id),
    fetchPharmacyPlans(),
    searchParams,
  ])

  const status = ent.status
  const isLegacy = status === 'legacy'
  const isGoodStanding = ACTIVE_STANDING.has(status)
  const currentLabel = isLegacy
    ? 'Akses penuh (belum berlangganan)'
    : ent.tier
      ? `Paket ${ent.tier} — ${status}`
      : status

  const note = sp.error ? ERROR_NOTE[sp.error] : sp.billing ? STATUS_NOTE[sp.billing] : undefined
  const noteIsError = !!sp.error || (sp.billing && !ACTIVE_STANDING.has(sp.billing))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Langganan</h1>
        <p className="mt-1 text-sm text-gray-500">Kelola paket Webzoka Pharmacy bisnis Anda.</p>
      </header>

      {note && (
        <div
          className={`mb-6 rounded-[14px] border px-4 py-3 text-sm ${
            noteIsError
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {note}
        </div>
      )}

      {/* Current status */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Status saat ini</p>
            <p className="text-sm font-bold text-gray-900">{currentLabel}</p>
          </div>
        </div>
        <Link
          href="/api/billing/upgrade"
          prefetch={false}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0071E3] px-6 text-sm font-bold text-white transition-all hover:bg-[#005BB5] active:scale-[0.97]"
        >
          {isGoodStanding && !isLegacy ? 'Kelola / Ganti Paket' : 'Langganan Sekarang'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Plans */}
      {plans.length === 0 ? (
        <p className="text-sm text-gray-500">Daftar paket belum tersedia. Coba muat ulang.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((p) => {
            const display = p.tierDisplayName || p.tier
            const popular = p.tier === 'pro' // Growth
            return (
              <div
                key={p.tier}
                className={`relative rounded-[20px] border bg-white p-6 shadow-sm ${
                  popular ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                {popular && (
                  <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-[#0071E3] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    <Sparkles className="h-3 w-3" /> Populer
                  </span>
                )}
                <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">{display}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-gray-900">{rupiah(p.priceMonthly)}</span>
                  <span className="text-sm text-gray-400">/bln</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">atau {rupiah(p.priceYearly)}/tahun</p>
                <Link
                  href="/api/billing/upgrade"
                  prefetch={false}
                  className={`mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-all active:scale-[0.97] ${
                    popular ? 'bg-[#0071E3] text-white hover:bg-[#005BB5]' : 'bg-gray-900 text-white hover:bg-black'
                  }`}
                >
                  Pilih {display} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-6 inline-flex items-start gap-2 text-xs text-gray-500">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        Pembayaran aman via Midtrans (transfer, QRIS, kartu, minimarket). Harga otoritatif dihitung dari paket.
      </p>
    </div>
  )
}
