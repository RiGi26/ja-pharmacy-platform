@AGENTS.md

# Claude Code — Systematic Debugging Prompt
## ja-pharmacy-platform | Japan Arena Corp

Gunakan file ini sebagai referensi utama saat melakukan debugging di project ini.
Letakkan di root repo: `CLAUDE.md` atau `.claude/CLAUDE.md`

---

## 🏗️ Project Context

```
Platform      : ja-pharmacy-platform (SaaS Multi-Tenant)
Stack         : Next.js 16 (App Router) · TypeScript · Supabase · Tailwind · Shadcn/UI
Database      : PostgreSQL via Supabase (RLS aktif semua tabel)
Auth          : Supabase Auth + Custom JWT Claims (tenant_id + role)
State         : Zustand + TanStack Query
Hardware      : QZ Tray (WebSocket) → Thermal Printer, Label Printer, Cash Drawer
Payment       : Midtrans (QRIS + Transfer)
Notifikasi    : WhatsApp Cloud API (Meta) + Resend (Email)
Offline       : IndexedDB via Dexie.js (PWA kasir)
Deployment    : Vercel (wildcard subdomain *.japanarenacorp.com)
Integrasi     : ja-clinic-platform (webhook resep + callback dispensing)
```

---

## 🔍 Systematic Debugging Protocol

Setiap kali menemukan bug, error, atau behavior yang tidak diharapkan,
**ikuti urutan langkah ini secara berurutan — jangan skip.**

### Step 1 — STOP & REPRODUCE

Sebelum menyentuh kode apapun:

```
1. Reproduksi bug secara konsisten
2. Catat exact error message (full stack trace, bukan parafrase)
3. Catat kondisi saat bug terjadi:
   - Tenant mana? (slug/tenant_id)
   - User role apa? (superadmin/owner/admin/apoteker/kasir)
   - Browser & OS apa?
   - Online atau offline mode?
   - Hardware terhubung? (QZ Tray, scanner, printer)
4. Catat apakah bug terjadi di semua tenant atau hanya 1 tenant
5. Catat apakah bug terjadi di semua role atau role tertentu saja
```

**JANGAN langsung fix sebelum bisa reproduce secara konsisten.**

---

### Step 2 — ISOLATE THE LAYER

Tentukan bug ada di layer mana:

```
[ ] UI Layer          → React component, state, render, event handler
[ ] State Layer       → Zustand store, TanStack Query cache, stale data
[ ] API Layer         → Next.js Route Handler, request/response format
[ ] Database Layer    → Supabase query, RLS policy, schema constraint
[ ] Auth Layer        → JWT claim, tenant_id context, role permission
[ ] Hardware Layer    → QZ Tray WebSocket, printer command, scanner buffer
[ ] Notification      → WA Cloud API, Resend, webhook payload
[ ] Offline Layer     → IndexedDB, sync queue, conflict resolution
[ ] Integration       → ja-clinic webhook, callback, shared contract
[ ] Infra/Deploy      → Vercel env var, wildcard subdomain, Edge runtime
```

Cara cepat isolate:
- Error di browser console → UI/State layer
- Error di Vercel logs → API/Server layer
- Error di Supabase dashboard → Database/RLS layer
- Hardware tidak respond → QZ Tray/device layer
- WA/Email tidak terkirim → Notification layer
- Data clinic tidak masuk → Integration layer

---

### Step 3 — GATHER EVIDENCE

Kumpulkan bukti sebelum asumsi apapun:

#### Untuk Database/RLS bugs:
```sql
-- Cek apakah RLS aktif
SELECT schemaname, tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'public';

-- Cek policies yang aktif
SELECT * FROM pg_policies WHERE tablename = '{table_name}';

-- Test query sebagai user tertentu
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"user-uuid","tenant_id":"tenant-uuid","role":"kasir"}';
SELECT * FROM medicines LIMIT 5;

-- Cek apakah tenant_id match
SELECT id, tenant_id, name FROM medicines
WHERE id = '{suspicious_record_id}';
```

