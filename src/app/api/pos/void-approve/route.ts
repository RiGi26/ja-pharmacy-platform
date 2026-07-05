import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Approve a POS transaction void — SERVER-SIDE authorization (audit 2026-07-05).
// Voiding a completed sale reverses revenue and restocks inventory, so it must be
// gated by the caller's role (Owner/Admin), NOT by the shared client-side PIN that
// used to live in transaction-history.tsx. Runs the whole rollback under the service
// role after the role check.
//
// NOTE (follow-up): the tenant RLS on transactions / medicine_batches / stock_movements
// is still a role-agnostic tenant-ALL policy, so a determined cashier could in theory
// bypass this route with direct table writes via the client. Closing that fully needs
// an RLS redesign that does NOT break the cashier sale flow (which writes these same
// tables) — tracked separately.
export async function POST(req: Request) {
  let body: { transactionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const { transactionId } = body
  if (!transactionId) {
    return NextResponse.json({ error: 'transactionId wajib diisi.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()

  // Role check: only owner/admin (superadmin included) may approve a void.
  const { data: profile } = await admin
    .from('user_profiles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single()
  if (!profile || !['owner', 'admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Hanya Owner/Admin yang dapat menyetujui void.' }, { status: 403 })
  }

  // Load the transaction scoped to the approver's own tenant.
  const { data: tx } = await admin
    .from('transactions')
    .select('id, tenant_id, status, invoice_number')
    .eq('id', transactionId)
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()
  if (!tx) return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 })
  if (tx.status === 'VOIDED') return NextResponse.json({ ok: true, already: true })

  // Claim the VOIDED transition atomically so a double-submit can't double-restock:
  // the update only matches when the row is not already VOIDED.
  const { data: claimed } = await admin
    .from('transactions')
    .update({ status: 'VOIDED', void_by: user.id })
    .eq('id', tx.id)
    .eq('tenant_id', profile.tenant_id)
    .neq('status', 'VOIDED')
    .select('id')
    .maybeSingle()
  if (!claimed) return NextResponse.json({ ok: true, already: true })

  // Roll back stock for each line + record a VOID_ROLLBACK movement.
  const { data: items } = await admin
    .from('transaction_items')
    .select('batch_id, medicine_id, quantity')
    .eq('transaction_id', tx.id)

  for (const item of items ?? []) {
    const { data: batch } = await admin
      .from('medicine_batches')
      .select('quantity, status')
      .eq('id', item.batch_id)
      .single()
    if (!batch) continue

    await admin
      .from('medicine_batches')
      .update({
        quantity: batch.quantity + item.quantity,
        status: batch.status === 'EMPTY' ? 'LAYAK_JUAL' : batch.status,
      })
      .eq('id', item.batch_id)

    await admin.from('stock_movements').insert({
      tenant_id: profile.tenant_id,
      medicine_id: item.medicine_id,
      batch_id: item.batch_id,
      type: 'VOID_ROLLBACK',
      quantity: item.quantity,
      ref_id: tx.id,
      ref_type: 'transaction',
      note: `Void transaksi ${tx.invoice_number}`,
      created_by: user.id,
    })
  }

  return NextResponse.json({ ok: true, invoiceNumber: tx.invoice_number })
}
