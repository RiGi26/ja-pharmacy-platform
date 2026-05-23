import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShiftManager } from './shift-manager'

export default async function ShiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id, role, full_name')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/login')

  const canAccess = ['superadmin', 'admin', 'apoteker', 'kasir'].includes(profile.role)
  if (!canAccess) redirect('/dashboard')

  // Cek apakah ada shift aktif (belum ditutup) untuk kasir ini
  const { data: activeShift } = await supabase
    .from('shifts')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('cashier_id', user.id)
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <ShiftManager
      activeShift={activeShift}
      tenantId={profile.tenant_id}
      userId={user.id}
      cashierName={profile.full_name}
    />
  )
}
