import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function StockOpnamePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('tenant_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const canAccess = ['superadmin', 'admin', 'apoteker'].includes(profile.role)
  if (!canAccess) redirect('/dashboard')

  // Stok opname history from stock_movements with type ADJUST
  const { data: adjustments } = await supabase
    .from('stock_movements')
    .select('id, created_at, quantity, note, medicines(name), medicine_batches(batch_number), user_profiles(full_name)')
    .eq('tenant_id', profile.tenant_id)
    .eq('type', 'ADJUST')
    .order('created_at', { ascending: false })
    .limit(100)

  // Group by note prefix (opname session) — simplistic grouping
  const sessions: Record<string, {
    date: string
    adjustments: { id: string; medicine: string; batch: string; qty: number; note: string }[]
    by: string
  }> = {}

  for (const a of adjustments ?? []) {
    const note = a.note ?? ''
    const sessionKey = note.split(' · ')[0] ?? note
    if (!sessions[sessionKey]) {
      sessions[sessionKey] = {
        date: a.created_at,
        adjustments: [],
        by: (a.user_profiles as unknown as { full_name: string } | null)?.full_name ?? '—',
      }
    }
    sessions[sessionKey].adjustments.push({
      id: a.id,
      medicine: (a.medicines as unknown as { name: string } | null)?.name ?? '—',
      batch: (a.medicine_batches as unknown as { batch_number: string } | null)?.batch_number ?? '—',
      qty: a.quantity,
      note,
    })
  }

  const sessionList = Object.entries(sessions).map(([key, s]) => ({
    id: key,
    date: s.date,
    by: s.by,
    count: s.adjustments.length,
    totalAdj: s.adjustments.reduce((sum, a) => sum + a.qty, 0),
  }))

  const columns = [
    {
      key: 'date',
      header: 'Tanggal',
      render: (row: Record<string, unknown>) => (
        <span className="text-sm">{formatDateTime(String(row.date))}</span>
      ),
    },
    {
      key: 'id',
      header: 'Sesi',
      render: (row: Record<string, unknown>) => (
        <span className="text-xs font-mono text-gray-500">{String(row.id).slice(0, 30)}</span>
      ),
    },
    {
      key: 'count',
      header: 'Jumlah Batch',
      render: (row: Record<string, unknown>) => (
        <Badge variant="secondary">{String(row.count)} batch</Badge>
      ),
    },
    {
      key: 'totalAdj',
      header: 'Total Selisih',
      render: (row: Record<string, unknown>) => {
        const v = Number(row.totalAdj)
        return <span className={`font-semibold ${v >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{v > 0 ? '+' : ''}{v}</span>
      },
    },
    {
      key: 'by',
      header: 'Dilakukan Oleh',
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-gray-600">{String(row.by)}</span>
      ),
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Stok Opname" description="Rekonsiliasi fisik vs sistem">
        <Link href="/stock-opname/new">
          <Button size="sm"><Plus className="w-4 h-4" />Mulai Opname Baru</Button>
        </Link>
      </PageHeader>
      <DataTable
        data={sessionList as unknown as Record<string, unknown>[]}
        columns={columns}
        keyField="id"
        emptyMessage="Belum ada riwayat stok opname"
      />
    </div>
  )
}
