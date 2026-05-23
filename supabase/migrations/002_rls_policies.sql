-- ═══════════════════════════════════════════════════════════
-- Row Level Security Policies
-- ═══════════════════════════════════════════════════════════

-- Helper: get tenant_id from JWT custom claims
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    (auth.jwt() ->> 'tenant_id')::uuid
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.user_role() RETURNS text AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'role'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.is_superadmin() RETURNS boolean AS $$
  SELECT auth.user_role() = 'superadmin';
$$ LANGUAGE sql STABLE;

-- ──────────────────────────────────────────────
-- Enable RLS on all tables
-- ──────────────────────────────────────────────
ALTER TABLE tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_histories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs          ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- TENANTS: superadmin sees all, others see own
-- ──────────────────────────────────────────────
CREATE POLICY "tenants_superadmin" ON tenants
  FOR ALL USING (auth.is_superadmin());

CREATE POLICY "tenants_own" ON tenants
  FOR SELECT USING (id = auth.tenant_id());

-- ──────────────────────────────────────────────
-- TENANT CONFIGS
-- ──────────────────────────────────────────────
CREATE POLICY "tenant_configs_access" ON tenant_configs
  FOR ALL USING (
    auth.is_superadmin() OR tenant_id = auth.tenant_id()
  );

-- ──────────────────────────────────────────────
-- USER PROFILES
-- ──────────────────────────────────────────────
CREATE POLICY "user_profiles_access" ON user_profiles
  FOR ALL USING (
    auth.is_superadmin() OR tenant_id = auth.tenant_id()
  );

-- ──────────────────────────────────────────────
-- GENERIC TENANT-SCOPED POLICY (for most tables)
-- ──────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'suppliers', 'medicines', 'medicine_batches', 'price_histories',
    'shifts', 'prescriptions', 'transactions', 'transaction_items',
    'stock_movements', 'disposals', 'audit_logs', 'scan_logs'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "%s_tenant_isolation" ON %I
       FOR ALL USING (
         auth.is_superadmin() OR tenant_id = auth.tenant_id()
       )',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ──────────────────────────────────────────────
-- AUDIT LOG: insert-only (append-only)
-- ──────────────────────────────────────────────
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_superadmin());

-- stock_movements and price_histories are also insert-only
CREATE POLICY "stock_movements_insert" ON stock_movements
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_superadmin());

CREATE POLICY "price_histories_insert" ON price_histories
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_superadmin());
