import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Public demo entry (audit 2026-07-05, M10): signs into the shared demo account and
// lands the visitor in the dashboard, so the corp "Lihat Demo" CTAs (which link to
// pharmacy.webzoka.com/demo) reach an interactive demo instead of the /login wall.
// Server-side mirror of the /login "Demo" button. '/demo' is whitelisted in the
// middleware PUBLIC_ROUTES so this handler can run without an existing session.
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? 'owner@demo.com'
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'Demo@1234'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=demo_unavailable`)
  }
  return NextResponse.redirect(`${origin}/dashboard`)
}
