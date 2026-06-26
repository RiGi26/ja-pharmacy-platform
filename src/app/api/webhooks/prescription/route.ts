import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { guardEntitlementApi } from '@/lib/tenant-entitlements'
import { createHmac } from 'crypto'

function verifyHmac(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return `sha256=${expected}` === signature
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-signature') ?? ''
  const tenantId = req.headers.get('x-tenant-id') ?? ''

  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Missing tenant-id header' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Fetch tenant webhook secret
  const { data: config } = await supabase
    .from('tenant_configs')
    .select('clinic_webhook_secret')
    .eq('tenant_id', tenantId)
    .single()

  if (!config?.clinic_webhook_secret) {
    return NextResponse.json({ success: false, error: 'Tenant not configured' }, { status: 403 })
  }

  if (!verifyHmac(body, signature, config.clinic_webhook_secret)) {
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 })
  }

  // Tier gate: clinic prescription integration = Pro. Block (after auth, so we
  // don't leak entitlement state to unsigned callers) when tenant lacks it.
  const entGuard = await guardEntitlementApi(tenantId, 'prescription')
  if (entGuard) return entGuard

  let payload: {
    prescription_id: string
    patient_name: string
    patient_phone?: string
    doctor_name?: string
    clinic_name?: string
    items: unknown[]
    notes?: string
  }

  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Idempotency: check if already exists
  const { data: existing } = await supabase
    .from('prescriptions')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('clinic_prescription_id', payload.prescription_id)
    .single()

  if (existing) {
    return NextResponse.json({ success: true, data: { prescription_id: existing.id, status: existing.status } })
  }

  // Insert new prescription
  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .insert({
      tenant_id: tenantId,
      clinic_prescription_id: payload.prescription_id,
      patient_name: payload.patient_name,
      patient_phone: payload.patient_phone ?? null,
      doctor_name: payload.doctor_name ?? null,
      clinic_name: payload.clinic_name ?? null,
      items: payload.items,
      status: 'PENDING',
      notes: payload.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[webhook/prescription] Insert error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // TODO: Send WA notification to apoteker (Fonnte)

  return NextResponse.json({ success: true, data: { prescription_id: prescription.id } })
}
