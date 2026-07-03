'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getCurrentProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

// ============================================================
// Server Actions — Logbook Obat Terkontrol (controlled_drug_logs).
// Register manual dispensing obat keras/psikotropika/narkotika (compliance BPOM).
// Role write: apoteker/admin/owner/superadmin. Tenant-scoped via createAdminClient
// (service-role) + snapshot nama obat/batch/apoteker agar laporan stabil.
// ============================================================

const WRITE_ROLES: UserRole[] = ['superadmin', 'owner', 'admin', 'apoteker']
const CONTROLLED = ['keras', 'psikotropika', 'narkotika']

export interface CreateControlledLogInput {
  medicineId: string
  batchId?: string | null
  patientName: string
  patientId?: string
  doctorName?: string
  prescriptionNo?: string
  clinicName?: string
  quantity: number
  notes?: string
}

export async function createControlledLog(
  input: CreateControlledLogInput,
): Promise<{ id?: string; error?: string }> {
  const user = await getCurrentUser()
  const profile = await getCurrentProfile()
  if (!user || !profile) return { error: 'Sesi tidak ditemukan. Silakan masuk kembali.' }
  if (!WRITE_ROLES.includes(profile.role)) return { error: 'Peran Anda tidak berwenang mencatat logbook.' }

  const patientName = input.patientName?.trim()
  if (!patientName) return { error: 'Nama pasien wajib diisi.' }
  const qty = Number(input.quantity)
  if (!Number.isInteger(qty) || qty <= 0) return { error: 'Jumlah harus bilangan bulat lebih dari 0.' }
  if (!input.medicineId) return { error: 'Obat wajib dipilih.' }

  const db = await createAdminClient()

  // Verifikasi obat: milik tenant + golongan terkontrol.
  const { data: med } = await db
    .from('medicines')
    .select('id, name, drug_class, unit')
    .eq('id', input.medicineId)
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()
  if (!med) return { error: 'Obat tidak ditemukan.' }
  if (!CONTROLLED.includes(med.drug_class)) {
    return { error: 'Obat ini bukan golongan terkontrol (keras/psikotropika/narkotika).' }
  }

  // Batch opsional — ambil snapshot bila dipilih.
  let batchNumber: string | null = null
  let expiryDate: string | null = null
  if (input.batchId) {
    const { data: batch } = await db
      .from('medicine_batches')
      .select('batch_number, expiry_date')
      .eq('id', input.batchId)
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle()
    if (batch) { batchNumber = batch.batch_number; expiryDate = batch.expiry_date }
  }

  const { data, error } = await db
    .from('controlled_drug_logs')
    .insert({
      tenant_id: profile.tenant_id,
      medicine_id: med.id,
      batch_id: input.batchId || null,
      medicine_name: med.name,
      drug_class: med.drug_class,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      patient_name: patientName,
      patient_id: input.patientId?.trim() || null,
      doctor_name: input.doctorName?.trim() || null,
      prescription_no: input.prescriptionNo?.trim() || null,
      clinic_name: input.clinicName?.trim() || null,
      quantity: qty,
      unit: med.unit || null,
      dispensed_by: user.id,
      dispensed_by_name: profile.full_name || null,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('createControlledLog error:', error)
    return { error: 'Gagal menyimpan catatan logbook.' }
  }
  revalidatePath('/controlled-drugs')
  return { id: data.id }
}

export async function deleteControlledLog(id: string): Promise<{ error?: string }> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sesi tidak ditemukan.' }
  // Koreksi catatan = tindakan sensitif → batasi ke admin/owner/superadmin.
  if (!['superadmin', 'owner', 'admin'].includes(profile.role)) {
    return { error: 'Hanya admin yang dapat menghapus catatan logbook.' }
  }
  const db = await createAdminClient()
  const { error } = await db
    .from('controlled_drug_logs')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
  if (error) {
    console.error('deleteControlledLog error:', error)
    return { error: 'Gagal menghapus catatan.' }
  }
  revalidatePath('/controlled-drugs')
  return {}
}
