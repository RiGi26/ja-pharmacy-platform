'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { generateInternalBarcode } from '@/lib/utils'
import { Loader2, Barcode } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Database } from '@/types/database'

type MedicineInsert = Database['public']['Tables']['medicines']['Insert']
type MedicineRow = Database['public']['Tables']['medicines']['Row']

interface Props {
  medicine?: MedicineRow
  tenantId?: string
}

const DRUG_CLASSES = [
  { value: 'bebas', label: 'Bebas' },
  { value: 'bebas_terbatas', label: 'Bebas Terbatas' },
  { value: 'keras', label: 'Keras' },
  { value: 'psikotropika', label: 'Psikotropika' },
  { value: 'narkotika', label: 'Narkotika' },
]

const UNITS = ['Tablet', 'Kapsul', 'Botol', 'Sachet', 'Ampul', 'Tube', 'Strip', 'Pcs', 'Box', 'Vial']

export function MedicineForm({ medicine, tenantId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<MedicineInsert>>({
    name: medicine?.name ?? '',
    generic_name: medicine?.generic_name ?? '',
    barcode: medicine?.barcode ?? '',
    category: medicine?.category ?? '',
    drug_class: medicine?.drug_class ?? undefined,
    unit: medicine?.unit ?? 'Tablet',
    sell_price: medicine?.sell_price ?? 0,
    rack_location: medicine?.rack_location ?? '',
    min_stock: medicine?.min_stock ?? 10,
    is_prescription: medicine?.is_prescription ?? false,
  })

  const set = (key: keyof typeof form, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) { toast.error('Nama obat wajib diisi'); return }

    setLoading(true)
    const supabase = createClient()

    if (medicine) {
      // Edit mode — also record price history if price changed
      const oldPrice = Number(medicine.sell_price)
      const newPrice = Number(form.sell_price)

      const { error } = await supabase
        .from('medicines')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', medicine.id)

      if (error) { toast.error(error.message); setLoading(false); return }

      if (oldPrice !== newPrice) {
        await supabase.from('price_histories').insert({
          medicine_id: medicine.id,
          tenant_id: medicine.tenant_id,
          old_sell_price: oldPrice,
          new_sell_price: newPrice,
          changed_by: (await supabase.auth.getUser()).data.user!.id,
        })
      }

      toast.success('Obat berhasil diperbarui')
    } else {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
        .single()

      const { error } = await supabase
        .from('medicines')
        .insert({ ...form, tenant_id: profile!.tenant_id } as MedicineInsert)

      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Obat berhasil ditambahkan')
    }

    router.push('/medicines')
    router.refresh()
  }

  const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )

  const selectClass = 'h-10 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Informasi Dasar</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nama Obat" required>
            <Input value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Paracetamol 500mg" />
          </Field>
          <Field label="Nama Generik">
            <Input value={form.generic_name ?? ''} onChange={e => set('generic_name', e.target.value)} placeholder="Acetaminophen" />
          </Field>
          <Field label="Barcode">
            <div className="flex gap-2">
              <Input value={form.barcode ?? ''} onChange={e => set('barcode', e.target.value)} placeholder="8991234567890" className="flex-1" />
              <Button
                type="button" variant="outline" size="icon"
                onClick={() => set('barcode', generateInternalBarcode('JA'))}
                title="Generate barcode internal"
              >
                <Barcode className="w-4 h-4" />
              </Button>
            </div>
          </Field>
          <Field label="Kategori">
            <Input value={form.category ?? ''} onChange={e => set('category', e.target.value)} placeholder="Analgesik" />
          </Field>
          <Field label="Golongan Obat">
            <select className={selectClass} value={form.drug_class ?? ''} onChange={e => set('drug_class', e.target.value || undefined)}>
              <option value="">— Pilih Golongan —</option>
              {DRUG_CLASSES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Satuan">
            <select className={selectClass} value={form.unit ?? 'Tablet'} onChange={e => set('unit', e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Harga & Stok</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Harga Jual (Rp)" required>
            <Input
              type="number" min={0} step={100}
              value={form.sell_price ?? 0}
              onChange={e => set('sell_price', Number(e.target.value))}
            />
          </Field>
          <Field label="Stok Minimum Alert">
            <Input
              type="number" min={0}
              value={form.min_stock ?? 10}
              onChange={e => set('min_stock', Number(e.target.value))}
            />
          </Field>
          <Field label="Lokasi Rak">
            <Input value={form.rack_location ?? ''} onChange={e => set('rack_location', e.target.value)} placeholder="Rak A-3" />
          </Field>
          <Field label="Wajib Resep Dokter">
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-blue-600"
                checked={form.is_prescription ?? false}
                onChange={e => set('is_prescription', e.target.checked)}
              />
              <span className="text-sm text-gray-600">Obat ini memerlukan resep dokter</span>
            </label>
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {medicine ? 'Simpan Perubahan' : 'Tambah Obat'}
        </Button>
      </div>
    </form>
  )
}
