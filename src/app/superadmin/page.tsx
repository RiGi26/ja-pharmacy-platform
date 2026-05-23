import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, CheckCircle, PauseCircle, Plus } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function SuperadminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'superadmin') redirect('/dashboard')

  const { data: tenants, count } = await supabase
    .from('tenants')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  const active = tenants?.filter(t => t.status === 'active').length ?? 0
  const suspended = tenants?.filter(t => t.status === 'suspended').length ?? 0

  const columns = [
    {
      key: 'name',
      header: 'Nama Apotek',
      render: (row: Record<string, unknown>) => (
        <div>
          <p className="font-semibold text-gray-900">{String(row.name)}</p>
          <p className="text-xs text-gray-400 font-mono">{String(row.slug)}.japanarenacorp.com</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email / WA',
      render: (row: Record<string, unknown>) => (
        <div className="text-sm text-gray-600">
          <p>{String(row.email ?? '—')}</p>
          <p className="text-xs text-gray-400">{String(row.wa_number ?? '—')}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Record<string, unknown>) => {
        const s = String(row.status)
        return (
          <Badge variant={s === 'active' ? 'success' : s === 'suspended' ? 'destructive' : 'warning'}>
            {s === 'active' ? 'Aktif' : s === 'suspended' ? 'Suspended' : 'Trial'}
          </Badge>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Terdaftar',
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-gray-500">{formatDate(String(row.created_at))}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row: Record<string, unknown>) => (
        <Link href={`/superadmin/tenants/${row.id}`}>
          <Button variant="outline" size="sm">Kelola</Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Superadmin Panel" description="Kelola semua apotek di Japan Arena Corp">
        <Link href="/superadmin/tenants/new">
          <Button size="sm">
            <Plus className="w-4 h-4" />
            Tenant Baru
          </Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Apotek" value={count ?? 0} icon={Building2} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Aktif" value={active} icon={CheckCircle} iconColor="text-green-600" iconBg="bg-green-50" />
        <StatCard title="Suspended" value={suspended} icon={PauseCircle} iconColor="text-red-500" iconBg="bg-red-50" />
      </div>

      <DataTable
        data={(tenants ?? []) as unknown as Record<string, unknown>[]}
        columns={columns}
        keyField="id"
        emptyMessage="Belum ada tenant"
      />
    </div>
  )
}
