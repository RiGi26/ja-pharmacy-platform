import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { PrescriptionQueue } from './prescription-queue'

export default async function PrescriptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/login')

  const canAccess = ['superadmin', 'admin', 'apoteker'].includes(profile.role)
  if (!canAccess) redirect('/dashboard')

  const { data: prescriptions } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .in('status', ['PENDING', 'PROCESSING'])
    .order('created_at', { ascending: true })

  const { data: dispensed } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'DISPENSED')
    .order('dispensed_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Antrian Resep"
        description="Resep masuk dari ja-clinic-platform"
      />
      <PrescriptionQueue
        pending={prescriptions ?? []}
        dispensed={dispensed ?? []}
        tenantId={profile.tenant_id}
        userId={user.id}
      />
    </div>
  )
}
