import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// Cron keepalive — SELECT ringan tiap 6 hari supaya Supabase Free Plan
// tidak auto-pause project ini (pause terjadi kalau 7 hari tanpa aktivitas
// DB nyata). Dipanggil Vercel Cron (lihat vercel.json), auth via
// `Authorization: Bearer <CRON_SECRET>`.
// ============================================================

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await createAdminClient()
  const { error } = await db.from('tenants').select('id').limit(1)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() })
}
