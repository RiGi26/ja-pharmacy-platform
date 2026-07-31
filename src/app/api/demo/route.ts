import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Public demo entry — mirrors the "Coba Demo" button on /login (PortalLoginCard)
// so the pricing page's "Lihat demo" link lands straight in the dashboard instead
// of bouncing through the login form first.
//
// Moved from src/app/demo/route.ts (GET, redirect) to here (POST, JSON) so that
// /demo can be a page.tsx that renders an instant loading state instead of the
// browser sitting on a blank tab for the duration of the auth round trip.
const DEMO_EMAIL = 'owner@demo.com'
const DEMO_PASSWORD = 'Demo@1234'

export async function POST() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })
  if (error) {
    return NextResponse.json({ error: 'demo_failed' }, { status: 401 })
  }

  return NextResponse.json({ success: true, redirectTo: '/dashboard' })
}
