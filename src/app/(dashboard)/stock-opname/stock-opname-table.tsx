'use client'

import { DataTable, type Column } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

interface SessionRow {
  id: string
  date: string
  by: string
  count: number
  totalAdj: number
}

const columns: Column<SessionRow>[] = [
  {
    key: 'date',
    header: 'Tanggal',
    render: (row: SessionRow) => (
      <span className="text-sm">{formatDateTime(row.date)}</span>
    ),
  },
  {
    key: 'id',
    header: 'Sesi',
    render: (row: SessionRow) => (
      <span className="text-xs font-mono text-gray-500">{row.id.slice(0, 30)}</span>
    ),
  },
  {
    key: 'count',
    header: 'Jumlah Batch',
    render: (row: SessionRow) => (
      <Badge variant="secondary">{row.count} batch</Badge>
    ),
  },
  {
    key: 'totalAdj',
    header: 'Total Selisih',
    render: (row: SessionRow) => (
      <span className={`font-semibold ${row.totalAdj >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {row.totalAdj > 0 ? '+' : ''}{row.totalAdj}
      </span>
    ),
  },
  {
    key: 'by',
    header: 'Dilakukan Oleh',
    render: (row: SessionRow) => (
      <span className="text-sm text-gray-600">{row.by}</span>
    ),
  },
]

export function StockOpnameTable({ sessions }: { sessions: SessionRow[] }) {
  return (
    <DataTable<SessionRow>
      data={sessions}
      columns={columns}
      keyField="id"
      emptyMessage="Belum ada riwayat stok opname"
    />
  )
}
