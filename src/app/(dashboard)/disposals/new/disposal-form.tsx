'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BatchStatusBadge } from '@/components/shared/batch-status-badge'
import { formatDate } from '@/lib/utils'
import { Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import type { BatchStatus } from '@/types'

export function DisposalForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [medicines, setMedicines] = useState<{ id: string; name: string; medicine_batches: { id: string; batch_number: string; expiry_date: string; quantity: number; status: string }[] }[]>([])
  const [tenantId, setTenantId] = useState('')
  const [userId, setUserId] = useState('')

  const [form, setForm] = useState({
    type: 'DESTRUCTION' as 'DESTRUCTION' | 'RETURN',
    medicine_id: '',
    batch_id: '',
    quantity: 1,
    reason: '',
    supplier_id: '',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('user_profiles').select('tenant_id').eq('user_id', user.id).single()
      if (profile) setTenantId(profile.tenant_id)
    })
  }, [])

  useEffect(() => {
    if (!tenantId || searchQ.length < 2) return
    const supabase = createClient()
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('medicines')
        .select('id, name, medicine_batches(id, batch_number, expiry_date, quantity, status)')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${searchQ}%`)
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(10)
      setMedicines(data ?? [])
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQ, tenantId])

  const selectedMedicine = medicines.find(m => m.id === form.medicine_id)
  const selectedBatch = selectedMedicine?.medicine_batches.find(b => b.id === form.batch_id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.medicine_id || !form.batch_id) { toast.error('Pilih obat dan batch'); return }
    if (!form.reason.trim()) { toast.error('Alasan wajib diisi'); return }
    if (selectedBatch && form.quantity > selectedBatch.quantity) {
      toast.error(`Qty melebihi stok tersedia (${selectedBatch.quantity})`); return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('disposals').insert({
      tenant_id: tenantId,
      type: form.type,
      medicine_id: form.medicine_id,
      batch_id: form.batch_id,
      quantity: form.quantity,
      reason: form.reason,
      submitted_by: userId,
      supplier_id: form.supplier_id || null,
    })

    if (error) { toast.error(error.message); setLoading(false); return }

    await fetch('/api/notifications/disposal-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        type: form.type,
        medicineName: selectedMedicine?.name,
        quantity: form.quantity,
        reason: form.reason,
      }),
    })

    toast.success('Pengajuan berhasil dikirim, menunggu persetujuan Admin/Owner')
    router.push('/disposals')
    router.refresh()
  }

  const sel = 'h-10 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Jenis Pengajuan</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {(['DESTRUCTION', 'RETURN'] as const).map(t => (
              <button
                key={t} type="button"
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${form.type === t ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <p className="font-semibold text-sm">{t === 'DESTRUCTION' ? '🔥 Pemusnahan' : '↩️ Retur ke Distributor'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t === 'DESTRUCTION' ? 'Obat expired, rusak, atau recall' : 'Kembalikan ke supplier/distributor'}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pilih Obat & Batch</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Cari nama obat..."
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setForm(f => ({ ...f, medicine_id: '', batch_id: '' })) }}
              className="pl-9"
            />
          </div>

          {medicines.length > 0 && !form.medicine_id && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {medicines.map(m => (
                <button key={m.id} type="button"
                  onClick={() => { setForm(f => ({ ...f, medicine_id: m.id, batch_id: '' })); setSearchQ(m.name) }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm">
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {form.medicine_id && selectedMedicine && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Pilih Batch</label>
              <select className={sel} value={form.batch_id} onChange={e => setForm(f => ({ ...f, batch_id: e.target.value }))}>
                <option value="">— Pilih Batch —</option>
                {selectedMedicine.medicine_batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number} · Exp: {formatDate(b.expiry_date)} · Stok: {b.quantity} · {b.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedBatch && (
            <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-3">
              <BatchStatusBadge status={selectedBatch.status as BatchStatus} />
              <span className="text-sm text-gray-600">Stok tersedia: <strong>{selectedBatch.quantity}</strong></span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Jumlah *</label>
            <Input
              type="number" min={1} max={selectedBatch?.quantity ?? 9999}
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Alasan *</label>
            <Input
              placeholder={form.type === 'DESTRUCTION' ? 'Contoh: Expired, tidak bisa dijual' : 'Contoh: Batch recall dari distributor'}
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Kirim Pengajuan
        </Button>
      </div>
    </form>
  )
}
