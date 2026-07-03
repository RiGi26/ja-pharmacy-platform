-- 008_controlled_drug_logs.sql
-- Logbook obat terkontrol (keras/psikotropika/narkotika) — compliance BPOM.
-- Register manual: apoteker mencatat tiap pengeluaran obat terkontrol dengan data
-- pasien/dokter/resep. Snapshot nama obat/batch/apoteker agar laporan stabil walau
-- master berubah. Golongan 'bebas'/'bebas_terbatas' tidak dicatat di sini.

create table if not exists controlled_drug_logs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  medicine_id       uuid references medicines(id),
  batch_id          uuid references medicine_batches(id),

  medicine_name     text not null,          -- snapshot
  drug_class        text not null check (drug_class in ('keras','psikotropika','narkotika')),
  batch_number      text,                   -- snapshot
  expiry_date       date,

  patient_name      text not null,
  patient_id        text,                   -- KTP/no. identitas (opsional)
  doctor_name       text,
  prescription_no   text,
  clinic_name       text,

  quantity          integer not null check (quantity > 0),
  unit              text,

  dispensed_by      uuid references auth.users(id),
  dispensed_by_name text,                   -- snapshot nama apoteker
  dispensed_at      timestamptz not null default now(),
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_cdl_tenant       on controlled_drug_logs(tenant_id);
create index if not exists idx_cdl_dispensed_at on controlled_drug_logs(tenant_id, dispensed_at desc);
create index if not exists idx_cdl_drug_class   on controlled_drug_logs(tenant_id, drug_class);
create index if not exists idx_cdl_medicine     on controlled_drug_logs(medicine_id) where medicine_id is not null;

alter table controlled_drug_logs enable row level security;

-- Tenant-isolation (+ superadmin). Fungsi RLS dibungkus (select ...) untuk init-plan.
create policy "cdl_tenant_isolation" on controlled_drug_logs
  for all
  using ( (select public.is_superadmin()) or tenant_id = (select public.get_tenant_id()) )
  with check ( (select public.is_superadmin()) or tenant_id = (select public.get_tenant_id()) );

create trigger trg_cdl_updated_at before update on controlled_drug_logs
  for each row execute function public.update_updated_at();
