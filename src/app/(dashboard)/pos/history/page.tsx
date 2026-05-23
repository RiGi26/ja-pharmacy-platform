import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { TransactionHistory } from './transaction-history'

export default async function TransactionHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/login')

  const params = await searchParams
  const date = params.date ?? new Date().toISOString().slice(0, 10)
  const page = Number(params.page ?? 1)
  const limit = 25
  const offset = (page - 1) * limit

  const { data: transactions, count } = await supabase
    .from('transactions')
    .select('*, transaction_items(*, medicines(name))', { count: 'exact' })
    .eq('tenant_id', profile.tenant_id)
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const canApproveVoid = ['superadmin', 'owner', 'admin', 'apoteker'].includes(profile.role)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Riwayat Transaksi" description={`${count ?? 0} transaksi pada ${date}`} />
      <TransactionHistory
        transactions={transactions ?? []}
        totalPages={Math.ceil((count ?? 0) / limit)}
        page={page}
        date={date}
        canApproveVoid={canApproveVoid}
        tenantId={profile.tenant_id}
        userId={user.id}
      />
    </div>
  )
}
