'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Loader2, Search, AlertTriangle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Batch {
  id: string
  batch_number: string
  quantity: number
  expiry_date: string
  medicine_id: string
  medicines: { name: string; unit: string } | null
}

interface Props {
  batches: Batch[]
  tenantId: string
  userId: string
}

export function StockOpnameForm({ batches, tenantId, userId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  // Map batchId → physical count entered by user
  const [counts, setCounts] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    if (!search) return batches
    const q = search.toLowerCase()
    return batches.filter(b => b.medicines?.name.toLowerCase().includes(q) || b.batch_number.toLowerCase().includes(q))
  }, [batches, search])

  function getPhysical(batchId: string) {
    const v = counts[batchId]
    if (v === undefined || v === '') return null
    const n = Number(v)
    return isNaN(n) ? null : n
  }

  function getDiff(batch: Batch) {
    const phys = getPhysical(batch.id)
    if (phys === null) return null
    return phys - batch.quantity
  }

  const adjustments = batches.filter(b => {
    const diff = getDiff(b)
    return diff !== null && diff !== 0
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (adjustments.length === 0) {
      toast.error('Tidak ada selisih stok yang perlu disesuaikan')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const sessionLabel = `Opname ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`

    const errors: string[] = []

    for (const batch of adjustments) {
      const phys = getPhysical(batch.id)!
      const diff = phys - batch.quantity

      // Update batch quantity
      const { error: updateErr } = await supabase
        .from('medicine_batches')
        .update({ quantity: phys, status: phys <= 0 ? 'EMPTY' : undefined })
        .eq('id', batch.id)

      if (updateErr) { errors.push(batch.batch_number); continue }

      // Record stock movement
      await supabase.from('stock_movements').insert({
        tenant_id: tenantId,
        medicine_id: batch.medicine_id,
        batch_id: batch.id,
        type: 'ADJUST',
        quantity: diff,
        ref_type: 'opname',
        note: `${sessionLabel} · Batch ${batch.batch_number} · Sistem: ${batch.quantity} → Fisik: ${phys}`,
        created_by: userId,
      })
    }

    if (errors.length > 0) {
      toast.error(`Gagal memperbarui batch: ${errors.join(', ')}`)
    } else {
      toast.success(`${adjustments.length} batch berhasil disesuaikan`)
    }

    setLoading(false)
    router.push('/stock-opname')
    router.refresh()
  }

  const enteredCount = Object.values(counts).filter(v => v !== '').length
  const diffCount = adjustments.length

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 relative min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Cari nama obat atau no. batch..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-3 text-sm text-gray-500">
              <span>Total batch: <strong className="text-gray-900">{batches.length}</strong></span>
              <span>Diisi: <strong className="text-blue-600">{enteredCount}</strong></span>
              <span>Selisih: <strong className={diffCount > 0 ? 'text-amber-500' : 'text-gray-900'}>{diffCount}</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500 font-medium">
            Masukkan jumlah fisik untuk setiap batch. Kosongkan jika tidak dihitung.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 min-w-[180px]">Nama Obat</th>
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Batch</th>
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Exp.</th>
                  <th className="text-right py-2 pr-3 text-xs font-semibold text-gray-500">Stok Sistem</th>
                  <th className="text-center py-2 pr-3 text-xs font-semibold text-gray-500 min-w-[110px]">Stok Fisik</th>
                  <th className="text-center py-2 text-xs font-semibold text-gray-500">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(batch => {
                  const diff = getDiff(batch)
                  const phys = getPhysical(batch.id)
                  return (
                    <tr key={batch.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-gray-900">{batch.medicines?.name ?? '—'}</p>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-gray-500">{batch.batch_number}</td>
                      <td className="py-2 pr-3 text-xs text-gray-500">{formatDate(batch.expiry_date)}</td>
                      <td className="py-2 pr-3 text-right font-semibold">
                        {batch.quantity} <span className="text-xs text-gray-400 font-normal">{batch.medicines?.unit}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={0}
                          value={counts[batch.id] ?? ''}
                          onChange={e => setCounts(prev => ({ ...prev, [batch.id]: e.target.value }))}
                          placeholder="—"
                          className="h-8 text-sm text-center w-24 mx-auto"
                        />
                      </td>
                      <td className="py-2 text-center">
                        {phys === null ? (
                          <span className="text-gray-300">—</span>
                        ) : diff === 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <Badge variant={diff! > 0 ? 'success' : 'destructive'}>
                            {diff! > 0 ? '+' : ''}{diff}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {diffCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">{diffCount} batch akan disesuaikan:</p>
                <ul className="mt-1 space-y-0.5">
                  {adjustments.slice(0, 5).map(b => {
                    const d = getDiff(b)!
                    return (
                      <li key={b.id} className="text-xs">
                        {b.medicines?.name} ({b.batch_number}): {b.quantity} → {getPhysical(b.id)}
                        <span className={d > 0 ? ' text-emerald-700 font-medium' : ' text-red-700 font-medium'}>
                          {' '}({d > 0 ? '+' : ''}{d})
                        </span>
                      </li>
                    )
                  })}
                  {adjustments.length > 5 && <li className="text-xs text-amber-600">...dan {adjustments.length - 5} lainnya</li>}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
        <Button type="submit" disabled={loading || diffCount === 0}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Simpan Penyesuaian ({diffCount} batch)
        </Button>
      </div>
    </form>
  )
}
