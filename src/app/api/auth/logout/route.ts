import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  // Ambil origin dari request untuk memastikan redirect kembali ke portal pharmacy
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/login`, { status: 303 })
}
