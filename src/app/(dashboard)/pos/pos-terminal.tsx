'use client'

import { useState, useCallback } from 'react'
import { usePosStore } from '@/store/pos.store'
import { useBarcodeScanner } from '@/lib/hooks/use-barcode-scanner'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, generateInvoiceNumber } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BatchStatusBadge } from '@/components/shared/batch-status-badge'
import {
  ShoppingCart, Trash2, Plus, Minus, ScanLine,
  CreditCard, Banknote, QrCode, Receipt, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { BatchStatus } from '@/types'

interface Props {
  cashierName: string
  tenantId: string
  userId: string
}

export function PosTerminal({ cashierName, tenantId, userId }: Props) {
  const store = usePosStore()
  const [processing, setProcessing] = useState(false)
  const [lastScan, setLastScan] = useState<string>('')
  const [checkoutMode, setCheckoutMode] = useState(false)

  const lookupBarcode = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return
    setLastScan(barcode)

    const supabase = createClient()
    const { data: medicine } = await supabase
      .from('medicines')
      .select('*, medicine_batches(id, quantity, buy_price, status, expiry_date, discount_pct)')
      .eq('tenant_id', tenantId)
      .eq('barcode', barcode)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (!medicine) {
      toast.error(`Obat dengan barcode "${barcode}" tidak ditemukan`)
      return
    }

    // Pick best batch: FIFO (oldest expiry first) that is LAYAK_JUAL or WARNING
    const availableBatches = (medicine.medicine_batches ?? [])
      .filter((b: { status: string; quantity: number }) => b.status !== 'DILARANG_JUAL' && b.status !== 'DISPOSED' && b.status !== 'RETURNED' && b.quantity > 0)
      .sort((a: { expiry_date: string }, b: { expiry_date: string }) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())

    if (availableBatches.length === 0) {
      toast.error(`${medicine.name}: Stok habis atau semua batch dilarang dijual`)
      return
    }

    const batch = availableBatches[0] as { id: string; quantity: number; status: string; discount_pct: number }

    if (batch.status === 'WARNING') {
      toast('⚠️ Batch obat ini mendekati kedaluwarsa', { icon: '⚠️' })
    }

    store.addItem({
      medicine_id: medicine.id,
      batch_id: batch.id,
      name: medicine.name,
      barcode: medicine.barcode,
      unit: medicine.unit ?? 'pcs',
      unit_price: Number(medicine.sell_price),
      quantity: 1,
      discount_pct: batch.discount_pct,
      is_prescription: medicine.is_prescription,
      batch_status: batch.status,
      max_qty: batch.quantity,
    })
  }, [tenantId, store])

  useBarcodeScanner({ onScan: lookupBarcode, enabled: !checkoutMode })

  async function handleCheckout() {
    if (store.cart.length === 0) { toast.error('Keranjang kosong'); return }

    if (store.hasRequiresPrescription && !store.prescriptionNumber.trim()) {
      toast.error('Nomor resep wajib diisi untuk obat keras/resep')
      return
    }

    if (store.paymentMethod === 'cash' && store.paidAmount < store.total) {
      toast.error('Uang yang dibayar kurang')
      return
    }

    setProcessing(true)
    const supabase = createClient()

    try {
      const invoiceNumber = generateInvoiceNumber('JA')

      // Validate stock still available (server-side check)
      for (const item of store.cart) {
        const { data: batch } = await supabase
          .from('medicine_batches')
          .select('quantity, status')
          .eq('id', item.batch_id)
          .single()

        if (!batch || batch.quantity < item.quantity) {
          toast.error(`Stok ${item.name} tidak mencukupi (tersisa: ${batch?.quantity ?? 0})`)
          setProcessing(false)
          return
        }
        if (batch.status === 'DILARANG_JUAL') {
          toast.error(`${item.name}: Batch ini dilarang dijual`)
          setProcessing(false)
          return
        }
      }

      // Create transaction
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          tenant_id: tenantId,
          invoice_number: invoiceNumber,
          cashier_id: userId,
          payment_method: store.paymentMethod,
          subtotal: store.subtotal,
          discount: store.discount,
          total: store.total,
          paid_amount: store.paymentMethod === 'cash' ? store.paidAmount : store.total,
          change_amount: store.paymentMethod === 'cash' ? store.change : 0,
          status: 'COMPLETED',
        })
        .select()
        .single()

      if (txError || !tx) throw new Error(txError?.message ?? 'Transaksi gagal dibuat')

      // Insert transaction items + reduce stock
      for (const item of store.cart) {
        await supabase.from('transaction_items').insert({
          tenant_id: tenantId,
          transaction_id: tx.id,
          medicine_id: item.medicine_id,
          batch_id: item.batch_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_pct: item.discount_pct,
          subtotal: item.subtotal,
        })

        // Reduce batch quantity
        const { data: batchNow } = await supabase
          .from('medicine_batches')
          .select('quantity')
          .eq('id', item.batch_id)
          .single()

        const newQty = (batchNow?.quantity ?? 0) - item.quantity
        await supabase.from('medicine_batches').update({
          quantity: newQty,
          status: newQty <= 0 ? 'EMPTY' : undefined,
        }).eq('id', item.batch_id)

        // Stock movement
        await supabase.from('stock_movements').insert({
          tenant_id: tenantId,
          medicine_id: item.medicine_id,
          batch_id: item.batch_id,
          type: 'OUT',
          quantity: -item.quantity,
          ref_id: tx.id,
          ref_type: 'transaction',
          note: `Penjualan ${invoiceNumber}`,
          created_by: userId,
        })
      }

      toast.success(`Transaksi ${invoiceNumber} berhasil!`)

      // Fire-and-forget low stock check
      const soldMedicineIds = [...new Set(store.cart.map(i => i.medicine_id))]
      fetch('/api/notifications/low-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, medicineIds: soldMedicineIds }),
      }).catch(() => {})

      store.clearCart()
      setCheckoutMode(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transaksi gagal')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900">POS Kasir</span>
          <span className="text-xs text-gray-400">— {cashierName}</span>
        </div>
        {lastScan && <span className="text-xs text-gray-400 font-mono">Last scan: {lastScan}</span>}
        <div className="text-xs text-gray-400">
          {store.cart.length} item · {formatCurrency(store.total)}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Cart */}
        <div className="flex-1 overflow-y-auto p-4">
          {store.cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingCart className="w-16 h-16 mb-3" />
              <p className="text-sm font-medium">Scan barcode untuk tambah obat</p>
              <p className="text-xs mt-1">atau tekan barcode scanner</p>
            </div>
          ) : (
            <div className="space-y-2 max-w-2xl mx-auto">
              {store.cart.map(item => (
                <div key={item.batch_id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                      {item.batch_status === 'WARNING' && (
                        <BatchStatusBadge status={item.batch_status as BatchStatus} />
                      )}
                      {item.is_prescription && (
                        <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">Resep</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatCurrency(item.unit_price)} / {item.unit}
                      {item.discount_pct > 0 && <span className="ml-1 text-green-600">Diskon {item.discount_pct}%</span>}
                    </p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="icon" className="h-7 w-7"
                      onClick={() => store.updateQty(item.batch_id, item.quantity - 1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <Button
                      variant="outline" size="icon" className="h-7 w-7"
                      onClick={() => store.updateQty(item.batch_id, item.quantity + 1)}
                      disabled={item.quantity >= item.max_qty}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="text-right w-24 flex-shrink-0">
                    <p className="font-semibold text-sm text-gray-900">{formatCurrency(item.subtotal)}</p>
                  </div>

                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-gray-300 hover:text-red-500"
                    onClick={() => store.removeItem(item.batch_id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout Panel */}
        <div className="w-80 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Pembayaran
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Summary */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span><span>{formatCurrency(store.subtotal)}</span>
              </div>
              {store.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Diskon</span><span>-{formatCurrency(store.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-100">
                <span>Total</span><span>{formatCurrency(store.total)}</span>
              </div>
            </div>

            {/* Prescription number if needed */}
            {store.hasRequiresPrescription && (
              <div>
                <label className="block text-xs font-semibold text-orange-500 mb-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Nomor Resep *
                </label>
                <Input
                  placeholder="R/ ..."
                  value={store.prescriptionNumber}
                  onChange={e => store.setPrescriptionNumber(e.target.value)}
                  className="border-orange-200 focus:ring-orange-400"
                />
              </div>
            )}

            {/* Payment method */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Metode Bayar</p>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { key: 'cash', label: 'Tunai', icon: Banknote },
                  { key: 'qris', label: 'QRIS', icon: QrCode },
                  { key: 'transfer', label: 'Transfer', icon: CreditCard },
                ] as const).map(m => (
                  <button
                    key={m.key}
                    onClick={() => store.setPaymentMethod(m.key)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-colors ${
                      store.paymentMethod === m.key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <m.icon className="w-4 h-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash input */}
            {store.paymentMethod === 'cash' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Uang Diterima</label>
                <Input
                  type="number"
                  min={store.total}
                  step={1000}
                  value={store.paidAmount || ''}
                  onChange={e => store.setPaidAmount(Number(e.target.value))}
                  placeholder={String(store.total)}
                />
                {store.paidAmount >= store.total && (
                  <div className="mt-2 p-2 bg-green-50 rounded-lg text-sm font-semibold text-green-700">
                    Kembalian: {formatCurrency(store.change)}
                  </div>
                )}
                {/* Quick cash buttons */}
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {[store.total, Math.ceil(store.total / 10000) * 10000, Math.ceil(store.total / 50000) * 50000].map(v => (
                    <button
                      key={v}
                      onClick={() => store.setPaidAmount(v)}
                      className="text-xs py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
                    >
                      {formatCurrency(v)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-gray-100 space-y-2">
            <Button
              className="w-full h-12 text-base"
              onClick={handleCheckout}
              disabled={processing || store.cart.length === 0}
            >
              {processing ? 'Memproses...' : `Bayar ${formatCurrency(store.total)}`}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => store.clearCart()}
              disabled={store.cart.length === 0}
            >
              <Trash2 className="w-4 h-4" />
              Batal Transaksi
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