#### Untuk API bugs:
```typescript
// Tambahkan logging sementara di route handler
console.log('[DEBUG]', {
  method: req.method,
  url: req.url,
  tenantId: req.headers.get('x-tenant-id'),
  body: await req.clone().json(),
  timestamp: new Date().toISOString()
})
```

#### Untuk Auth/JWT bugs:
```typescript
// Decode JWT tanpa verify untuk debug
const token = req.headers.get('authorization')?.split(' ')[1]
const [, payload] = token?.split('.') ?? []
const claims = JSON.parse(atob(payload))
console.log('[JWT Claims]', claims)
// Cek: apakah tenant_id ada? apakah role benar?
```

#### Untuk Hardware/QZ Tray bugs:
```typescript
// Cek status koneksi QZ Tray
qz.websocket.isActive() // harus true
qz.printers.find('EPSON TM-T82X').then(console.log).catch(console.error)
// Cek di browser console: ada error WebSocket?
// Cek: apakah QZ Tray service running di Task Manager Windows?
```

#### Untuk Scanner bugs:
```typescript
// Tambahkan debug listener sementara
window.addEventListener('keydown', (e) => {
  console.log('[KEY]', e.key, e.timeStamp)
})
// Lihat di console apakah keystroke scanner terdeteksi
// Cek: apakah ada input field aktif lain yang "mencuri" focus?
```

#### Untuk Offline/Sync bugs:
```typescript
// Cek IndexedDB state di browser DevTools → Application → IndexedDB
// Atau via code:
const pending = await db.offlineTransactions
  .where('status').equals('PENDING_SYNC').toArray()
console.log('[Offline Queue]', pending.length, 'items pending')

const conflicts = await db.offlineTransactions
  .where('status').equals('CONFLICT').toArray()
console.log('[Conflicts]', conflicts)
```

#### Untuk WA/Email notification bugs:
```typescript
// Cek di tabel notification_logs
SELECT * FROM notification_logs
WHERE tenant_id = '{tenant_id}'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
// Lihat: status sent/failed? provider_ref ada?

// Cek WA Cloud API response
const res = await fetch('https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages', ...)
const data = await res.json()
console.log('[WA Response]', JSON.stringify(data, null, 2))
// Error code 131049 = frequency cap / US marketing block
// Error code 130429 = rate limit (throughput)
// Error code 132000 = template tidak exist atau belum approved
```

---

### Step 4 — FORM A HYPOTHESIS

Setelah evidence terkumpul, tulis hipotesis eksplisit:

```
Format: "Saya menduga [X] terjadi karena [Y], yang menyebabkan [Z]"

Contoh baik:
✅ "Saya menduga stok tidak berkurang karena RLS policy di medicine_batches
   tidak include tenant_id dari JWT custom claim, sehingga UPDATE query
   tidak match record manapun dan silent fail."

Contoh buruk:
❌ "Sepertinya ada bug di database"
❌ "Mungkin ada masalah di RLS"
```

---

### Step 5 — TEST THE HYPOTHESIS

Test hipotesis dengan cara paling sempit mungkin:

```typescript
// BAIK: Test hipotesis spesifik dengan minimal change
// Contoh: test apakah masalahnya di RLS atau di query logic
const { data, error } = await supabase
  .from('medicine_batches')
  .update({ quantity: quantity - sold })
  .eq('id', batchId)
  .eq('tenant_id', tenantId) // tambahkan explicit filter sementara
  .select()

console.log('[Hypothesis Test]', { data, error, rowsAffected: data?.length })
```

**Satu hipotesis → satu test. Jangan test dua hal sekaligus.**

---

### Step 6 — FIX & VERIFY

Setelah hipotesis terbukti:

```
1. Buat fix sesempit mungkin — jangan refactor sekalian
2. Test fix di:
   □ Local development
   □ Supabase local (supabase start)
   □ Staging/preview deployment (Vercel preview URL)
3. Test edge cases:
   □ Apakah fix break tenant lain?
   □ Apakah fix break role lain?
   □ Apakah fix work saat offline?
   □ Apakah fix work dengan hardware terhubung?
4. Cek tidak ada regression di fitur terkait
```

---

### Step 7 — DOCUMENT & PREVENT

```
1. Tulis comment di kode kenapa fix ini dilakukan (bukan apa yang dilakukan)
2. Kalau bug dari RLS: tambahkan RLS test case di test suite
3. Kalau bug dari schema: update schema documentation di PRD
4. Kalau bug bisa terjadi lagi: tambahkan automated test
5. Kalau bug dari edge case yang belum ada di error handling:
   tambahkan ke section 14 PRD (Error & Edge Cases)
```

---

## 🚨 Domain-Specific Bug Patterns

Pola bug yang paling sering di sistem apotek ini — cek ini dulu sebelum investigasi lebih dalam:

### 1. RLS Silent Failure
```
Symptom : UPDATE/INSERT berhasil (tidak ada error) tapi data tidak berubah
          SELECT return 0 rows padahal data ada
Penyebab : tenant_id di JWT claim tidak match tenant_id di record
           RLS policy terlalu ketat atau terlalu longgar
Cek      : Lihat JWT claims, bandingkan dengan tenant_id di record
Fix      : Pastikan middleware inject x-tenant-id SEBELUM Supabase client dibuat
```

### 2. Stok Tidak Berkurang / Double Berkurang
```
Symptom : Stok di UI tidak update setelah transaksi
          Stok berkurang dua kali setelah void + rollback
Penyebab : Race condition antara transaksi dan stock_movement insert
           Void rollback dipanggil dua kali
Cek      : Lihat tabel stock_movements — apakah ada duplikat ref_id?
Fix      : Semua perubahan stok harus atomic via Supabase transaction
           Gunakan idempotency key di void endpoint
```

### 3. Expired Check Tidak Jalan
```
Symptom : Obat DILARANG_JUAL masih bisa masuk keranjang kasir
Penyebab : Cron pg_cron tidak jalan (cek di Supabase Logs)
           Kasir cache IndexedDB stale (offline mode)
           Check hanya di UI, tidak di server saat commit transaksi
Cek      : SELECT * FROM medicine_batches WHERE expiry_date < NOW()
             AND status != 'DILARANG_JUAL'
Fix      : Double-check expired status di server saat POST /api/transactions
           Jangan trust client-side status saja
```

### 4. Multi-Tenant Data Leak
```
Symptom : User apotek A bisa lihat data apotek B
Penyebab : Middleware tidak inject tenant_id dengan benar
           Supabase client dibuat sebelum tenant context di-set
           Route handler tidak gunakan server-side Supabase client
Cek      : Test dengan 2 akun tenant berbeda, cross-check data
Fix      : SELALU gunakan supabase client yang dibuat SETELAH
           header x-tenant-id di-inject oleh middleware
```

### 5. Transaksi Offline Tidak Sync
```
Symptom : Transaksi saat offline tidak muncul di laporan
          Stok tidak terkurang setelah koneksi pulih
Penyebab : Event 'online' tidak fired (browser quirk)
           Sync function throw error dan tidak retry
           Konflik stok menyebabkan seluruh batch gagal
Cek      : DevTools → Application → IndexedDB → offlineTransactions
           Lihat status: PENDING_SYNC / CONFLICT / SYNC_FAILED
Fix      : Tambahkan manual sync trigger button di UI kasir
           Setiap konflik harus di-flag individual, bukan fail semua
```

### 6. QZ Tray Disconnect
```
Symptom : Print nota gagal, tidak ada error di UI
          Cash drawer tidak terbuka
Penyebab : QZ Tray service tidak running di PC kasir
           Versi QZ Tray tidak kompatibel
           Certificate QZ Tray expired
Cek      : qz.websocket.isActive() di browser console
           Cek Windows Task Manager — ada proses QZ Tray?
Fix      : Tampilkan banner "Printer tidak terhubung" saat isActive() = false
           Fallback ke window.print() untuk nota
```

