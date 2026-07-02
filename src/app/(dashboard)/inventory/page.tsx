import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { InventoryTable } from './inventory-table'
import { PageCoachmark } from '@/components/onboarding/PageCoachmark'
import { getSeenCoachmarks } from '@/lib/onboarding/state'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/login')

  const { data: batches, count } = await supabase
    .from('medicine_batches')
    .select('*, medicines(name, unit, category, barcode)', { count: 'exact' })
    .eq('tenant_id', profile.tenant_id)
    .not('status', 'in', '(DISPOSED,RETURNED,EMPTY)')
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true })
    .limit(100)

  // Owner included: a fresh self-subscribe tenant has only the owner account, and
  // the /inventory/stock-in form itself was never role-gated.
  const canWrite = ['superadmin', 'owner', 'admin', 'apoteker'].includes(profile.role)
  const seenCoachmarks = await getSeenCoachmarks()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Inventori Stok" description={`${count ?? 0} batch aktif`}>
        {canWrite && (
          <Link href="/inventory/stock-in">
            <Button size="sm" data-coach="inventory-stockin"><Plus className="w-4 h-4" />Input Stok Masuk</Button>
          </Link>
        )}
      </PageHeader>

      <InventoryTable batches={(batches ?? []) as Parameters<typeof InventoryTable>[0]['batches']} />
      <PageCoachmark
        coachKey="coach:inventory"
        target='[data-coach="inventory-stockin"]'
        title="Input stok masuk"
        description="Catat batch stok baru di sini — jumlah, harga beli, dan kedaluwarsa."
        seen={seenCoachmarks.includes('coach:inventory')}
      />
    </div>
  )
}
