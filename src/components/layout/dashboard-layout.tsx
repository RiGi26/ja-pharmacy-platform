'use client'

import { Sidebar } from './sidebar'
import type { UserRole } from '@/types'

interface DashboardLayoutProps {
  children: React.ReactNode
  role: UserRole
  tenantName?: string
  isSuperadmin?: boolean
}

export function DashboardLayout({ children, role, tenantName, isSuperadmin }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} tenantName={tenantName} isSuperadmin={isSuperadmin} />
      <main className="ml-60 flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
