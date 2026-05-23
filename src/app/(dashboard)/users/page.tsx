import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { UserList } from './user-list'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('tenant_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const canAccess = ['superadmin', 'owner'].includes(profile.role)
  if (!canAccess) redirect('/dashboard')

  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, user_id, full_name, email, role, phone, is_active, created_at')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Manajemen Pengguna" description="Kelola akun staf apotek" />
      <UserList users={users ?? []} tenantId={profile.tenant_id} currentUserId={user.id} />
    </div>
  )
}
