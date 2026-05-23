import { PosTerminal } from './pos-terminal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function PosPage() {
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

  return (
    <PosTerminal
      cashierName={profile.full_name}
      tenantId={profile.tenant_id}
      userId={user.id}
    />
  )
}
