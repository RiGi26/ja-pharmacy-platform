-- ============================================================
-- Tier gating (Farmasi). Local cache of each tenant's per-pharmacy package
-- (Starter / Growth / Pro). Source of truth = superadmin Core DB; this table is
-- mirrored here via POST /api/billing/sync so the app can gate features
-- server-side without a Core round-trip on every request.
--
-- Behaviour-preserving: a tenant WITHOUT a row keeps FULL access (the app treats
-- a missing row as status 'legacy' -> all features). Only tenants that Core has
-- explicitly synced get the gated experience -- no existing tenant loses anything
-- when this ships (CLAUDE.md migration rule).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenant_entitlements (
  tenant_id        uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  tier             text NOT NULL DEFAULT 'starter',           -- starter | growth | pro
  entitlements     jsonb NOT NULL DEFAULT '[]'::jsonb,         -- EntitlementKey[]
  max_active_users integer,                                    -- active staff/kasir quota; null = unlimited
  status           text NOT NULL DEFAULT 'active',             -- active|trialing|trial|past_due|suspended|cancelled|expired
  linked_tenant_id uuid,                                       -- Core tenants.id (== this id for pharmacy; kept for parity)
  synced_at        timestamptz DEFAULT now(),
  expires_at       timestamptz,
  created_at       timestamptz DEFAULT now()
);

-- Reverse lookup from a Core tenant uuid (used by the billing sync caller).
CREATE INDEX IF NOT EXISTS idx_tenant_entitlements_linked_tenant
  ON public.tenant_entitlements (linked_tenant_id);

ALTER TABLE public.tenant_entitlements ENABLE ROW LEVEL SECURITY;

-- Read-own backstop. The app itself reads via the service-role client (bypasses
-- RLS); this policy only covers any authenticated path. Writes are service-role
-- only (no write policy -> blocked for normal roles).
DROP POLICY IF EXISTS tenant_entitlements_read_own ON public.tenant_entitlements;
CREATE POLICY tenant_entitlements_read_own ON public.tenant_entitlements
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE user_id = (SELECT auth.uid()))
  );
