-- ═══════════════════════════════════════════════════════════
-- ja-pharmacy-platform · Initial Schema
-- Multi-tenant row-level security
-- ═══════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ──────────────────────────────────────────────
-- TENANTS
-- ──────────────────────────────────────────────
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  address     text,
  phone       text,
  wa_number   text,
  email       text,
  logo_url    text,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'trial')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_configs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  wa_token                text,
  wa_sender               text,
  clinic_webhook_secret   text,
  clinic_api_url          text,
  printer_width           integer NOT NULL DEFAULT 80,
  expired_warn_h180       boolean NOT NULL DEFAULT true,
  expired_warn_h90        boolean NOT NULL DEFAULT true,
  auto_daily_report       boolean NOT NULL DEFAULT true,
  notif_settings          jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- USER PROFILES (linked to Supabase Auth)
-- ──────────────────────────────────────────────
CREATE TABLE user_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name   text NOT NULL,
  role        text NOT NULL DEFAULT 'kasir'
                CHECK (role IN ('superadmin', 'owner', 'admin', 'apoteker', 'kasir')),
  phone       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_tenant ON user_profiles(tenant_id);
CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);

-- ──────────────────────────────────────────────
-- SUPPLIERS
-- ──────────────────────────────────────────────
CREATE TABLE suppliers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  phone       text,
  email       text,
  address     text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);

-- ──────────────────────────────────────────────
-- MEDICINES
-- ──────────────────────────────────────────────
CREATE TABLE medicines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barcode         text,
  name            text NOT NULL,
  generic_name    text,
  category        text,
  drug_class      text CHECK (drug_class IN (
                    'bebas', 'bebas_terbatas', 'keras', 'psikotropika', 'narkotika'
                  )),
  unit            text,
  sell_price      numeric(12,2) NOT NULL DEFAULT 0,
  rack_location   text,
  min_stock       integer NOT NULL DEFAULT 10,
  is_prescription boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_medicines_tenant ON medicines(tenant_id);
CREATE INDEX idx_medicines_barcode ON medicines(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_medicines_name ON medicines USING gin(to_tsvector('indonesian', name));

-- ──────────────────────────────────────────────
-- MEDICINE BATCHES
-- ──────────────────────────────────────────────
CREATE TABLE medicine_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  medicine_id   uuid NOT NULL REFERENCES medicines(id),
  batch_number  text NOT NULL,
  supplier_id   uuid REFERENCES suppliers(id),
  expiry_date   date NOT NULL,
  quantity      integer NOT NULL DEFAULT 0,
  buy_price     numeric(12,2) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'LAYAK_JUAL'
                  CHECK (status IN (
                    'LAYAK_JUAL', 'WARNING', 'DILARANG_JUAL',
                    'DISPOSED', 'RETURNED', 'EMPTY'
                  )),
  discount_pct  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_batches_tenant ON medicine_batches(tenant_id);
CREATE INDEX idx_batches_medicine ON medicine_batches(medicine_id);
CREATE INDEX idx_batches_expiry ON medicine_batches(expiry_date) WHERE status NOT IN ('DISPOSED', 'RETURNED', 'EMPTY');

-- ──────────────────────────────────────────────
-- PRICE HISTORIES
-- ──────────────────────────────────────────────
CREATE TABLE price_histories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  medicine_id     uuid NOT NULL REFERENCES medicines(id),
  old_sell_price  numeric(12,2) NOT NULL,
  new_sell_price  numeric(12,2) NOT NULL,
  changed_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- SHIFTS
-- ──────────────────────────────────────────────
CREATE TABLE shifts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cashier_id          uuid NOT NULL REFERENCES auth.users(id),
  opening_balance     numeric(12,2) NOT NULL DEFAULT 0,
  closing_balance     numeric(12,2),
  total_transactions  integer NOT NULL DEFAULT 0,
  total_cash          numeric(12,2) NOT NULL DEFAULT 0,
  total_qris          numeric(12,2) NOT NULL DEFAULT 0,
  total_transfer      numeric(12,2) NOT NULL DEFAULT 0,
  opened_at           timestamptz NOT NULL DEFAULT now(),
  closed_at           timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- PRESCRIPTIONS (from clinic)
-- ──────────────────────────────────────────────
CREATE TABLE prescriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clinic_prescription_id  text NOT NULL,
  patient_name            text NOT NULL,
  patient_phone           text,
  doctor_name             text,
  clinic_name             text,
  items                   jsonb NOT NULL DEFAULT '[]',
  status                  text NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PROCESSING', 'DISPENSED', 'CANCELLED')),
  dispensed_by            uuid REFERENCES auth.users(id),
  dispensed_at            timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, clinic_prescription_id)
);

