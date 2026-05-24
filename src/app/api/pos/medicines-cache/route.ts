import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: medicines } = await supabase
    .from('medicines')
    .select('id, name, barcode, sell_price, unit, is_prescription, medicine_batches(id, batch_number, quantity, expiry_date, status, buy_price, discount_pct)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  const INACTIVE_STATUSES = ['DISPOSED', 'RETURNED', 'EMPTY']
  const formatted = (medicines ?? []).map(m => ({
    id: m.id,
    name: m.name,
    barcode: m.barcode,
    sell_price: m.sell_price,
    unit: m.unit,
    is_prescription: m.is_prescription,
    batches: (m.medicine_batches ?? []).filter(
      (b: { status: string }) => !INACTIVE_STATUSES.includes(b.status)
    ),
  }))

  return NextResponse.json(formatted, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
