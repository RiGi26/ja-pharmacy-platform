import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BatchStatusBadge } from '@/components/shared/batch-status-badge'
import { formatCurrency, formatDate, getDaysUntilExpiry } from '@/lib/utils'
import {
  ShoppingCart, Package, AlertTriangle, TrendingUp,
  FileText, Clock,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id, role, full_name')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const tenantId = profile.tenant_id
  const today = new Date().toISOString().slice(0, 10)

  // Fetch dashboard stats in parallel
  const [txResult, medicineResult, expiryResult, prescriptionResult] = await Promise.all([
    // Today's transactions
    supabase
      .from('transactions')
      .select('total, status, payment_method')
      .eq('tenant_id', tenantId)
      .gte('created_at', today)
      .eq('status', 'COMPLETED'),

    // Active medicines count
    supabase
      .from('medicines')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('deleted_at', null),

    // Expiry alerts (WARNING + DILARANG_JUAL)
    supabase
      .from('medicine_batches')
      .select('id, status, expiry_date, medicine_id, medicines(name)')
      .eq('tenant_id', tenantId)
      .in('status', ['WARNING', 'DILARANG_JUAL'])
      .order('expiry_date', { ascending: true })
      .limit(5),

    // Pending prescriptions
    supabase
      .from('prescriptions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['PENDING', 'PROCESSING']),
  ])

  const todayTotal = txResult.data?.reduce((sum, tx) => sum + Number(tx.total), 0) ?? 0
  const todayCount = txResult.data?.length ?? 0
  const medicineCount = medicineResult.count ?? 0
  const expiryAlerts = expiryResult.data ?? []
  const pendingRx = prescriptionResult.count ?? 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Selamat pagi' : hour < 17 ? 'Selamat siang' : 'Selamat malam'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title={`${greeting}, ${profile.full_name.split(' ')[0]} 👋`}
        description="Ringkasan aktivitas apotek hari ini"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Pendapatan Hari Ini"
          value={formatCurrency(todayTotal)}
          subtitle={`${todayCount} transaksi`}
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Total Obat"
          value={medicineCount}
          subtitle="item aktif"
          icon={Package}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
        <StatCard
          title="Alert Expired"
          value={expiryAlerts.length}
          subtitle="batch bermasalah"
          icon={AlertTriangle}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Resep Pending"
          value={pendingRx}
          subtitle="menunggu dispensing"
          icon={FileText}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expiry Alerts */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alert Kedaluwarsa
            </CardTitle>
            {expiryAlerts.length > 0 && (
              <Badge variant="warning">{expiryAlerts.length} batch</Badge>
            )}
          </CardHeader>
          <CardContent>
            {expiryAlerts.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Tidak ada alert kedaluwarsa</p>
            ) : (
              <div className="space-y-2">
                {expiryAlerts.map((batch) => {
                  const days = getDaysUntilExpiry(batch.expiry_date)
                  const medicine = batch.medicines as unknown as { name: string } | null
                  return (
                    <div key={batch.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{medicine?.name ?? '—'}</p>
                        <p className="text-xs text-gray-400">
                          Exp: {formatDate(batch.expiry_date)} · {days < 0 ? `${Math.abs(days)}h lalu` : `H-${days}`}
                        </p>
                      </div>
                      <BatchStatusBadge status={batch.status as import('@/types').BatchStatus} daysLeft={days > 0 ? days : undefined} />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Aksi Cepat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Buka Kasir', href: '/pos', icon: ShoppingCart, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                { label: 'Input Stok', href: '/inventory/stock-in', icon: Package, color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
                { label: 'Cek Resep', href: '/prescriptions', icon: FileText, color: 'bg-green-50 text-green-700 hover:bg-green-100' },
                { label: 'Monitoring Exp', href: '/expiry', icon: AlertTriangle, color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
              ].map(action => (
                <a
                  key={action.href}
                  href={action.href}
                  className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-colors ${action.color}`}
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
