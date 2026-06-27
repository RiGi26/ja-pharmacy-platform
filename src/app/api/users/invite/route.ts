import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { guardKasirSeat } from '@/lib/tenant-entitlements'

export async function POST(req: NextRequest) {
  const { email, role, full_name, phone, tenant_id } = await req.json()

  if (!email || !role || !full_name || !tenant_id) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
  }

  // Verify requester is owner/superadmin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role, tenant_id').eq('user_id', user.id).single()

  if (!profile || !['superadmin', 'owner'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (profile.role !== 'superadmin' && profile.tenant_id !== tenant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Tier gate: enforce the per-tier staff/kasir seat quota (1 / 3 / ∞). Legacy
  // tenants (no entitlement row) and Pro are unlimited — behaviour-preserving.
  const seatGuard = await guardKasirSeat(tenant_id)
  if (seatGuard) return seatGuard

  // Use admin client to invite user
  const admin = await createAdminClient()
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { tenant_id, role },
  })

  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 400 })

  // Create user_profile row so the user has a profile on first login
  if (invited.user) {
    await admin.from('user_profiles').upsert({
      user_id: invited.user.id,
      tenant_id,
      role,
      full_name,
      email,
      phone: phone || null,
      is_active: true,
    }, { onConflict: 'user_id' })
  }

  return NextResponse.json({ ok: true })
}
