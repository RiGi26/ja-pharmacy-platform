import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('tenant_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  if (!['superadmin', 'owner'].includes(profile.role)) redirect('/dashboard')

  const [tenantRes, configRes] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, address, phone, email').eq('id', profile.tenant_id).single(),
    supabase.from('tenant_configs').select('*').eq('tenant_id', profile.tenant_id).single(),
  ])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="Pengaturan" description="Konfigurasi apotek dan notifikasi" />
      <SettingsForm
        tenant={tenantRes.data}
        config={configRes.data}
        tenantId={profile.tenant_id}
      />
    </div>
  )
}
