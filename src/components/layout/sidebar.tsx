'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import {
  LayoutDashboard, Pill, Package, ShoppingCart, FileText,
  BarChart2, Settings, Users, AlertTriangle, LogOut,
  Building2, ChevronRight, Recycle, ClipboardList,
} from 'lucide-react'
import Image from 'next/image'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',      icon: LayoutDashboard, roles: ['superadmin','owner','admin','apoteker','kasir'] },
  { label: 'Obat',           href: '/medicines',      icon: Pill,            roles: ['superadmin','owner','admin','apoteker'] },
  { label: 'Inventori',      href: '/inventory',      icon: Package,         roles: ['superadmin','owner','admin','apoteker'] },
  { label: 'Monitoring Exp.', href: '/expiry',        icon: AlertTriangle,   roles: ['superadmin','owner','admin','apoteker'] },
  { label: 'Kasir (POS)',    href: '/pos',            icon: ShoppingCart,    roles: ['superadmin','admin','apoteker','kasir'] },
  { label: 'Resep',          href: '/prescriptions',  icon: FileText,        roles: ['superadmin','admin','apoteker'] },
  { label: 'Stok Opname',    href: '/stock-opname',   icon: ClipboardList,   roles: ['superadmin','admin','apoteker'] },
  { label: 'Retur & Musnah', href: '/disposals',      icon: Recycle,         roles: ['superadmin','admin','apoteker'] },
  { label: 'Laporan',        href: '/reports',        icon: BarChart2,       roles: ['superadmin','owner','admin'] },
  { label: 'Pengguna',       href: '/users',          icon: Users,           roles: ['superadmin','owner'] },
  { label: 'Pengaturan',     href: '/settings',       icon: Settings,        roles: ['superadmin','owner'] },
]

const SUPERADMIN_ITEMS: NavItem[] = [
  { label: 'Semua Tenant',   href: '/superadmin/tenants', icon: Building2, roles: ['superadmin'] },
  { label: 'Dashboard',      href: '/superadmin',         icon: LayoutDashboard, roles: ['superadmin'] },
]

interface SidebarProps {
  role: UserRole
  tenantName?: string
  isSuperadmin?: boolean
}

export function Sidebar({ role, tenantName, isSuperadmin }: SidebarProps) {
  const pathname = usePathname()

  const items = isSuperadmin ? SUPERADMIN_ITEMS : NAV_ITEMS.filter(i => i.roles.includes(role))

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-white border-r border-black/[0.03] apple-shadow">
      {/* Header */}
      <div className="px-4 py-8 border-b border-black/[0.03]">
        <div className="flex flex-col items-center text-center gap-3">
          <Link href="/" className="hover:scale-105 transition-transform">
            <Image 
              src="/images/Icon.png" 
              alt="Japan Arena Corp" 
              width={48} 
              height={48} 
              className="object-contain"
            />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 truncate sf-display">
              {tenantName ?? 'Pharmacy Portal'}
            </p>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em]">
              Japan Arena <span className="text-blue-600">SaaS</span>
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {items.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all duration-200',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-gray-400')} />
              <span className="flex-1 truncate">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 text-white/50" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-black/[0.03] space-y-1">
        <a 
          href="https://ja-landingpage-platform.vercel.app"
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-all"
        >
          <Building2 className="w-4 h-4" />
          <span>Japan Arena Corp</span>
        </a>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold text-gray-400 hover:bg-red-50 hover:text-red-600 w-full transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sistem</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
