import { LoginForm } from './login-form'
import { Pill } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-6">
            <Image 
              src="/images/Icon.png" 
              alt="Japan Arena Corp" 
              width={64} 
              height={64} 
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight sf-display-heavy">Japan Arena <span className="text-blue-600">Pharmacy</span></h1>
          <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-[0.2em]">SaaS Cloud Infrastructure</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-[32px] border border-black/[0.03] apple-shadow p-10">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Masuk ke Portal</h2>
          <p className="text-sm text-gray-500 mb-8">Silakan login untuk mengelola operasional apotek Anda.</p>
          <LoginForm />
        </div>

        <p className="text-center text-[11px] font-medium text-gray-400 mt-10">
          © {new Date().getFullYear()} Japan Arena Corp · Solusi SaaS Terintegrasi
        </p>
      </div>
    </div>
  )
}
