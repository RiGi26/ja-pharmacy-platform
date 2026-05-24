import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { ReportsClient } from './reports-client'
import { startOfDay, endOfDay, subDays, startOfMonth, format } from 'date-fns'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('tenant_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const canAccess = ['superadmin', 'owner', 'admin'].includes(profile.role)
  if (!canAccess) redirect('/dashboard')

  const params = await searchParams
  const period = params.period ?? '30d'

  const now = new Date()
  let dateFrom: Date
  let dateTo: Date = endOfDay(now)

  if (period === 'custom' && params.from && params.to) {
    dateFrom = startOfDay(new Date(params.from))
    dateTo = endOfDay(new Date(params.to))
  } else if (period === '7d') {
    dateFrom = startOfDay(subDays(now, 6))
  } else if (period === 'month') {
    dateFrom = startOfMonth(now)
  } else if (period === 'today') {
    dateFrom = startOfDay(now)
  } else {
    // default 30d
    dateFrom = startOfDay(subDays(now, 29))
  }

  const fromISO = dateFrom.toISOString()
  const toISO = dateTo.toISOString()

  const [txRes, itemsRes, suppliersRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, total_amount, discount_amount, created_at, status, payment_method')
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'COMPLETED')
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: true }),

    supabase
      .from('transaction_items')
      .select('medicine_id, quantity, unit_price, medicines(name)')
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', fromISO)
      .lte('created_at', toISO),

    supabase
      .from('suppliers')
      .select('id, name')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true),
  ])

  const transactions = txRes.data ?? []
  const items = itemsRes.data ?? []
  const suppliers = suppliersRes.data ?? []

  // Build daily revenue map
  const dailyMap: Record<string, number> = {}
  for (const tx of transactions) {
    const day = format(new Date(tx.created_at), 'yyyy-MM-dd')
    dailyMap[day] = (dailyMap[day] ?? 0) + (tx.total_amount ?? 0)
  }
  const dailyRevenue = Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue }))

  // Top medicines by revenue
  const medMap: Record<string, { name: string; quantity: number; revenue: number; hpp: number }> = {}
  for (const item of items) {
    const med = item.medicines as unknown as { name: string } | null
    const id = item.medicine_id
    if (!medMap[id]) medMap[id] = { name: med?.name ?? '—', quantity: 0, revenue: 0, hpp: 0 }
    medMap[id].quantity += item.quantity ?? 0
    medMap[id].revenue += (item.quantity ?? 0) * (item.unit_price ?? 0)
  }
  const topMedicines = Object.entries(medMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Summary
  const totalRevenue = transactions.reduce((s, t) => s + (t.total_amount ?? 0), 0)
  const totalDiscount = transactions.reduce((s, t) => s + (t.discount_amount ?? 0), 0)
  const totalHPP = 0 // hpp column not yet in schema
  const grossProfit = totalRevenue - totalHPP
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  const txCount = transactions.length

  // Payment method breakdown
  const paymentBreakdown: Record<string, number> = {}
  for (const tx of transactions) {
    const pm = tx.payment_method ?? 'CASH'
    paymentBreakdown[pm] = (paymentBreakdown[pm] ?? 0) + (tx.total_amount ?? 0)
  }
  const paymentData = Object.entries(paymentBreakdown).map(([method, amount]) => ({ method, amount }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Laporan Keuangan"
        description="Analisis pendapatan, margin, dan produk terlaris"
      />
      <ReportsClient
        period={period}
        fromDate={format(dateFrom, 'yyyy-MM-dd')}
        toDate={format(dateTo, 'yyyy-MM-dd')}
        dailyRevenue={dailyRevenue}
        topMedicines={topMedicines}
        paymentData={paymentData}
        summary={{ totalRevenue, totalDiscount, totalHPP, grossProfit, grossMargin, txCount }}
        tenantId={profile.tenant_id}
      />
    </div>
  )
}
