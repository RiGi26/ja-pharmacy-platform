import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { MedicineList } from './medicine-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function MedicinesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; drug_class?: string }>
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
  const q = params.q ?? ''
  const page = Number(params.page ?? 1)
  const drug_class = params.drug_class ?? ''
  const limit = 20
  const offset = (page - 1) * limit

  let query = supabase
    .from('medicines')
    .select('*, medicine_batches(quantity, status)', { count: 'exact' })
    .eq('tenant_id', profile.tenant_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (q) query = query.ilike('name', `%${q}%`)
  if (drug_class) query = query.eq('drug_class', drug_class)

  const { data: medicines, count } = await query
  const totalPages = Math.ceil((count ?? 0) / limit)

  const canWrite = ['superadmin', 'admin'].includes(profile.role)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Master Data Obat" description={`${count ?? 0} obat terdaftar`}>
        {canWrite && (
          <Link href="/medicines/new">
            <Button size="sm">
              <Plus className="w-4 h-4" />
              Tambah Obat
            </Button>
          </Link>
        )}
      </PageHeader>

      <MedicineList
        medicines={medicines ?? []}
        totalPages={totalPages}
        page={page}
        canWrite={canWrite}
      />
    </div>
  )
}
