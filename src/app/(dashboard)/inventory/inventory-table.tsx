'use client'

import { DataTable, type Column } from '@/components/shared/data-table'
import { BatchStatusBadge } from '@/components/shared/batch-status-badge'
import { formatCurrency, formatDate, getDaysUntilExpiry } from '@/lib/utils'
import type { BatchStatus } from '@/types'

interface Batch {
  id: string
  batch_number: string
  quantity: number
  buy_price: number
  expiry_date: string
  status: string
  medicines: { name: string; unit: string; category: string | null; barcode: string | null } | null
}

const columns: Column<Batch>[] = [
  {
    key: 'medicine',
    header: 'Nama Obat',
    render: (row: Batch) => (
      <div>
        <p className="font-medium text-gray-900">{row.medicines?.name ?? '—'}</p>
        <p className="text-xs text-gray-400">{row.medicines?.category}</p>
      </div>
    ),
  },
  {
    key: 'batch_number',
    header: 'No. Batch',
    render: (row: Batch) => (
      <span className="font-mono text-xs text-gray-600">{row.batch_number}</span>
    ),
  },
  {
    key: 'quantity',
    header: 'Stok',
    render: (row: Batch) => (
      <span className="font-semibold">{row.quantity} {row.medicines?.unit ?? ''}</span>
    ),
  },
  {
    key: 'buy_price',
    header: 'Harga Beli',
    render: (row: Batch) => (
      <span className="text-sm">{formatCurrency(Number(row.buy_price))}</span>
    ),
  },
  {
    key: 'expiry_date',
    header: 'Expired',
    render: (row: Batch) => {
      const d = getDaysUntilExpiry(row.expiry_date)
      return (
        <div>
          <p className="text-sm">{formatDate(row.expiry_date)}</p>
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
    render: (row: Batch) => (
      <BatchStatusBadge status={row.status as BatchStatus} />
    ),
  },
]

export function InventoryTable({ batches }: { batches: Batch[] }) {
  return (
    <DataTable
      data={batches}
      columns={columns}
      keyField="id"
      emptyMessage="Tidak ada stok aktif"
    />
  )
}