CREATE INDEX idx_prescriptions_tenant ON prescriptions(tenant_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status) WHERE status IN ('PENDING', 'PROCESSING');

-- ──────────────────────────────────────────────
-- TRANSACTIONS
-- ──────────────────────────────────────────────
CREATE TABLE transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number   text NOT NULL,
  cashier_id       uuid NOT NULL REFERENCES auth.users(id),
  shift_id         uuid REFERENCES shifts(id),
  prescription_id  uuid REFERENCES prescriptions(id),
  payment_method   text NOT NULL CHECK (payment_method IN ('cash', 'qris', 'transfer')),
  subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  discount         numeric(12,2) NOT NULL DEFAULT 0,
  total            numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount      numeric(12,2) NOT NULL DEFAULT 0,
  change_amount    numeric(12,2) NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'COMPLETED'
                     CHECK (status IN ('COMPLETED', 'VOIDED', 'PENDING_VOID')),
  offline_local_id text,
  void_reason      text,
  void_by          uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX idx_transactions_cashier ON transactions(cashier_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

CREATE TABLE transaction_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  medicine_id    uuid NOT NULL REFERENCES medicines(id),
  batch_id       uuid NOT NULL REFERENCES medicine_batches(id),
  quantity       integer NOT NULL,
  unit_price     numeric(12,2) NOT NULL,
  discount_pct   integer NOT NULL DEFAULT 0,
  subtotal       numeric(12,2) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tx_items_transaction ON transaction_items(transaction_id);

-- ──────────────────────────────────────────────
-- STOCK MOVEMENTS
-- ──────────────────────────────────────────────
CREATE TABLE stock_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id),
  batch_id    uuid NOT NULL REFERENCES medicine_batches(id),
  type        text NOT NULL CHECK (type IN (
                'IN', 'OUT', 'ADJUST', 'RETURN', 'DISPOSE',
                'VOID_ROLLBACK', 'DISPENSING', 'INITIAL'
              )),
  quantity    integer NOT NULL,  -- positive = masuk, negative = keluar
  ref_id      uuid,
  ref_type    text,
  note        text,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX idx_movements_medicine ON stock_movements(medicine_id);

-- ──────────────────────────────────────────────
-- DISPOSALS (Retur & Pemusnahan)
-- ──────────────────────────────────────────────
CREATE TABLE disposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('RETURN', 'DESTRUCTION')),
  medicine_id  uuid NOT NULL REFERENCES medicines(id),
  batch_id     uuid NOT NULL REFERENCES medicine_batches(id),
  quantity     integer NOT NULL,
  reason       text NOT NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by  uuid REFERENCES auth.users(id),
  status       text NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  supplier_id  uuid REFERENCES suppliers(id),
  document_url text,
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- AUDIT LOGS
-- ──────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  action      text NOT NULL CHECK (action IN (
                'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'VOID', 'LOGIN', 'LOGOUT'
              )),
  table_name  text NOT NULL,
  record_id   uuid NOT NULL,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ──────────────────────────────────────────────
-- SCAN LOGS
-- ──────────────────────────────────────────────
CREATE TABLE scan_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barcode     text NOT NULL,
  scanned_by  uuid NOT NULL REFERENCES auth.users(id),
  context     text NOT NULL DEFAULT 'pos',  -- pos | stock_in | inventory
  medicine_id uuid REFERENCES medicines(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- TRIGGERS: updated_at auto-update
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tenants', 'tenant_configs', 'user_profiles', 'suppliers',
    'medicines', 'medicine_batches', 'prescriptions',
    'transactions', 'disposals'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;

-- ──────────────────────────────────────────────
-- NIGHTLY EXPIRED BATCH STATUS UPDATE (pg_cron)
-- Runs 01:00 WIB = 18:00 UTC
-- ──────────────────────────────────────────────
SELECT cron.schedule(
  'update-batch-expiry-status',
  '0 18 * * *',
  $$
    UPDATE medicine_batches SET status =
      CASE
        WHEN expiry_date < CURRENT_DATE       THEN 'DILARANG_JUAL'
        WHEN expiry_date <= CURRENT_DATE + 30 THEN 'DILARANG_JUAL'
        WHEN expiry_date <= CURRENT_DATE + 90 THEN 'WARNING'
        ELSE 'LAYAK_JUAL'
      END
    WHERE status NOT IN ('DISPOSED', 'RETURNED', 'EMPTY');
  $$
);
