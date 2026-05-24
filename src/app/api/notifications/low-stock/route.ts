import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp, buildLowStockMessage } from '@/lib/notifications/whatsapp'

export async function POST(req: NextRequest) {
  const { tenantId, medicineIds } = await req.json() as { tenantId: string; medicineIds: string[] }
  if (!tenantId || !medicineIds?.length) return NextResponse.json({ ok: true })

  const supabase = await createClient()

  const [configRes, tenantRes, recipientsRes] = await Promise.all([
    supabase.from('tenant_configs').select('wa_token, low_stock_threshold').eq('tenant_id', tenantId).single(),
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase.from('user_profiles').select('phone').eq('tenant_id', tenantId)
      .in('role', ['owner', 'admin']).eq('is_active', true),
  ])

  if (!configRes.data?.wa_token) return NextResponse.json({ ok: true })

  const threshold = configRes.data.low_stock_threshold ?? 10

  // Get total stock per medicine (sum across all active batches)
  const { data: stockData } = await supabase
    .from('medicine_batches')
    .select('medicine_id, quantity, medicines(name, min_stock)')
    .in('medicine_id', medicineIds)
    .eq('tenant_id', tenantId)
    .not('status', 'in', '(DISPOSED,RETURNED,EMPTY)')

  if (!stockData) return NextResponse.json({ ok: true })

  // Aggregate total stock per medicine
  const totals: Record<string, { name: string; total: number; minStock: number }> = {}
  for (const row of stockData) {
    const med = row.medicines as unknown as { name: string; min_stock: number | null } | null
    if (!totals[row.medicine_id]) {
      totals[row.medicine_id] = {
        name: med?.name ?? '—',
        total: 0,
        minStock: med?.min_stock ?? threshold,
      }
    }
    totals[row.medicine_id].total += row.quantity ?? 0
  }

  const lowStockItems = Object.values(totals).filter(m => m.total <= m.minStock && m.total >= 0)
  if (lowStockItems.length === 0) return NextResponse.json({ ok: true })

  const tenantName = tenantRes.data?.name ?? 'Apotek'
  const phones = (recipientsRes.data ?? []).map(r => r.phone).filter(Boolean) as string[]

  for (const item of lowStockItems) {
    const msg = buildLowStockMessage(item.name, item.total, item.minStock, tenantName)
    for (const phone of phones) {
      await sendWhatsApp({ target: phone, message: msg, token: configRes.data.wa_token })
    }
  }

  return NextResponse.json({ ok: true, notified: lowStockItems.length })
}
