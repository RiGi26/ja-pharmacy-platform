import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const ROLE_RANK: Record<string, number> = {
  kasir: 20,
  apoteker: 40,
  admin: 60,
  owner: 80,
  superadmin: 100,
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { active } = await request.json()
  if (typeof active !== 'boolean') {
    return NextResponse.json({ error: 'Status aktif tidak valid' }, { status: 400 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: actor } = await supabase
    .from('user_profiles')
    .select('user_id, tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!actor || !['owner', 'superadmin'].includes(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = await createAdminClient()
  const { data: target } = await admin
    .from('user_profiles')
    .select('id, user_id, tenant_id, role')
    .eq('id', id)
    .single()

  if (!target || target.user_id === user.id) {
    return NextResponse.json({ error: 'Target tidak valid' }, { status: 403 })
  }
  if (actor.role !== 'superadmin' && target.tenant_id !== actor.tenant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if ((ROLE_RANK[actor.role] ?? 0) <= (ROLE_RANK[target.role] ?? 0)) {
    return NextResponse.json({ error: 'Tidak dapat mengubah pengguna dengan peran setara atau lebih tinggi' }, { status: 403 })
  }

  const { error } = await admin
    .from('user_profiles')
    .update({ is_active: active })
    .eq('id', target.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
