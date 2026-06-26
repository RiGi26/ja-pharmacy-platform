import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardEntitlementApi } from '@/lib/tenant-entitlements'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

export async function POST(req: NextRequest) {
  const { tenantId, invoiceNumber, reason } = await req.json()

  // Tier gate: WhatsApp notifications = Growth+ (legacy/Pro allowed).
  const waGuard = await guardEntitlementApi(tenantId, 'wa_notif')
  if (waGuard) return waGuard

  const supabase = await createClient()

  const [configRes, tenantRes, recipientsRes] = await Promise.all([
    supabase.from('tenant_configs').select('wa_token').eq('tenant_id', tenantId).single(),
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase.from('user_profiles').select('phone').eq('tenant_id', tenantId)
      .in('role', ['owner', 'admin']).eq('is_active', true),
  ])

  if (!configRes.data?.wa_token) return NextResponse.json({ ok: true })

  const msg = [
    `🔴 *[${tenantRes.data?.name}] Request Void Transaksi*`,
    ``,
    `Invoice: *${invoiceNumber}*`,
    `Alasan: ${reason}`,
    ``,
    `Segera setujui atau tolak di aplikasi.`,
    ``,
    `_Webzoka Pharmacy_`,
  ].join('\n')

  for (const r of recipientsRes.data ?? []) {
    if (r.phone) await sendWhatsApp({ target: r.phone, message: msg, token: configRes.data.wa_token })
  }

  return NextResponse.json({ ok: true })
}
