'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/page-header'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Clock, DollarSign, ShoppingCart, Loader2, CheckCircle, PlayCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Shift {
  id: string
  opening_balance: number
  opened_at: string
  total_transactions: number
  total_cash: number
  total_qris: number
  total_transfer: number
}

interface Props {
  activeShift: Shift | null
  tenantId: string
  userId: string
  cashierName: string
}

export function ShiftManager({ activeShift, tenantId, userId, cashierName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [openingBalance, setOpeningBalance] = useState('')
  const [closingNotes, setClosingNotes] = useState('')

  async function handleOpenShift() {
    const balance = Number(openingBalance)
    if (isNaN(balance) || balance < 0) { toast.error('Saldo awal tidak valid'); return }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('shifts').insert({
      tenant_id: tenantId,
      cashier_id: userId,
      opening_balance: balance,
    })

    if (error) { toast.error(error.message); setLoading(false); return }

    toast.success('Shift berhasil dibuka')
    router.push('/pos')
    router.refresh()
  }

  async function handleCloseShift() {
    if (!activeShift) return
    setLoading(true)
    const supabase = createClient()

    // Hitung total dari transaksi dalam shift ini
    const { data: txs } = await supabase
      .from('transactions')
      .select('total, payment_method')
      .eq('tenant_id', tenantId)
      .eq('shift_id', activeShift.id)
      .eq('status', 'COMPLETED')

    const totalCash = txs?.filter(t => t.payment_method === 'cash').reduce((s, t) => s + Number(t.total), 0) ?? 0
    const totalQris = txs?.filter(t => t.payment_method === 'qris').reduce((s, t) => s + Number(t.total), 0) ?? 0
    const totalTransfer = txs?.filter(t => t.payment_method === 'transfer').reduce((s, t) => s + Number(t.total), 0) ?? 0
    const totalTx = txs?.length ?? 0
    const closingBalance = Number(activeShift.opening_balance) + totalCash

    const { error } = await supabase
      .from('shifts')
      .update({
        closed_at: new Date().toISOString(),
        closing_balance: closingBalance,
        total_transactions: totalTx,
        total_cash: totalCash,
        total_qris: totalQris,
        total_transfer: totalTransfer,
        notes: closingNotes || null,
      })
      .eq('id', activeShift.id)

    if (error) { toast.error(error.message); setLoading(false); return }

    // Kirim WA rekap ke Owner
    await fetch('/api/notifications/shift-recap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        cashierName,
        totalTx,
        totalCash,
        totalQris,
        totalTransfer,
        closingBalance,
        openingBalance: activeShift.opening_balance,
      }),
    })

    toast.success('Shift berhasil ditutup')
    router.push('/dashboard')
    router.refresh()
  }

  if (activeShift) {
    const duration = Math.floor((Date.now() - new Date(activeShift.opened_at).getTime()) / 60000)
    const hours = Math.floor(duration / 60)
    const mins = duration % 60

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <PageHeader title="Tutup Shift" description={`Shift dibuka ${formatDateTime(activeShift.opened_at)}`} />

        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: 'Durasi Shift', value: `${hours}j ${mins}m`, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Transaksi', value: activeShift.total_transactions, icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Saldo Awal', value: formatCurrency(Number(activeShift.opening_balance)), icon: DollarSign, color: 'text-gray-600', bg: 'bg-gray-50' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
                  <p className="text-lg font-bold text-gray-900">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-4">
          <CardHeader><CardTitle>Rekap Pembayaran (estimasi real-time)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Total Tunai (cash)', value: formatCurrency(Number(activeShift.total_cash)) },
                { label: 'Total QRIS', value: formatCurrency(Number(activeShift.total_qris)) },
                { label: 'Total Transfer', value: formatCurrency(Number(activeShift.total_transfer)) },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-semibold text-gray-900">{r.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Catatan (opsional)</label>
            <Input
              placeholder="Catatan penutupan shift..."
              value={closingNotes}
              onChange={e => setClosingNotes(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/pos')} className="flex-1">
            Kembali ke Kasir
          </Button>
          <Button
            variant="destructive"
            onClick={handleCloseShift}
            disabled={loading}
            className="flex-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Tutup Shift
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <PageHeader title="Buka Shift Kasir" description={`Kasir: ${cashierName}`} />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><PlayCircle className="w-4 h-4 text-green-500" />Mulai Shift Baru</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Saldo Awal Kas (Rp)
            </label>
            <Input
              type="number"
              min={0}
              step={50000}
              placeholder="Contoh: 500000"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">Uang tunai yang ada di laci kasir saat ini</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[100000, 200000, 500000].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setOpeningBalance(String(v))}
                className="py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
              >
                {formatCurrency(v)}
              </button>
            ))}
          </div>

          <Button onClick={handleOpenShift} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            Buka Shift
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
