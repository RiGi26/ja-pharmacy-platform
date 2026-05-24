-- ═══════════════════════════════════════════════════════════
-- Row Level Security Policies
-- NOTE: Helper functions created in PUBLIC schema (not auth schema)
-- because Supabase SQL Editor does not allow writing to auth schema.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_tenant_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    (auth.jwt() ->> 'tenant_id')::uuid
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS text AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'role'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS boolean AS $$
  SELECT public.get_user_role() = 'superadmin';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

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
-- TENANTS
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "tenants_superadmin" ON tenants;
CREATE POLICY "tenants_superadmin" ON tenants
  FOR ALL USING (public.is_superadmin());

DROP POLICY IF EXISTS "tenants_own" ON tenants;
CREATE POLICY "tenants_own" ON tenants
  FOR SELECT USING (id = public.get_tenant_id());

DROP POLICY IF EXISTS "tenants_own_via_profile" ON tenants;
CREATE POLICY "tenants_own_via_profile" ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- ──────────────────────────────────────────────
-- TENANT CONFIGS
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "tenant_configs_access" ON tenant_configs;
CREATE POLICY "tenant_configs_access" ON tenant_configs
  FOR ALL USING (
    public.is_superadmin() OR tenant_id = public.get_tenant_id()
  );

-- ──────────────────────────────────────────────
-- USER PROFILES
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "user_profiles_access" ON user_profiles;
CREATE POLICY "user_profiles_access" ON user_profiles
  FOR ALL USING (
    public.is_superadmin()
    OR tenant_id = public.get_tenant_id()
    OR user_id = auth.uid()
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
      'DROP POLICY IF EXISTS "%s_tenant_isolation" ON %I', tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_tenant_isolation" ON %I
       FOR ALL USING (
         public.is_superadmin() OR tenant_id = public.get_tenant_id()
       )',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ──────────────────────────────────────────────
-- INSERT-ONLY POLICIES
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id() OR public.is_superadmin());

DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
CREATE POLICY "stock_movements_insert" ON stock_movements
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id() OR public.is_superadmin());

DROP POLICY IF EXISTS "price_histories_insert" ON price_histories;
CREATE POLICY "price_histories_insert" ON price_histories
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id() OR public.is_superadmin());
