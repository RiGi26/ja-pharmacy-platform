import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { ControlledDrugManager, type CdLog, type CdMedicine } from './controlled-drug-manager'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Logbook Obat Terkontrol' }

const VIEW_ROLES = ['superadmin', 'owner', 'admin', 'apoteker']
const WRITE_ROLES = ['superadmin', 'owner', 'admin', 'apoteker']
const DELETE_ROLES = ['superadmin', 'owner', 'admin']

export default async function ControlledDrugsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!VIEW_ROLES.includes(profile.role)) redirect('/dashboard')

  const sp = await searchParams
  const now = new Date()
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '')
    ? sp.month!
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const start = new Date(`${month}-01T00:00:00`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  const db = await createAdminClient()
  const [logsRes, medsRes] = await Promise.all([
    db.from('controlled_drug_logs').select('*')
      .eq('tenant_id', profile.tenant_id)
      .gte('dispensed_at', start.toISOString())
      .lt('dispensed_at', end.toISOString())
      .order('dispensed_at', { ascending: false }),
    db.from('medicines')
      .select('id, name, drug_class, unit, medicine_batches(id, batch_number, expiry_date, quantity, status)')
      .eq('tenant_id', profile.tenant_id)
      .in('drug_class', ['keras', 'psikotropika', 'narkotika'])
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  const logs = (logsRes.data ?? []) as CdLog[]
  const medicines = (medsRes.data ?? []).map((m: any): CdMedicine => ({
    id: m.id, name: m.name, drug_class: m.drug_class, unit: m.unit,
    batches: (m.medicine_batches ?? [])
      .filter((b: any) => b.status !== 'DISPOSED' && b.status !== 'RETURNED' && b.status !== 'EMPTY')
      .map((b: any) => ({ id: b.id, batch_number: b.batch_number, expiry_date: b.expiry_date, quantity: b.quantity })),
  }))

  return (
    <ControlledDrugManager
      logs={logs}
      medicines={medicines}
      month={month}
      canManage={WRITE_ROLES.includes(profile.role)}
      canDelete={DELETE_ROLES.includes(profile.role)}
    />
  )
}
