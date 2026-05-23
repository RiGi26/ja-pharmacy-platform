'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Search, Edit2, Eye } from 'lucide-react'
import Link from 'next/link'
import type { Database } from '@/types/database'

type Medicine = Database['public']['Tables']['medicines']['Row'] & {
  medicine_batches?: { quantity: number; status: string }[]
}

const DRUG_CLASS_LABELS: Record<string, string> = {
  bebas: 'Bebas', bebas_terbatas: 'Bebas Terbatas',
  keras: 'Keras', psikotropika: 'Psikotropika', narkotika: 'Narkotika',
}

const DRUG_CLASS_COLORS: Record<string, string> = {
  bebas: 'success', bebas_terbatas: 'warning',
  keras: 'default', psikotropika: 'purple', narkotika: 'destructive',
}

interface Props {
  medicines: Medicine[]
  totalPages: number
  page: number
  canWrite: boolean
}

export function MedicineList({ medicines, totalPages, page, canWrite }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')

  const updateQuery = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  const columns = [
    {
      key: 'name',
      header: 'Nama Obat',
      render: (row: Medicine) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          {row.generic_name && <p className="text-xs text-gray-400">{row.generic_name}</p>}
        </div>
      ),
    },
    {
      key: 'barcode',
      header: 'Barcode',
      render: (row: Medicine) => (
        <span className="font-mono text-xs text-gray-500">{row.barcode ?? '—'}</span>
      ),
    },
    {
      key: 'drug_class',
      header: 'Golongan',
      render: (row: Medicine) => row.drug_class ? (
        <Badge variant={DRUG_CLASS_COLORS[row.drug_class] as 'default' | 'success' | 'warning' | 'destructive' | 'purple'}>
          {DRUG_CLASS_LABELS[row.drug_class]}
        </Badge>
      ) : <span className="text-gray-300">—</span>,
    },
    {
      key: 'sell_price',
      header: 'Harga Jual',
      render: (row: Medicine) => (
        <span className="font-medium">{formatCurrency(Number(row.sell_price))}</span>
      ),
    },
    {
      key: 'stock',
      header: 'Stok',
      render: (row: Medicine) => {
        const totalStock = row.medicine_batches
          ?.filter(b => b.status === 'LAYAK_JUAL' || b.status === 'WARNING')
          .reduce((sum, b) => sum + b.quantity, 0) ?? 0
        const isLow = totalStock <= row.min_stock
        return (
          <span className={isLow ? 'font-bold text-red-500' : 'font-medium text-gray-700'}>
            {totalStock} {row.unit}
            {isLow && <span className="ml-1 text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">rendah</span>}
          </span>
        )
      },
    },
    {
      key: 'is_prescription',
      header: 'Resep',
      render: (row: Medicine) => row.is_prescription
        ? <Badge variant="warning">Wajib Resep</Badge>
        : <span className="text-gray-300 text-xs">—</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row: Medicine) => (
        <div className="flex items-center gap-1">
          <Link href={`/medicines/${row.id}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Eye className="w-3.5 h-3.5" />
            </Button>
          </Link>
          {canWrite && (
            <Link href={`/medicines/${row.id}/edit`}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari nama obat atau barcode..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              if (e.target.value.length === 0 || e.target.value.length > 2) {
                setTimeout(() => updateQuery('q', e.target.value), 300)
              }
            }}
            className="pl-9"
          />
        </div>
        <select
          className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchParams.get('drug_class') ?? ''}
          onChange={e => updateQuery('drug_class', e.target.value)}
        >
          <option value="">Semua Golongan</option>
          {Object.entries(DRUG_CLASS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <DataTable
        data={medicines as unknown as Record<string, unknown>[]}
        columns={columns as Parameters<typeof DataTable>[0]['columns']}
        keyField="id"
        emptyMessage="Tidak ada obat ditemukan"
        page={page}
        totalPages={totalPages}
        onPageChange={p => updateQuery('page', String(p))}
      />
    </div>
  )
}
