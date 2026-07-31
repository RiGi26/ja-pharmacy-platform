'use client'

/**
 * Halaman entri demo publik — sebelumnya route.ts (GET + redirect) yang
 * membuat tab baru diam blank selama proses signInWithPassword. Sekarang
 * render instan lalu POST ke /api/demo dari client, supaya customer yang
 * klik "Coba Demo" dari landing/pricing langsung lihat feedback.
 */

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

export default function DemoPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    fetch('/api/demo', { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (res.ok && data?.redirectTo) {
          window.location.href = data.redirectTo
          return
        }
        setStatus('error')
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-3xl -mr-64 -mt-64 opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-100/30 rounded-full blur-3xl -ml-32 -mb-32 opacity-40 pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10 animate-fade-in">
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-rocket.png" alt="Logo Webzoka" className="h-16 w-16 object-contain" />
          <div className="text-center mt-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 leading-none">Webzoka</h1>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-2">PORTAL FARMASI</p>
          </div>
        </div>

        <div className="bg-white rounded-[28px] p-8 md:p-10 border border-black/[0.03] shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-center">
          {status === 'loading' ? (
            <>
              <div className="flex items-center justify-center gap-2 text-[#0071E3] mb-3">
                <Loader2 size={28} className="animate-spin" />
              </div>
              <p className="text-[15px] font-semibold text-[#1D1D1F]">Menyiapkan demo…</p>
              <p className="text-sm text-gray-500 mt-1">Sebentar, kami masuk-kan kamu ke akun demo.</p>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 text-left">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">Gagal masuk ke mode demo. Coba lagi ya.</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full py-3.5 bg-[#0071E3] hover:bg-[#005BB5] text-white font-bold rounded-2xl text-[15px] transition-all active:scale-[0.98]"
                >
                  Coba lagi
                </button>
                <a
                  href="/login"
                  className="w-full py-3.5 text-[#0071E3] font-bold rounded-2xl text-[15px] transition-all hover:bg-blue-50 flex items-center justify-center"
                >
                  Ke halaman login
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
