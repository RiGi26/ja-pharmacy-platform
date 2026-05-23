import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BatchStatusBadge } from '@/components/shared/batch-status-badge'
import { formatCurrency, formatDate, getDaysUntilExpiry } from '@/lib/utils'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { BatchStatus } from '@/types'

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
    .not('status', 'in', '("DISPOSED","RETURNED","EMPTY")')
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true })
    .limit(100)

  const canWrite = ['superadmin', 'admin', 'apoteker'].includes(profile.role)

  const columns = [
    {
      key: 'medicine',
      header: 'Nama Obat',
      render: (row: Record<string, unknown>) => {
        const b = row as typeof batches extends (infer T)[] | null ? T : never
        const m = b?.medicines as { name: string; category: string | null } | null
        return (
          <div>
            <p className="font-medium text-gray-900">{m?.name ?? '—'}</p>
            <p className="text-xs text-gray-400">{m?.category}</p>
          </div>
        )
      },
    },
    {
      key: 'batch_number',
      header: 'No. Batch',
      render: (row: Record<string, unknown>) => (
        <span className="font-mono text-xs text-gray-600">{String(row.batch_number)}</span>
      ),
    },
    {
      key: 'quantity',
      header: 'Stok',
      render: (row: Record<string, unknown>) => {
        const b = row as { quantity: number; medicines: { unit: string } | null }
        return <span className="font-semibold">{b.quantity} {b.medicines?.unit ?? ''}</span>
      },
    },
    {
      key: 'buy_price',
      header: 'Harga Beli',
      render: (row: Record<string, unknown>) => (
        <span className="text-sm">{formatCurrency(Number(row.buy_price))}</span>
      ),
    },
    {
      key: 'expiry_date',
      header: 'Expired',
      render: (row: Record<string, unknown>) => {
        const d = getDaysUntilExpiry(String(row.expiry_date))
        return (
          <div>
            <p className="text-sm">{formatDate(String(row.expiry_date))}</p>
            <p className={`text-xs font-medium ${d <= 0 ? 'text-red-500' : d <= 30 ? 'text-red-400' : d <= 90 ? 'text-amber-500' : 'text-gray-400'}`}>
              {d < 0 ? `${Math.abs(d)}h lalu` : `H-${d}`}
            </p>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Record<string, unknown>) => (
        <BatchStatusBadge status={row.status as BatchStatus} />
      ),
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Inventori Stok" description={`${count ?? 0} batch aktif`}>
        {canWrite && (
          <Link href="/inventory/stock-in">
            <Button size="sm"><Plus className="w-4 h-4" />Input Stok Masuk</Button>
          </Link>
        )}
      </PageHeader>

      <DataTable
        data={(batches ?? []) as unknown as Record<string, unknown>[]}
        columns={columns}
        keyField="id"
        emptyMessage="Tidak ada stok aktif"
      />
    </div>
  )
}
