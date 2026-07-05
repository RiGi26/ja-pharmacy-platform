import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Public demo entry — mirrors the "Coba Demo" button on /login (login-form.tsx)
// so the pricing page's "Lihat demo" link lands straight in the dashboard instead
// of bouncing through the login form first.
const DEMO_EMAIL = 'owner@demo.com'
const DEMO_PASSWORD = 'Demo@1234'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })
  if (error) return NextResponse.redirect(`${origin}/login?error=demo_failed`)

  return NextResponse.redirect(`${origin}/dashboard`)
}
