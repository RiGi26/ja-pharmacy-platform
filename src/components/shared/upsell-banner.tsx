'use client'

import { useState } from 'react'
import { X, Lock, AlertTriangle } from 'lucide-react'
import { FEATURE_LABEL, type EntitlementKey } from '@/lib/entitlements'

const BILLING_LABEL: Record<string, string> = {
  past_due: 'Pembayaran tertunda',
  suspended: 'Langganan ditangguhkan',
  cancelled: 'Langganan dibatalkan',
  expired: 'Langganan kedaluwarsa',
}

/**
 * Shown on /dashboard when a tier-gated page bounced the user here with
 * ?upsell=<key> (feature not in package) or ?billing=<status> (not in good
 * standing). Pharmacy has no self-serve upgrade yet → point to the operator.
 */
export function UpsellBanner({ upsell, billing }: { upsell?: string; billing?: string }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || (!upsell && !billing)) return null

  const isBilling = !!billing
  const featureLabel = upsell ? FEATURE_LABEL[upsell as EntitlementKey] ?? upsell : ''
  const title = isBilling
    ? BILLING_LABEL[billing!] ?? 'Langganan tidak aktif'
    : `Fitur "${featureLabel}" terkunci`
  const body = isBilling
    ? 'Akses fitur berbayar dijeda sampai pembayaran diperbarui. Hubungi admin untuk mengaktifkan kembali.'
    : `Fitur ini tidak termasuk dalam paket langganan Anda saat ini. Tingkatkan paket untuk membukanya.`

  return (
    <div className={`relative mb-6 rounded-2xl border p-4 flex items-start gap-3 ${
      isBilling ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <span className={`mt-0.5 ${isBilling ? 'text-red-500' : 'text-amber-500'}`}>
        {isBilling ? <AlertTriangle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${isBilling ? 'text-red-700' : 'text-amber-800'}`}>{title}</p>
        <p className={`text-sm mt-0.5 ${isBilling ? 'text-red-600' : 'text-amber-700'}`}>{body}</p>
        <a
          href="https://wa.me/6281296917963"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-block mt-2 text-sm font-semibold underline ${
            isBilling ? 'text-red-700' : 'text-amber-800'
          }`}
        >
          Hubungi admin untuk tingkatkan paket →
        </a>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 -m-1 text-black/30 hover:text-black/60 transition-colors"
        aria-label="Tutup"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
