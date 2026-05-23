-- ═══════════════════════════════════════════════════════════
-- Fix RLS: allow users to read their own profile without JWT claims
-- This resolves the login redirect loop on first login
-- ═══════════════════════════════════════════════════════════

-- 1. Allow user to read/write their own profile via auth.uid()
DROP POLICY IF EXISTS "user_profiles_access" ON user_profiles;
CREATE POLICY "user_profiles_access" ON user_profiles
  FOR ALL USING (
    auth.is_superadmin()
    OR tenant_id = auth.tenant_id()
    OR user_id = auth.uid()
  );

-- 2. Allow user to read their tenant via profile lookup (no JWT claim needed)
DROP POLICY IF EXISTS "tenants_own_via_profile" ON tenants;
CREATE POLICY "tenants_own_via_profile" ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════
-- Custom Access Token Hook
-- Injects tenant_id + role into JWT app_metadata on every login
-- AFTER creating this function, register it in:
--   Supabase Dashboard → Authentication → Hooks → Custom Access Token
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  v_tenant_id uuid;
  v_role text;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_role
  FROM public.user_profiles
  WHERE user_id = (event->>'user_id')::uuid
    AND is_active = true;

  claims := event->'claims';

  IF v_tenant_id IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) ||
        jsonb_build_object('tenant_id', v_tenant_id, 'role', v_role)
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
