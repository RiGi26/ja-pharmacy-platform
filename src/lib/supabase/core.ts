// ⚠️ SERVER/EDGE ONLY — klien Core DB superadmin (project Supabase terpisah,
// SSOT langganan). Dipakai membaca status langganan tenant yang jadi SSOT
// (sama pola ja-lms-platform/lib/supabase/core.ts).
//
// Mengembalikan null bila env Core DB belum dikonfigurasi → pemanggil WAJIB
// fallback ke perilaku lama: tenant tanpa baris entitlement = akses penuh
// (legacy), supaya transisi tanpa-downtime. Begitu owner men-set CORE_SUPABASE_*
// di Vercel + Core mulai sync, gating otomatis aktif per-tenant.
import { createClient } from '@supabase/supabase-js'

export function createCoreClient() {
  const url = process.env.CORE_SUPABASE_URL?.trim()
  const key = process.env.CORE_SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
