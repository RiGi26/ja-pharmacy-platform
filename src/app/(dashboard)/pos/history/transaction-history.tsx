'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Eye, Ban, CheckCircle, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface TxItem { medicine_id: string; quantity: number; batch_id: string; subtotal: number; medicines?: { name: string } }
interface Transaction {
  id: string; invoice_number: string; payment_method: string; total: number
  status: string; created_at: string; transaction_items?: TxItem[]
  void_reason?: string
}

interface Props {
  transactions: Transaction[]
  totalPages: number
  page: number
  date: string
  canApproveVoid: boolean
  tenantId: string
  userId: string
}

type ModalState =
  | { type: 'detail'; tx: Transaction }
  | { type: 'void-request'; tx: Transaction }
  | { type: 'void-approve'; tx: Transaction }
  | null

export function TransactionHistory({ transactions, totalPages, page, date, canApproveVoid, tenantId, userId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [modal, setModal] = useState<ModalState>(null)
  const [voidReason, setVoidReason] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const VOID_PIN = '1234' // TODO: per-tenant PIN dari settings

  async function handleVoidRequest(tx: Transaction) {
    if (!voidReason.trim()) { toast.error('Alasan void wajib diisi'); return }
    setLoading(true)
    const supabase = createClient()

    await supabase.from('transactions')
      .update({ status: 'PENDING_VOID', void_reason: voidReason })
      .eq('id', tx.id)

    await fetch('/api/notifications/void-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, invoiceNumber: tx.invoice_number, reason: voidReason }),
    })

    toast.success('Request void dikirim ke Admin/Owner')
    setModal(null)
    setVoidReason('')
    setLoading(false)
    router.refresh()
  }

  async function handleVoidApprove(tx: Transaction) {
    if (pin !== VOID_PIN) { toast.error('PIN salah'); return }
    setLoading(true)
    const supabase = createClient()

    // Rollback stok
    const items = tx.transaction_items ?? []
    for (const item of items) {
      const { data: batch } = await supabase
        .from('medicine_batches')
        .select('quantity, status')
        .eq('id', item.batch_id)
        .single()

      if (batch) {
        const newQty = batch.quantity + item.quantity
        await supabase.from('medicine_batches').update({
          quantity: newQty,
          status: batch.status === 'EMPTY' ? 'LAYAK_JUAL' : batch.status,
        }).eq('id', item.batch_id)

        await supabase.from('stock_movements').insert({
          tenant_id: tenantId,
          medicine_id: item.medicine_id,
          batch_id: item.batch_id,
          type: 'VOID_ROLLBACK',
          quantity: item.quantity,
          ref_id: tx.id,
          ref_type: 'transaction',
          note: `Void transaksi ${tx.invoice_number}`,
          created_by: userId,
        })
      }
    }

    await supabase.from('transactions').update({
      status: 'VOIDED',
      void_by: userId,
    }).eq('id', tx.id)

    await fetch('/api/notifications/void-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, invoiceNumber: tx.invoice_number }),
    })

    toast.success(`Transaksi ${tx.invoice_number} berhasil di-void, stok dikembalikan`)
    setModal(null)
    setPin('')
    setLoading(false)
    router.refresh()
  }

  const STATUS_BADGE: Record<string, React.ReactNode> = {
    COMPLETED:   <Badge variant="success">Selesai</Badge>,
    VOIDED:      <Badge variant="destructive">Void</Badge>,
    PENDING_VOID:<Badge variant="warning">Pending Void</Badge>,
  }

  const PAYMENT_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }

  const columns = [
    {
      key: 'invoice_number',
      header: 'No. Invoice',
      render: (row: Record<string, unknown>) => (
        <span className="font-mono text-xs font-medium text-gray-700">{String(row.invoice_number)}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Waktu',
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-gray-500">{formatDateTime(String(row.created_at))}</span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Metode',
      render: (row: Record<string, unknown>) => (
        <Badge variant="secondary">{PAYMENT_LABEL[String(row.payment_method)] ?? String(row.payment_method)}</Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row: Record<string, unknown>) => (
        <span className="font-semibold text-gray-900">{formatCurrency(Number(row.total))}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Record<string, unknown>) => STATUS_BADGE[String(row.status)] ?? String(row.status),
    },
    {
      key: 'actions',
      header: '',
      render: (row: Record<string, unknown>) => {
        const tx = row as unknown as Transaction
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModal({ type: 'detail', tx })}>
              <Eye className="w-3.5 h-3.5" />
            </Button>
            {tx.status === 'COMPLETED' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                onClick={() => setModal({ type: 'void-request', tx })}>
                <Ban className="w-3.5 h-3.5" />
              </Button>
            )}
            {tx.status === 'PENDING_VOID' && canApproveVoid && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500 hover:text-green-600"
                onClick={() => setModal({ type: 'void-approve', tx })}>
                <CheckCircle className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="date"
          value={date}
          onChange={e => router.push(`${pathname}?date=${e.target.value}`)}
          className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <DataTable
        data={transactions as unknown as Record<string, unknown>[]}
        columns={columns}
        keyField="id"
        emptyMessage="Tidak ada transaksi pada tanggal ini"
        page={page}
        totalPages={totalPages}
        onPageChange={p => router.push(`${pathname}?date=${date}&page=${p}`)}
      />

      {/* Modal Detail */}
      {modal?.type === 'detail' && (
        <Modal title={`Detail ${modal.tx.invoice_number}`} onClose={() => setModal(null)}>
          <div className="space-y-2">
            {(modal.tx.transaction_items ?? []).map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-700">{item.medicines?.name ?? '—'} ×{item.quantity}</span>
                <span className="font-medium">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-base pt-2">
              <span>Total</span>
              <span>{formatCurrency(modal.tx.total)}</span>
            </div>
            {modal.tx.void_reason && (
              <p className="text-sm text-red-500 mt-2">Alasan void: {modal.tx.void_reason}</p>
            )}
          </div>
        </Modal>
      )}

      {/* Modal Void Request */}
      {modal?.type === 'void-request' && (
        <Modal title="Request Void Transaksi" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-500 mb-4">
            Void <strong>{modal.tx.invoice_number}</strong> — {formatCurrency(modal.tx.total)}
          </p>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Alasan Void *</label>
          <Input
            placeholder="Contoh: Salah input item..."
            value={voidReason}
            onChange={e => setVoidReason(e.target.value)}
            className="mb-4"
          />
          <Button onClick={() => handleVoidRequest(modal.tx)} disabled={loading} className="w-full" variant="destructive">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Kirim Request Void
          </Button>
        </Modal>
      )}

      {/* Modal Void Approve */}
      {modal?.type === 'void-approve' && (
        <Modal title="Approve Void" onClose={() => setModal(null)}>
          <div className="bg-amber-50 rounded-xl p-3 mb-4">
            <p className="text-sm font-medium text-amber-800">{modal.tx.invoice_number}</p>
            <p className="text-xs text-amber-600 mt-0.5">Alasan: {modal.tx.void_reason}</p>
          </div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">PIN Konfirmasi *</label>
          <Input
            type="password"
            placeholder="••••"
            value={pin}
            onChange={e => setPin(e.target.value)}
            maxLength={6}
            className="mb-4 text-center tracking-widest text-lg"
          />
          <Button onClick={() => handleVoidApprove(modal.tx)} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Approve & Rollback Stok
          </Button>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
