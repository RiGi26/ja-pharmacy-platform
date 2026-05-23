'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatCurrency } from '@/lib/utils'
import { CheckCircle, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Disposal {
  id: string; type: string; quantity: number; reason: string; status: string
  created_at: string; medicines?: { name: string } | null
  medicine_batches?: { batch_number: string; expiry_date: string } | null
}

interface Props { disposals: Disposal[]; canApprove: boolean; tenantId: string; userId: string }

export function DisposalList({ disposals, canApprove, tenantId, userId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleApprove(disposal: Disposal, approved: boolean) {
    setLoading(disposal.id)
    const supabase = createClient()

    if (approved) {
      // Kurangi stok batch
      const { data: batch } = await supabase
        .from('medicine_batches').select('quantity, medicine_id').eq('id', disposal.id).single()

      if (batch) {
        const newQty = Math.max(0, batch.quantity - disposal.quantity)
        await supabase.from('medicine_batches').update({
          quantity: newQty,
          status: newQty <= 0
            ? 'EMPTY'
            : disposal.type === 'DESTRUCTION' ? 'DISPOSED' : 'RETURNED',
        }).eq('id', disposal.id)

        await supabase.from('stock_movements').insert({
          tenant_id: tenantId,
          medicine_id: batch.medicine_id,
          batch_id: disposal.id,
          type: disposal.type === 'DESTRUCTION' ? 'DISPOSE' : 'RETURN',
          quantity: -disposal.quantity,
          ref_id: disposal.id,
          ref_type: 'disposal',
          note: `${disposal.type === 'DESTRUCTION' ? 'Pemusnahan' : 'Retur'}: ${disposal.reason}`,
          created_by: userId,
        })
      }
    }

    await supabase.from('disposals').update({
      status: approved ? 'APPROVED' : 'REJECTED',
      approved_by: userId,
      approved_at: new Date().toISOString(),
    }).eq('id', disposal.id)

    toast.success(approved ? 'Pengajuan disetujui, stok dikurangi' : 'Pengajuan ditolak')
    setLoading(null)
    router.refresh()
  }

  const columns = [
    {
      key: 'type',
      header: 'Jenis',
      render: (row: Record<string, unknown>) => (
        <Badge variant={row.type === 'DESTRUCTION' ? 'destructive' : 'warning'}>
          {row.type === 'DESTRUCTION' ? '🔥 Pemusnahan' : '↩️ Retur'}
        </Badge>
      ),
    },
    {
      key: 'medicine',
      header: 'Obat',
      render: (row: Record<string, unknown>) => {
        const d = row as unknown as Disposal
        return (
          <div>
            <p className="font-medium text-gray-900">{d.medicines?.name ?? '—'}</p>
            <p className="text-xs text-gray-400 font-mono">
              Batch: {d.medicine_batches?.batch_number ?? '—'}
              {d.medicine_batches?.expiry_date && ` · Exp: ${formatDate(d.medicine_batches.expiry_date)}`}
            </p>
          </div>
        )
      },
    },
    { key: 'quantity', header: 'Qty', render: (row: Record<string, unknown>) => <span className="font-semibold">{String(row.quantity)}</span> },
    { key: 'reason', header: 'Alasan', render: (row: Record<string, unknown>) => <span className="text-sm text-gray-500 max-w-xs truncate block">{String(row.reason)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row: Record<string, unknown>) => ({
        PENDING:  <Badge variant="warning">Menunggu</Badge>,
        APPROVED: <Badge variant="success">Disetujui</Badge>,
        REJECTED: <Badge variant="destructive">Ditolak</Badge>,
      }[String(row.status)] ?? null),
    },
    {
      key: 'created_at',
      header: 'Tanggal',
      render: (row: Record<string, unknown>) => <span className="text-xs text-gray-400">{formatDate(String(row.created_at))}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row: Record<string, unknown>) => {
        const d = row as unknown as Disposal
        if (d.status !== 'PENDING' || !canApprove) return null
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="success" onClick={() => handleApprove(d, true)} disabled={loading === d.id} className="h-7">
              {loading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Setujui
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleApprove(d, false)} disabled={loading === d.id} className="h-7 text-red-500 hover:text-red-600">
              <X className="w-3 h-3" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      data={disposals as unknown as Record<string, unknown>[]}
      columns={columns}
      keyField="id"
      emptyMessage="Belum ada pengajuan retur atau pemusnahan"
    />
  )
}
