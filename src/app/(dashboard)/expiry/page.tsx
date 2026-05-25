import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { ExpiryDashboard } from './expiry-dashboard'

export default async function ExpiryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/login')

  const thresholdDate = new Date(new Date().getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: batches } = await supabase
    .from('medicine_batches')
    .select('*, medicines(name, unit, category)')
    .eq('tenant_id', tenantId)
    .in('status', ['WARNING', 'DILARANG_JUAL', 'LAYAK_JUAL'])
    .gt('quantity', 0)
    .lte('expiry_date', thresholdDate)
    .order('expiry_date', { ascending: true })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Monitoring Kedaluwarsa"
        description="Batch obat yang mendekati atau sudah melewati tanggal kedaluwarsa"
      />
      <ExpiryDashboard batches={batches ?? []} />
    </div>
  )
}
