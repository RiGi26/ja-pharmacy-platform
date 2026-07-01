import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { tierFeatures } from '@/lib/entitlements'
import { provisionCoreTenant } from '@/lib/core-provision'

// ============================================================
// POST /api/register — self-service signup for a new Pharmacy (Apotek) tenant.
//
// Creates: tenant + owner auth user (JWT hook reads tenant_id/role from
// user_profiles) + user_profile + tenant_config + a 14-day trial entitlement (full
// Pro). Best-effort provisions a matching Core DB tenant (SAME-ID) so
// subscription/checkout works later (non-fatal: trial still works, reconcile
// backfills). Service-role writes. Mirrors the clinic/stock register pattern.
// ============================================================
export const dynamic = 'force-dynamic'

const TRIAL_DAYS = 14
const RESERVED = new Set(['demo', 'admin', 'api', 'login', 'register', 'superadmin', 'www', 'not-found'])

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 40)
}

function randSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

export async function POST(request: Request) {
  const rl = rateLimit(`register:${clientIp(request)}`, 5, 60_000)
  if (!rl.allowed) return tooManyRequests(rl.retryAfter)

  let body: {
    namaApotek?: string; adminName?: string; email?: string; password?: string; phone?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }

  const namaApotek = typeof body.namaApotek === 'string' ? body.namaApotek.trim() : ''
  const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''

  if (namaApotek.length < 3) return NextResponse.json({ error: 'Nama apotek minimal 3 karakter.' }, { status: 400 })
  if (!adminName) return NextResponse.json({ error: 'Nama admin wajib diisi.' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 })

  const db = await createAdminClient()

  // 1. Resolve a unique slug.
  const base = slugify(namaApotek) || 'apotek'
  let slug = RESERVED.has(base) ? `${base}-${randSuffix()}` : base
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = `${base}-${randSuffix()}`
  }

  // 2. Create the tenant row (trial).
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .insert({ slug, name: namaApotek, status: 'trial' })
    .select('id, slug')
    .single()
  if (tenantErr || !tenant) {
    console.error('[register] tenant insert failed:', tenantErr)
    return NextResponse.json({ error: 'Gagal membuat apotek. Coba lagi.' }, { status: 500 })
  }

  // 3. Create the owner auth user (JWT hook injects tenant_id/role from user_profiles).
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: adminName },
  })
  if (authErr || !authData?.user) {
    await db.from('tenants').delete().eq('id', tenant.id)
    if (authErr?.message?.toLowerCase().includes('already')) {
      return NextResponse.json({ error: 'Email sudah terdaftar. Silakan masuk.' }, { status: 409 })
    }
    console.error('[register] auth user create failed:', authErr)
    return NextResponse.json({ error: 'Gagal membuat akun. Coba lagi.' }, { status: 500 })
  }
  const userId = authData.user.id

  // 4. user_profile (owner). Cleanup user + tenant on failure.
  const { error: profileErr } = await db
    .from('user_profiles')
    .insert({ user_id: userId, tenant_id: tenant.id, full_name: adminName, role: 'owner', is_active: true })
  if (profileErr) {
    await db.auth.admin.deleteUser(userId)
    await db.from('tenants').delete().eq('id', tenant.id)
    console.error('[register] user_profile insert failed:', profileErr)
    return NextResponse.json({ error: 'Gagal menyiapkan profil. Coba lagi.' }, { status: 500 })
  }

  // 5. Minimal tenant_config (defaults cover the rest). Non-fatal.
  await db.from('tenant_configs').insert({ tenant_id: tenant.id })

  // 6. Best-effort: register the tenant in Core (SAME-ID). Non-fatal.
  const provision = await provisionCoreTenant({
    tenantId: tenant.id,
    slug: tenant.slug,
    name: namaApotek,
    email,
    phone: phone || null,
  })
  const coreTenantId = provision.ok ? provision.coreTenantId : null
  if (!provision.ok) {
    console.error('[register] Core provision failed (non-fatal):', provision.error)
  }

  // 7. Seed a 14-day trial entitlement = full Pro — ONLY when provisioned in Core.
  //    If Core/env is not ready, no row is written so the tenant keeps legacy full
  //    access (behaviour-preserving) instead of a trial that would expire with no
  //    working checkout to renew it. Core sync fills it once billing is live.
  if (coreTenantId) {
    const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error: entErr } = await db.from('tenant_entitlements').upsert(
      {
        tenant_id: tenant.id,
        tier: 'pro',
        entitlements: tierFeatures('pro'),
        max_active_users: null,
        status: 'trial',
        linked_tenant_id: coreTenantId,
        synced_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: 'tenant_id' },
    )
    if (entErr) {
      console.error('[register] trial entitlement upsert failed (non-fatal):', entErr.message)
    }
  }

  // 8. Auto-login so the client can immediately continue (e.g. to checkout).
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) {
    return NextResponse.json(
      { error: 'Akun berhasil dibuat tapi gagal login otomatis. Silakan login manual.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, slug: tenant.slug })
}
