'use client'

import { useState } from 'react'
import { DataTable } from '@/components/shared/data-table'
import { BatchStatusBadge } from '@/components/shared/batch-status-badge'
import { StatCard } from '@/components/shared/stat-card'
import { formatDate, getDaysUntilExpiry } from '@/lib/utils'
import { AlertTriangle, Ban, Clock, CheckCircle } from 'lucide-react'
import type { BatchStatus } from '@/types'

type Batch = {
  id: string
  medicine_id: string
  batch_number: string
  expiry_date: string
  quantity: number
  status: string
  discount_pct: number
  medicines: { name: string; unit: string; category: string | null } | null
}

type Filter = 'all' | 'DILARANG_JUAL' | 'WARNING' | 'h180'

export function ExpiryDashboard({ batches }: { batches: Batch[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const dilarang = batches.filter(b => b.status === 'DILARANG_JUAL')
  const warning = batches.filter(b => b.status === 'WARNING')
  const h180 = batches.filter(b => {
    const d = getDaysUntilExpiry(b.expiry_date)
    return d > 90 && d <= 180
  })

  const filtered = filter === 'DILARANG_JUAL' ? dilarang
    : filter === 'WARNING' ? warning
    : filter === 'h180' ? h180
    : batches

  const columns = [
    {
      key: 'medicine',
      header: 'Nama Obat',
      render: (row: Record<string, unknown>) => {
        const b = row as Batch
        return (
          <div>
            <p className="font-medium text-gray-900">{b.medicines?.name ?? '—'}</p>
            <p className="text-xs text-gray-400">{b.medicines?.category}</p>
          </div>
        )
      },
    },
    {
      key: 'batch_number',
      header: 'No. Batch',
      render: (row: Record<string, unknown>) => (
        <span className="font-mono text-xs text-gray-500">{String(row.batch_number)}</span>
      ),
    },
    {
      key: 'expiry_date',
      header: 'Tgl Expired',
      render: (row: Record<string, unknown>) => (
        <span className="text-sm">{formatDate(String(row.expiry_date))}</span>
      ),
    },
    {
      key: 'days_left',
      header: 'Sisa Hari',
      render: (row: Record<string, unknown>) => {
        const d = getDaysUntilExpiry(String(row.expiry_date))
        return (
          <span className={d < 0 ? 'text-red-500 font-bold' : d <= 30 ? 'text-red-400 font-semibold' : d <= 90 ? 'text-amber-500 font-semibold' : 'text-gray-500'}>
            {d < 0 ? `${Math.abs(d)}h lalu` : `H-${d}`}
          </span>
        )
      },
    },
    {
      key: 'quantity',
      header: 'Stok',
      render: (row: Record<string, unknown>) => {
        const b = row as Batch
        return <span className="font-medium">{b.quantity} {b.medicines?.unit ?? ''}</span>
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Record<string, unknown>) => {
        const b = row as Batch
        const d = getDaysUntilExpiry(b.expiry_date)
        return <BatchStatusBadge status={b.status as BatchStatus} daysLeft={d > 0 ? d : undefined} />
      },
    },
  ]

  const filterBtn = (f: Filter, label: string, count: number, active: string) => (
    <button
      onClick={() => setFilter(f)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
        filter === f ? active : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filter === f ? 'bg-white/30' : 'bg-gray-100 text-gray-500'}`}>
        {count}
      </span>
    </button>
  )

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Dilarang Jual" value={dilarang.length} subtitle="batch" icon={Ban} iconColor="text-red-500" iconBg="bg-red-50" />
        <StatCard title="Warning (H-90)" value={warning.length} subtitle="batch" icon={AlertTriangle} iconColor="text-amber-500" iconBg="bg-amber-50" />
        <StatCard title="H-180" value={h180.length} subtitle="batch perlu perhatian" icon={Clock} iconColor="text-blue-500" iconBg="bg-blue-50" />
        <StatCard title="Total Termonitor" value={batches.length} subtitle="batch aktif" icon={CheckCircle} iconColor="text-green-500" iconBg="bg-green-50" />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filterBtn('all', 'Semua', batches.length, 'bg-gray-800 text-white')}
        {filterBtn('DILARANG_JUAL', '🚫 Dilarang Jual', dilarang.length, 'bg-red-500 text-white')}
        {filterBtn('WARNING', '⚠️ Warning', warning.length, 'bg-amber-500 text-white')}
        {filterBtn('h180', '📅 H-180', h180.length, 'bg-blue-500 text-white')}
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns}
        keyField="id"
        emptyMessage="Tidak ada batch dalam kategori ini"
      />
    </div>
  )
}
