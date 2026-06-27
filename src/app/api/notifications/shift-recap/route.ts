import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardEntitlementApi } from '@/lib/tenant-entitlements'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'
import { formatCurrency } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tenantId, cashierName, totalTx, totalCash, totalQris, totalTransfer, closingBalance, openingBalance } = body

  // Tier gate: WhatsApp notifications = Growth+ (legacy/Pro allowed).
  const waGuard = await guardEntitlementApi(tenantId, 'wa_notif')
  if (waGuard) return waGuard

  const supabase = await createClient()

  const { data: config } = await supabase
    .from('tenant_configs')
    .select('wa_token, wa_sender')
    .eq('tenant_id', tenantId)
    .single()

  if (!config?.wa_token) return NextResponse.json({ ok: true })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  const { data: owners } = await supabase
    .from('user_profiles')
    .select('phone')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .eq('is_active', true)

  const total = totalCash + totalQris + totalTransfer
  const msg = [
    `📊 *[${tenant?.name}] Rekap Tutup Shift*`,
    ``,
    `Kasir: *${cashierName}*`,
    ``,
    `💰 Saldo Awal: ${formatCurrency(openingBalance)}`,
    `🛒 Transaksi: ${totalTx}x`,
    ``,
    `*Rincian:*`,
    `• Tunai: ${formatCurrency(totalCash)}`,
    `• QRIS: ${formatCurrency(totalQris)}`,
    `• Transfer: ${formatCurrency(totalTransfer)}`,
    `• Total: *${formatCurrency(total)}*`,
    ``,
    `💵 Saldo Akhir (Tunai): *${formatCurrency(closingBalance)}*`,
    ``,
    `_Webzoka Pharmacy_`,
  ].join('\n')

  for (const owner of owners ?? []) {
    if (owner.phone) {
      await sendWhatsApp({ target: owner.phone, message: msg, token: config.wa_token })
    }
  }

  return NextResponse.json({ ok: true })
}
