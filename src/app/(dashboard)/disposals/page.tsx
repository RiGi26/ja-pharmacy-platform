import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { assertEntitled } from '@/lib/tenant-entitlements'
import { PageHeader } from '@/components/layout/page-header'
import { DisposalList } from './disposal-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function DisposalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('tenant_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const canAccess = ['superadmin', 'admin', 'apoteker'].includes(profile.role)
  if (!canAccess) redirect('/dashboard')

  // Tier gate: Retur & Musnah = Growth+ (Starter diblok → upsell).
  await assertEntitled(profile.tenant_id, 'disposals')

  const { data: disposals } = await supabase
    .from('disposals')
    .select('*, medicines(name), medicine_batches(batch_number, expiry_date)')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .limit(50)

  const canApprove = ['superadmin', 'owner', 'admin'].includes(profile.role)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Retur & Pemusnahan Obat" description="Kelola pengembalian ke distributor dan pemusnahan obat expired/rusak">
        {['superadmin', 'admin', 'apoteker'].includes(profile.role) && (
          <Link href="/disposals/new">
            <Button size="sm"><Plus className="w-4 h-4" />Buat Pengajuan</Button>
          </Link>
        )}
      </PageHeader>
      <DisposalList disposals={disposals ?? []} canApprove={canApprove} tenantId={profile.tenant_id} userId={user.id} />
    </div>
  )
}
