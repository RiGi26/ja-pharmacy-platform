'use client'

/**
 * PortalRegisterCard — kartu daftar (register) seragam lintas portal Webzoka.
 *
 * Pasangan dari PortalLoginCard: self-contained (seluruh state form + markup +
 * gaya di-inline via arbitrary Tailwind, tidak bergantung utilitas CSS khas repo).
 * Tiap portal hanya menyuntik `onSubmit` (provisioning-nya sendiri), `subLabel`,
 * `portalLabel`, `subscribe`/`planLabel` (dari query pricing), dan `loginHref`.
 * Redirect saat sukses terjadi DI DALAM `onSubmit` (persis pola PortalLoginCard).
 *
 * Markup file ini harus IDENTIK di seluruh repo (lms/clinic/pharmacy/rental/stock/laundry).
 */

import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type RegisterData = {
  businessName: string
  adminName: string
  email: string
  whatsapp: string
  password: string
}

export type PortalRegisterCardProps = {
  /** Eyebrow di bawah wordmark, mis. "KLINIK PORTAL" */
  subLabel: string
  /** Label portal untuk baris copyright, mis. "Webzoka Klinik" */
  portalLabel: string
  /** True bila datang dari pricing dengan intent=subscribe DAN tier valid dikenali. */
  subscribe: boolean
  /** Nama paket tampilan (mis. "Growth") untuk heading "Berlangganan …". */
  planLabel?: string
  /** Target footer "Masuk di sini" (mis. /auth/login atau /login, boleh bawa ?next=). */
  loginHref: string
  /**
   * Provisioning milik tiap portal. Saat sukses, lakukan redirect DI SINI dan
   * kembalikan void. Untuk menampilkan banner error (akun belum dibuat), kembalikan
   * `{ error }`. Data sudah ternormalisasi + di-trim (email lowercase).
   */
  onSubmit: (data: RegisterData) => Promise<{ error?: string } | void>
}

export function PortalRegisterCard({
  subLabel,
  portalLabel,
  subscribe,
  planLabel,
  loginHref,
  onSubmit,
}: PortalRegisterCardProps) {
  const [businessName, setBusinessName]   = useState('')
  const [adminName, setAdminName]         = useState('')
  const [email, setEmail]                 = useState('')
  const [whatsapp, setWhatsapp]           = useState('')
  const [password, setPassword]           = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agree, setAgree]                 = useState(false)
  const [showPassword, setShowPassword]   = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  // Hint inline khusus konfirmasi password (tampil begitu keduanya terisi & beda).
  const pwMismatch = confirmPassword.length > 0 && password !== confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError('')

    // ── Validasi berurutan (klien) ─────────────────────────────────
    if (businessName.trim().length < 3) { setError('Nama bisnis minimal 3 karakter.'); return }
    if (!adminName.trim())              { setError('Nama admin / PIC wajib diisi.'); return }
    if (!EMAIL_RE.test(email.trim()))   { setError('Format email tidak valid.'); return }
    if (password.length < 8)            { setError('Password minimal 8 karakter.'); return }
    if (password !== confirmPassword)   { setError('Password tidak cocok.'); return }
    if (!agree)                         { setError('Anda harus menyetujui syarat & ketentuan.'); return }

    setLoading(true)
    try {
      const result = await onSubmit({
        businessName: businessName.trim(),
        adminName: adminName.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        password,
      })
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

  const inputCls =
    'w-full px-4 py-3.5 bg-gray-50/50 border border-black/5 rounded-2xl text-[15px] text-[#1D1D1F] ' +
    'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all'
  const labelCls = 'block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1'

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decor — identik PortalLoginCard */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-3xl -mr-64 -mt-64 opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-100/30 rounded-full blur-3xl -ml-32 -mb-32 opacity-40 pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10 animate-fade-in py-10">
        {/* Branding */}
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-rocket.png" alt="Logo Webzoka" className="h-16 w-16 object-contain" />
          <div className="text-center mt-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 leading-none">Webzoka</h1>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-2">{subLabel}</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[28px] p-8 md:p-10 border border-black/[0.03] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          {/* Heading + subtitle + badge */}
          <div className="mb-6">
            <h2 className="text-xl font-black text-gray-900 mb-1">
              {subscribe ? `Berlangganan ${planLabel}` : 'Daftar & Mulai Trial'}
            </h2>
            <p className="text-sm text-gray-500">
              {subscribe ? 'Isi data bisnis, lalu lanjut ke pembayaran' : 'Isi data bisnis, akun langsung aktif.'}
            </p>
            {subscribe ? (
              <p className="mt-3 text-xs font-medium text-[#0071E3] bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                Belum siap bayar? Akun tetap mendapat trial 14 hari.
              </p>
            ) : (
              <p className="mt-3 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                Gratis 14 hari — tanpa kartu kredit
              </p>
            )}
          </div>

          {error && (
            <div role="alert" aria-live="polite" className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4 mb-6">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="reg-business" className={labelCls}>Nama Bisnis</label>
              <input id="reg-business" type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                required minLength={3} placeholder="Contoh: Bakso Tini Japan" className={inputCls} />
            </div>

            <div>
              <label htmlFor="reg-admin" className={labelCls}>Nama Admin / PIC</label>
              <input id="reg-admin" type="text" value={adminName} onChange={e => setAdminName(e.target.value)}
                required placeholder="Nama lengkap Anda" className={inputCls} />
            </div>

            <div>
              <label htmlFor="reg-email" className={labelCls}>Email</label>
              <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="admin@bisnis.jp" className={inputCls} />
            </div>

            <div>
              <label htmlFor="reg-wa" className={labelCls}>
                No. WhatsApp <span className="normal-case text-gray-300">(opsional)</span>
              </label>
              <input id="reg-wa" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                autoComplete="tel" placeholder="62812xxxxxxx" className={inputCls} />
            </div>

            <div>
              <label htmlFor="reg-password" className={labelCls}>Password</label>
              <div className="relative">
                <input id="reg-password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={8}
                  autoComplete="new-password" placeholder="Minimal 8 karakter" className={inputCls + ' pr-12'} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" className={labelCls}>Konfirmasi Password</label>
              <input id="reg-confirm" type={showPassword ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password"
                placeholder="Ulangi password"
                className={inputCls + (pwMismatch ? ' ring-2 ring-red-400/40' : '')} />
              {pwMismatch && <p className="text-xs text-red-500 mt-1 ml-1">Password tidak cocok</p>}
            </div>

            <label className="flex items-start gap-2.5 text-sm text-gray-600 pt-1">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} required
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#0071E3]" />
              <span>Saya setuju dengan syarat &amp; ketentuan penggunaan Webzoka.</span>
            </label>

            <div className="pt-2">
              <button type="submit" disabled={loading}
                className="w-full py-4 bg-[#0071E3] hover:bg-[#005BB5] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98] disabled:opacity-60 shadow-[0_8px_20px_rgba(0,113,227,0.3)] hover:shadow-[0_12px_25px_rgba(0,113,227,0.4)]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Memproses...
                  </span>
                ) : subscribe ? 'Daftar & Lanjut Bayar' : 'Mulai Trial 14 Hari'}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-black/5 text-center">
            <p className="text-sm text-gray-500">
              Sudah punya akun?{' '}
              <a href={loginHref} className="font-bold text-[#0071E3] hover:text-blue-700 transition-colors">
                Masuk di sini
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
