'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle, Loader2, Check } from 'lucide-react'

const INPUT_CLS =
  'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0071E3] focus:border-transparent transition-all'

// Core enum tier → display label (Growth/Pro) for the subscribe copy.
function tierLabelOf(tier: string | null): string | null {
  return tier === 'enterprise' ? 'Pro' : tier === 'pro' ? 'Growth' : tier === 'starter' ? 'Starter' : null
}

export default function RegisterPage() {
  const [namaApotek, setNamaApotek] = useState('')
  const [adminName, setAdminName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Subscribe intent from the pricing page (?intent=subscribe&tier=<coreTier>&period=).
  const [subscribe, setSubscribe] = useState(false)
  const [tier, setTier] = useState<string | null>(null)
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setSubscribe(q.get('intent') === 'subscribe')
    const t = q.get('tier')
    if (t) setTier(t)
    if (q.get('period') === 'yearly') setPeriod('yearly')
  }, [])

  const tierLabel = tierLabelOf(tier)

  function validate(): string {
    if (namaApotek.trim().length < 3) return 'Nama apotek minimal 3 karakter'
    if (!adminName.trim()) return 'Nama admin wajib diisi'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'Email tidak valid'
    if (password.length < 8) return 'Password minimal 8 karakter'
    if (!agreed) return 'Anda harus menyetujui syarat & ketentuan'
    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaApotek, adminName, phone, email, password }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Registrasi gagal. Coba lagi.')
        setLoading(false)
        return
      }
      // Paid signup → straight to Midtrans checkout (the API already auto-logged in,
      // so the session cookie is set). Keep loading while the browser navigates away.
      if (subscribe && tier) {
        window.location.assign(`/api/billing/checkout?tier=${encodeURIComponent(tier)}&period=${period}`)
        return
      }
      window.location.assign('/')
    } catch {
      setError('Koneksi gagal. Periksa internet Anda dan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-gray-900">Webzoka</h1>
          <p className="text-xs font-bold uppercase tracking-widest text-[#0071E3] mt-1">Portal Farmasi</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-black/[0.04] shadow-sm">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full mb-3">
              <Check size={12} strokeWidth={3} />
              {subscribe && tierLabel ? `Berlangganan paket ${tierLabel}` : 'Gratis 14 hari — tanpa kartu kredit'}
            </span>
            <h2 className="text-xl font-black text-gray-900 mb-0.5">Daftarkan Apotek Anda</h2>
            <p className="text-xs text-gray-400">
              {subscribe ? 'Buat akun apotek Anda, lalu lanjut ke pembayaran.' : 'Isi data di bawah, apotek Anda langsung aktif.'}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nama Apotek *</label>
              <input value={namaApotek} onChange={(e) => { setNamaApotek(e.target.value); setError('') }} placeholder="Apotek Sehat Sentosa" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nama Lengkap Admin *</label>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Nama Anda" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">No. WhatsApp</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08123456789" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@apotek.com" className={INPUT_CLS} autoComplete="email" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Password * (min 8 karakter)</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${INPUT_CLS} pr-12`} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0071E3] flex-shrink-0" />
              <span className="text-xs text-gray-500">
                Saya setuju dengan <span className="text-[#0071E3] font-bold">syarat & ketentuan</span> penggunaan Webzoka Farmasi
              </span>
            </label>
            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-[#0071E3] hover:bg-[#005BB5] text-white font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Mendaftarkan...
                </>
              ) : subscribe ? (
                'Lanjut ke Pembayaran →'
              ) : (
                'Daftarkan Apotek'
              )}
            </button>
          </form>

          <div className="mt-3 pt-3 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Sudah punya akun?{' '}
              <Link href="/login" className="font-bold text-[#0071E3] hover:underline">
                Login di sini →
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">© {new Date().getFullYear()} Webzoka · Farmasi</p>
      </div>
    </div>
  )
}