### 7. Webhook Resep Tidak Masuk
```
Symptom : Resep dari clinic tidak muncul di queue apoteker
Penyebab : HMAC signature verification gagal (webhook secret tidak match)
           Endpoint tidak return 200 dalam 5 detik → timeout
           Duplikat clinic_prescription_id (idempotency)
Cek      : Vercel logs → /api/webhooks/prescription
           Lihat: apakah ada 401/400/500 dari webhook handler?
Fix      : Log semua incoming webhook dengan timestamp
           Pastikan HMAC verify menggunakan secret DARI TENANT yang benar
           Return 200 segera, proses async
```

### 8. WA Tidak Terkirim
```
Symptom : Notifikasi WA tidak sampai ke penerima
Penyebab : Error code 131049 = frequency cap (user sudah dapat 2 marketing/24jam)
           Error code 132000 = template belum approved atau nama salah
           Error code 130429 = rate limit throughput
           WA token expired atau permission dicabut
Cek      : notification_logs table → lihat status dan provider_ref
           WA Cloud API dashboard → Phone Number → Insights
Fix      : Implement retry dengan exponential backoff untuk 130429
           Untuk 131049: tambahkan ke retry queue dengan delay 1 jam
           Monitor template quality rating di WA Manager
```

---

## 📋 Pre-Debug Checklist

Sebelum mulai debug, jawab pertanyaan ini:

```
□ Apakah bug bisa direproduksi secara konsisten? (jika tidak → gather more info dulu)
□ Apakah bug terjadi di semua tenant atau 1 tenant spesifik?
□ Apakah bug terjadi di semua role atau role tertentu?
□ Apakah bug baru muncul setelah deployment tertentu? (bisect commit)
□ Apakah ada error di: browser console, Vercel logs, Supabase logs?
□ Apakah ada perubahan di env vars belakangan ini?
□ Apakah Supabase Edge Functions / pg_cron berjalan normal?
□ Apakah ini bug fungsional atau bug tampilan saja?
```

---

## 🧪 Testing Commands

```bash
# Run unit tests
pnpm test

# Run tests dengan watch mode
pnpm test:watch

# Run Supabase local untuk integration test
supabase start
supabase db reset

# Run E2E tests
pnpm test:e2e

# Check TypeScript errors
pnpm type-check

# Check linting
pnpm lint

# Build check (simulasi production)
pnpm build
```

---

## 🔑 Environment Variables yang Sering Jadi Masalah

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # JANGAN expose ke client!

# WA Cloud API
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=                  # Permanent system user token
WA_WEBHOOK_VERIFY_TOKEN=          # Token buatan sendiri untuk verify webhook

# Midtrans
MIDTRANS_SERVER_KEY=              # JANGAN expose ke client!
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=

# Resend
RESEND_API_KEY=

# Clinic Integration
CLINIC_API_URL=
CLINIC_WEBHOOK_SECRET=            # Per-tenant, bukan global!

# Vercel
NEXT_PUBLIC_APP_URL=              # Base URL untuk callback
```

**Cek ini saat bug muncul hanya di production tapi tidak di local:**
- Semua env vars sudah di-set di Vercel project settings?
- Environment: Production vs Preview vs Development sudah benar?
- Wildcard domain `*.japanarenacorp.com` sudah dikonfigurasi di Vercel?

---

## 📁 File-File Kritis yang Perlu Diketahui

```
middleware.ts                    → Tenant resolution dari subdomain
lib/supabase/server.ts           → Server-side Supabase client (gunakan ini di Route Handlers)
lib/supabase/client.ts           → Client-side Supabase client
lib/whatsapp.ts                  → WA Cloud API sender
lib/offlineQueue.ts              → Dexie.js IndexedDB schema + sync logic
lib/printer.ts                   → QZ Tray integration (print nota, label, open drawer)
hooks/useBarcodeScanner.ts       → Global keyboard listener untuk scanner
app/api/webhooks/prescription/   → Endpoint terima resep dari clinic
app/api/transactions/            → POS transaksi + void logic
supabase/migrations/             → Database migrations (jangan edit langsung!)
supabase/functions/              → Edge functions (cron expired check, dll)
```

---

## ⚡ Quick Debug Commands (Copy-Paste Ready)

```typescript
// === CEK TENANT CONTEXT ===
const tenantId = req.headers.get('x-tenant-id')
const tenantSlug = req.headers.get('x-tenant-slug')
console.log('[Tenant]', { tenantId, tenantSlug })

