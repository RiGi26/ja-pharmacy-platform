'use client'

/**
 * PortalLoginCard — komponen login seragam lintas portal Webzoka.
 *
 * Self-contained: memiliki seluruh state form + markup + gaya (nilai dekoratif
 * di-inline via arbitrary Tailwind, jadi tidak bergantung pada utilitas CSS khas
 * tiap repo). Tiap portal hanya menyuntik `onSubmit` (mekanisme auth-nya sendiri),
 * `subLabel`, dan entri `demo`. Redirect saat sukses terjadi DI DALAM `onSubmit`.
 *
 * Markup file ini harus IDENTIK di seluruh repo (lms/clinic/pharmacy/rental/stock/laundry).
 */

import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'

const WA_HREF = 'https://wa.me/6281296917963'

export type PortalLoginCardProps = {
  /** Eyebrow di bawah wordmark, mis. "KLINIK PORTAL" */
  subLabel: string
  /** Label portal untuk baris copyright, mis. "Webzoka Klinik" */
  portalLabel: string
  /**
   * Auth submit milik tiap portal. Saat sukses, lakukan redirect DI SINI dan
   * kembalikan void. Untuk menampilkan banner error, kembalikan `{ error }`.
   */
  onSubmit: (email: string, password: string) => Promise<{ error?: string } | void>
  /** Notice awal (mis. dari ?error=inactive) — tampil kuning di atas form */
  initialNotice?: string | null
  /** Entri demo: `href` (rute seperti /demo) ATAU `onClick` (handler auth demo) */
  demo?: { href?: string; onClick?: () => void | Promise<void> }
}

export function PortalLoginCard({
  subLabel,
  portalLabel,
  onSubmit,
  initialNotice,
  demo,
}: PortalLoginCardProps) {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await onSubmit(email, password)
      if (result && result.error) {
        setError(result.error)
        setLoading(false)
      }
      // sukses → onSubmit menavigasi; biarkan loading aktif sampai pindah halaman
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setLoading(false)
    }
  }

  async function handleDemo() {
    if (!demo?.onClick) return
    setError('')
    setLoading(true)
    try {
      await demo.onClick()
    } catch {
      setError('Gagal masuk ke mode demo. Silakan coba lagi.')
      setLoading(false)
    }
  }

  const showNotice = !error && !!initialNotice

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decor */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-3xl -mr-64 -mt-64 opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-100/30 rounded-full blur-3xl -ml-32 -mb-32 opacity-40 pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10 animate-fade-in">
        {/* Branding */}
        <div className="text-center mb-10 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-rocket.png" alt="Logo Webzoka" className="h-16 w-16 object-contain" />
          <div className="text-center mt-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 leading-none">Webzoka</h1>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-2">{subLabel}</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[28px] p-8 md:p-10 border border-black/[0.03] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          {showNotice && (
            <div role="alert" aria-live="polite" className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
              <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#1C1C1E]">{initialNotice}</p>
            </div>
          )}
          {error && (
            <div role="alert" aria-live="polite" className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4 mb-6">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                Alamat Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="email@kamu.com"
                className="w-full px-4 py-3.5 bg-gray-50/50 border border-black/5 rounded-2xl text-[15px] text-[#1D1D1F] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-gray-50/50 border border-black/5 rounded-2xl text-[15px] text-[#1D1D1F] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#0071E3] hover:bg-[#005BB5] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] disabled:opacity-60 shadow-[0_8px_20px_rgba(0,113,227,0.3)] hover:shadow-[0_12px_25px_rgba(0,113,227,0.4)]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Mengotentikasi...
                  </span>
                ) : (
                  'Login ke Portal'
                )}
              </button>
            </div>
          </form>

          {/* Footer minimal seragam: Coba Demo + Chat Admin WA */}
          <div className="mt-8 pt-6 border-t border-black/5 text-center space-y-2">
            {demo && (
              <p className="text-sm text-gray-500">
                Ingin coba dulu?{' '}
                {demo.href ? (
                  <a href={demo.href} className="font-bold text-[#0071E3] hover:text-blue-700 transition-colors">
                    Coba Demo →
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleDemo}
                    disabled={loading}
                    className="font-bold text-[#0071E3] hover:text-blue-700 transition-colors disabled:opacity-60"
                  >
                    Coba Demo →
                  </button>
                )}
              </p>
            )}
            <p className="text-sm text-gray-500">
              Butuh bantuan?{' '}
              <a href={WA_HREF} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0071E3] hover:underline">
                Chat Admin WA 💬
              </a>
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            © {new Date().getFullYear()} Webzoka · {portalLabel}
          </p>
        </div>
      </div>
    </div>
  )
}
