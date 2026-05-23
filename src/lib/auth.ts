import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_profiles')
    .select('id, tenant_id, role, full_name, phone, is_active')
    .eq('user_id', user.id)
    .single()

  return data as {
    id: string; tenant_id: string; role: UserRole;
    full_name: string; phone: string | null; is_active: boolean
  } | null
}

export async function requireRole(allowedRoles: UserRole[]) {
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Unauthorized')
  if (!allowedRoles.includes(profile.role)) throw new Error('Forbidden')
  return profile
}

export function hasPermission(role: UserRole, action: string): boolean {
  const permissions: Record<string, UserRole[]> = {
    'medicines:write':       ['superadmin', 'admin'],
    'medicines:read':        ['superadmin', 'owner', 'admin', 'apoteker', 'kasir'],
    'stock:write':           ['superadmin', 'admin', 'apoteker'],
    'transactions:write':    ['superadmin', 'admin', 'apoteker', 'kasir'],
    'transactions:void':     ['superadmin', 'owner', 'admin', 'apoteker'],
    'prescriptions:dispense':['superadmin', 'admin', 'apoteker'],
    'reports:read':          ['superadmin', 'owner', 'admin'],
    'users:manage':          ['superadmin', 'owner'],
    'audit:read':            ['superadmin', 'owner'],
    'disposals:submit':      ['superadmin', 'admin', 'apoteker'],
    'disposals:approve':     ['superadmin', 'owner', 'admin'],
    'tenants:manage':        ['superadmin'],
    'settings:write':        ['superadmin', 'owner'],
  }
  return permissions[action]?.includes(role) ?? false
}