// === CEK AUTH SESSION ===
const { data: { session } } = await supabase.auth.getSession()
console.log('[Session]', {
  userId: session?.user?.id,
  tenantId: session?.user?.user_metadata?.tenant_id,
  role: session?.user?.user_metadata?.role,
  exp: new Date((session?.expires_at ?? 0) * 1000)
})

// === CEK STOK REAL-TIME ===
const { data: batches } = await supabase
  .from('medicine_batches')
  .select('id, batch_number, quantity, status, expiry_date')
  .eq('medicine_id', medicineId)
  .eq('tenant_id', tenantId)
  .gt('quantity', 0)
  .order('expiry_date', { ascending: true }) // FIFO
console.log('[Batches Available]', batches)

// === CEK RLS POLICY AKTIF ===
const { data: policies } = await supabase
  .rpc('get_policies_for_table', { table_name: 'medicines' })
console.log('[RLS Policies]', policies)

// === CEK OFFLINE QUEUE STATUS ===
import { db } from '@/lib/offlineQueue'
const stats = {
  pending: await db.offlineTransactions.where('status').equals('PENDING_SYNC').count(),
  conflict: await db.offlineTransactions.where('status').equals('CONFLICT').count(),
  failed: await db.offlineTransactions.where('status').equals('SYNC_FAILED').count(),
}
console.log('[Offline Queue Stats]', stats)

// === CEK QZ TRAY ===
import qz from 'qz-tray'
console.log('[QZ Active]', qz.websocket.isActive())
qz.printers.find().then(p => console.log('[Printers]', p))

// === TEST KIRIM WA ===
const testWA = await fetch('https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: '628123456789', // ganti dengan nomor test
    type: 'template',
    template: { name: 'hello_world', language: { code: 'en_US' } }
  })
})
console.log('[WA Test]', await testWA.json())
```

---

## 🚫 Anti-Patterns — Jangan Lakukan Ini

```
❌ Fix bug tanpa bisa reproduce → akan balik lagi
❌ Edit supabase/migrations langsung → selalu buat migration baru
❌ Bypass RLS untuk "quick fix" → security hole permanen
❌ Hardcode tenant_id di kode → akan break multi-tenant
❌ Trust client-side validation untuk stok/expired → double check di server
❌ Log sensitive data (token, password) ke console di production
❌ Fix 2 bugs sekaligus → tidak bisa tahu yang mana yang fix masalah
❌ Deploy ke production tanpa test di staging/preview URL dulu
❌ Ubah schema database tanpa migration file
❌ Commit API key atau token ke git
```

---

## 📞 Escalation Path

```
Level 1 — Self debug menggunakan protokol di atas (30 menit)
Level 2 — Cek Supabase Discord / GitHub Issues untuk bug serupa
Level 3 — Cek Meta Developer Forum untuk WA Cloud API issues
Level 4 — Supabase Support (untuk RLS/database issues kritikal)
Level 5 — Meta Business Support (untuk WA account issues, ban, dll)

Untuk issues yang affect semua tenant → immediate priority
Untuk issues yang affect 1 tenant → high priority
Untuk issues yang hanya tampilan → medium priority
```

---

*ja-pharmacy-platform · Japan Arena Corp · Internal Developer Reference*
*Sesuaikan prompt ini seiring sistem berkembang*
