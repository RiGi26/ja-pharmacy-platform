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
    <aside className="fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-white border-r border-gray-100">
      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Pill className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {tenantName ?? 'ja-pharmacy'}
            </p>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
              Japan Arena Corp
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {items.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 mb-0.5',
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-blue-600' : 'text-gray-400')} />
              <span className="flex-1 truncate">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 text-blue-400" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-gray-100">
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
