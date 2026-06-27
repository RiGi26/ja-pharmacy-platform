import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardEntitlementApi } from '@/lib/tenant-entitlements'
import type { OfflineTransaction } from '@/lib/offline/db'

export async function POST(req: NextRequest) {
  const tx: OfflineTransaction = await req.json()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Tier gate: offline (PWA) sync = Pro. Resolve tenant from the authenticated
  // user (not the client-supplied body) before gating. Legacy/Pro = allowed.
  const { data: prof } = await supabase
    .from('user_profiles').select('tenant_id').eq('user_id', user.id).single()
  if (!prof?.tenant_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const offlineGuard = await guardEntitlementApi(prof.tenant_id, 'offline_mode')
  if (offlineGuard) return offlineGuard

  // Check for duplicate (idempotency via invoice_number)
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('tenant_id', tx.tenant_id)
    .eq('invoice_number', tx.invoice_number)
    .single()

  if (existing) {
    return NextResponse.json({ id: existing.id }, { status: 200 })
  }

  // Validate stock availability before applying
  for (const item of tx.items) {
    const { data: batch } = await supabase
      .from('medicine_batches')
      .select('quantity, status')
      .eq('id', item.batch_id)
      .single()

    if (!batch || batch.quantity < item.quantity) {
      return NextResponse.json({
        error: `Stok ${item.medicine_name} tidak mencukupi (tersisa: ${batch?.quantity ?? 0})`,
      }, { status: 409 })
    }
    if (batch.status === 'DILARANG_JUAL') {
      return NextResponse.json({ error: `${item.medicine_name}: Batch dilarang dijual` }, { status: 409 })
    }
  }

  // Insert transaction
  const { data: created, error: txErr } = await supabase
    .from('transactions')
    .insert({
      tenant_id: tx.tenant_id,
      invoice_number: tx.invoice_number,
      cashier_id: tx.user_id,
      payment_method: tx.payment_method,
      subtotal: tx.subtotal,
      discount: tx.discount,
      total: tx.total,
      paid_amount: tx.paid_amount,
      change_amount: tx.change_amount,
      status: 'COMPLETED',
      created_at: tx.created_at,
    })
    .select('id')
    .single()

  if (txErr || !created) return NextResponse.json({ error: txErr?.message }, { status: 500 })

  // Insert items and reduce stock
  for (const item of tx.items) {
    await supabase.from('transaction_items').insert({
      tenant_id: tx.tenant_id,
      transaction_id: created.id,
      medicine_id: item.medicine_id,
      batch_id: item.batch_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_pct: item.discount_pct,
      subtotal: item.subtotal,
    })

    const { data: batchNow } = await supabase
      .from('medicine_batches').select('quantity').eq('id', item.batch_id).single()

    const newQty = (batchNow?.quantity ?? 0) - item.quantity
    await supabase.from('medicine_batches').update({
      quantity: Math.max(0, newQty),
      status: newQty <= 0 ? 'EMPTY' : undefined,
    }).eq('id', item.batch_id)

    await supabase.from('stock_movements').insert({
      tenant_id: tx.tenant_id,
      medicine_id: item.medicine_id,
      batch_id: item.batch_id,
      type: 'OUT',
      quantity: -item.quantity,
      ref_id: created.id,
      ref_type: 'transaction',
      note: `[OFFLINE SYNC] ${tx.invoice_number}`,
      created_by: tx.user_id,
    })
  }

  return NextResponse.json({ id: created.id })
}
