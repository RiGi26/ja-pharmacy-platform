import { LoginForm } from './login-form'
import { Pill, Home } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Link 
            href="https://www.webzoka.com"
            className="group flex flex-col items-center gap-4 transition-all"
            title="Kembali ke Portal Utama"
          >
            <div className="relative">
              <Image 
                src="/images/Icon.png" 
                alt="Webzoka"
                width={64} 
                height={64} 
                className="object-contain group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap pointer-events-none">
                Kembali ke Beranda
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight sf-display-heavy">Webzoka <span className="text-blue-600">Pharmacy</span></h1>
              <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-[0.2em]">SaaS Cloud Infrastructure</p>
            </div>
          </Link>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-[32px] border border-black/[0.03] apple-shadow p-10">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Login ke Portal</h2>
          <p className="text-sm text-gray-500 mb-8">Silakan login untuk mengelola operasional apotek Anda.</p>
          <LoginForm />
        </div>

        <p className="text-center text-[11px] font-medium text-gray-400 mt-10">
          © {new Date().getFullYear()} Webzoka · Solusi SaaS Terintegrasi
        </p>
      </div>
    </div>
  )
}
