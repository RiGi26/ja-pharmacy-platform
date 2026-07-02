'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { OfflineStatusBar } from '@/components/shared/offline-status-bar'
import type { UserRole } from '@/types'
import type { EntitlementKey } from '@/lib/entitlements'
import { Menu, X, HelpCircle } from 'lucide-react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
  role: UserRole
  tenantName?: string
  isSuperadmin?: boolean
  entitlements?: EntitlementKey[]
}

export function DashboardLayout({ children, role, tenantName, isSuperadmin, entitlements }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#F5F5F7]">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-[70] w-64 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar role={role} isSuperadmin={isSuperadmin} entitlements={entitlements} />
        {/* Mobile Close Button - Only show when open to avoid blocking header buttons */}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Tutup menu"
            className="lg:hidden absolute top-4 -right-12 p-2.5 bg-white text-gray-900 rounded-full shadow-xl border border-black/5 active:scale-90 transition-transform"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col lg:pl-60 transition-all duration-500">
        {/* Mobile Top Header */}
        <header className="lg:hidden sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-xl border-b border-black/[0.04] flex items-center justify-between px-4 sm:px-6">
           <div className="flex items-center gap-3">
             <button
               onClick={() => setMobileOpen(true)}
               aria-label="Buka menu"
               className="p-2 -ml-1 text-gray-500 hover:bg-black/5 rounded-xl transition-colors active:scale-95"
             >
                <Menu size={22} />
             </button>
             <Image src="/logo-rocket.png" alt="Webzoka" width={24} height={24} className="object-contain" />
             <span className="text-sm font-black text-gray-900 truncate max-w-[120px] sm:max-w-[200px] sf-display tracking-tight">
               {tenantName ?? 'Pharmacy'}
             </span>
           </div>
           <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('onboarding:replay-tour'))}
                data-coach="help-button"
                aria-label="Panduan — putar ulang tur"
                title="Panduan portal"
                className="p-2 text-gray-500 hover:bg-black/5 rounded-xl transition-colors active:scale-95"
              >
                <HelpCircle size={20} />
              </button>
              <div className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-gray-500">
                {role}
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-blue-200">
                 {role[0].toUpperCase()}
              </div>
           </div>
        </header>

        <OfflineStatusBar />
        <div className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full animate-fade-in overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}

