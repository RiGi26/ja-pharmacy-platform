import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { StockOpnameForm } from './stock-opname-form'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default async function NewStockOpnamePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('tenant_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const canAccess = ['superadmin', 'admin', 'apoteker'].includes(profile.role)
  if (!canAccess) redirect('/dashboard')

  const { data: batches } = await supabase
    .from('medicine_batches')
    .select('id, batch_number, quantity, expiry_date, medicine_id, medicines(name, unit)')
    .eq('tenant_id', profile.tenant_id)
    .not('status', 'in', '("DISPOSED","RETURNED","EMPTY")')
    .order('medicine_id')
    .order('expiry_date')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Stok Opname Baru">
        <Link href="/stock-opname">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4" />Kembali</Button>
        </Link>
      </PageHeader>
      <StockOpnameForm
        batches={(batches ?? []) as unknown as {
          id: string
          batch_number: string
          quantity: number
          expiry_date: string
          medicine_id: string
          medicines: { name: string; unit: string } | null
        }[]}
        tenantId={profile.tenant_id}
        userId={user.id}
      />
    </div>
  )
}
