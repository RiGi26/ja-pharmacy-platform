'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ScanLine, Package } from 'lucide-react'
import { getDaysUntilExpiry } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database'

type Medicine = Database['public']['Tables']['medicines']['Row']
type Supplier = Database['public']['Tables']['suppliers']['Row']

export function StockInForm() {
  const router = useRouter()
  const barcodeRef = useRef<HTMLInputElement>(null)
  const [barcode, setBarcode] = useState('')
  const [medicine, setMedicine] = useState<Medicine | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  const [form, setForm] = useState({
    batch_number: '',
    supplier_id: '',
    expiry_date: '',
    quantity: 1,
    buy_price: 0,
  })

  const set = (key: keyof typeof form, value: string | number) =>
    setForm(f => ({ ...f, [key]: value }))

  useEffect(() => {
    barcodeRef.current?.focus()
    const supabase = createClient()
    supabase.from('user_profiles')
      .select('tenant_id')
      .eq('user_id', (async () => (await supabase.auth.getUser()).data.user!.id)() as unknown as string)
      .single()
      .then(async ({ data: profile }) => {
        if (!profile) return
        const { data } = await supabase
          .from('suppliers')
          .select('*')
          .eq('tenant_id', profile.tenant_id)
          .eq('is_active', true)
          .order('name')
        setSuppliers(data ?? [])
      })
  }, [])

  async function handleBarcodeSearch(code: string) {
    if (!code.trim()) return
    setSearching(true)
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
      .single()

    const { data } = await supabase
      .from('medicines')
      .select('*')
      .eq('tenant_id', profile!.tenant_id)
      .eq('barcode', code.trim())
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    setSearching(false)
    if (!data) {
      toast.error('Obat dengan barcode ini tidak ditemukan')
      return
    }
    setMedicine(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!medicine) { toast.error('Pilih obat terlebih dahulu'); return }
    if (!form.batch_number.trim()) { toast.error('Nomor batch wajib diisi'); return }
    if (!form.expiry_date) { toast.error('Tanggal expired wajib diisi'); return }
    if (form.quantity < 1) { toast.error('Jumlah harus minimal 1'); return }

    const daysLeft = getDaysUntilExpiry(form.expiry_date)
    if (daysLeft < 0) { toast.error('Tanggal expired sudah lewat'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('user_id', user!.id)
      .single()

    // Determine batch status
    const status = daysLeft <= 30 ? 'DILARANG_JUAL' : daysLeft <= 90 ? 'WARNING' : 'LAYAK_JUAL'

    // Insert batch
    const { data: batch, error } = await supabase
      .from('medicine_batches')
      .insert({
        tenant_id: profile!.tenant_id,
        medicine_id: medicine.id,
        batch_number: form.batch_number,
        supplier_id: form.supplier_id || null,
        expiry_date: form.expiry_date,
        quantity: form.quantity,
        buy_price: form.buy_price,
        status,
      })
      .select()
      .single()

    if (error) { toast.error(error.message); setLoading(false); return }

    // Record stock movement
    await supabase.from('stock_movements').insert({
      tenant_id: profile!.tenant_id,
      medicine_id: medicine.id,
      batch_id: batch.id,
      type: 'IN',
      quantity: form.quantity,
      ref_id: batch.id,
      ref_type: 'batch',
      note: `Barang masuk batch ${form.batch_number}`,
      created_by: user!.id,
    })

    toast.success(`${form.quantity} ${medicine.unit} berhasil ditambahkan ke stok`)
    router.push('/inventory')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Barcode scan */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="w-4 h-4" />Scan/Input Barcode</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              ref={barcodeRef}
              placeholder="Scan barcode atau ketik manual..."
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleBarcodeSearch(barcode) } }}
            />
            <Button type="button" onClick={() => handleBarcodeSearch(barcode)} disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cari'}
            </Button>
          </div>
          {medicine && (
            <div className="mt-3 p-3 bg-blue-50 rounded-xl flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-900">{medicine.name}</p>
                <p className="text-xs text-blue-600">{medicine.generic_name} · {medicine.unit} · Rp{Number(medicine.sell_price).toLocaleString('id')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch detail */}
      {medicine && (
        <Card>
          <CardHeader><CardTitle>Detail Batch</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Nomor Batch *', key: 'batch_number', type: 'text', placeholder: 'BC202501001' },
              { label: 'Jumlah *', key: 'quantity', type: 'number', min: 1 },
              { label: 'Harga Beli (Rp)', key: 'buy_price', type: 'number', min: 0 },
              { label: 'Tanggal Expired *', key: 'expiry_date', type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{f.label}</label>
                <Input
                  type={f.type}
                  min={f.min}
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => set(f.key as keyof typeof form, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Supplier</label>
              <select
                className="h-10 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm"
                value={form.supplier_id}
                onChange={e => set('supplier_id', e.target.value)}
              >
                <option value="">— Tanpa Supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {form.expiry_date && (
              <div className="sm:col-span-2">
                {(() => {
                  const d = getDaysUntilExpiry(form.expiry_date)
                  const cls = d <= 30 ? 'bg-red-50 text-red-600 border-red-200' : d <= 90 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-green-50 text-green-600 border-green-200'
                  return (
                    <div className={`p-3 rounded-xl border text-sm font-medium ${cls}`}>
                      {d < 0 ? `⚠️ Sudah expired ${Math.abs(d)} hari lalu` : d <= 30 ? `🚫 DILARANG_JUAL — H-${d} (tidak bisa dijual)` : d <= 90 ? `⚠️ WARNING — H-${d}` : `✓ Layak Jual — H-${d}`}
                    </div>
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
        <Button type="submit" disabled={loading || !medicine}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Simpan Stok Masuk
        </Button>
      </div>
    </form>
  )
}
