import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

export async function POST(req: NextRequest) {
  const { tenantId, invoiceNumber } = await req.json()
  const supabase = await createClient()

  const [configRes, tenantRes, ownersRes] = await Promise.all([
    supabase.from('tenant_configs').select('wa_token').eq('tenant_id', tenantId).single(),
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase.from('user_profiles').select('phone').eq('tenant_id', tenantId)
      .eq('role', 'owner').eq('is_active', true),
  ])

  if (!configRes.data?.wa_token) return NextResponse.json({ ok: true })

  const msg = [
    `✅ *[${tenantRes.data?.name}] Void Disetujui*`,
    ``,
    `Invoice *${invoiceNumber}* telah di-void dan stok dikembalikan.`,
    ``,
    `_Japan Arena Pharmacy_`,
  ].join('\n')

  for (const r of ownersRes.data ?? []) {
    if (r.phone) await sendWhatsApp({ target: r.phone, message: msg, token: configRes.data.wa_token })
  }

  return NextResponse.json({ ok: true })
}
