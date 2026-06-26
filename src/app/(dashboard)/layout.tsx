import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getTenantEntitlements } from '@/lib/tenant-entitlements'
import { isSubscriptionActive } from '@/lib/entitlements'
import type { UserRole } from '@/types'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, tenant_id, is_active')
    .eq('user_id', user.id)
    .single()

  if (!profile?.is_active) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, status')
    .eq('id', profile.tenant_id)
    .single()

  if (tenant?.status === 'suspended') redirect('/suspended')

  // Tier entitlements → filter the sidebar to the tenant's package. A tenant
  // without an entitlement row resolves to 'legacy' (all features) so nothing is
  // hidden until Core syncs a real tier. Suspended-by-billing → don't hide nav
  // (let them reach /dashboard & settings to resolve payment); features still
  // gated per-page.
  const ent = await getTenantEntitlements(profile.tenant_id)
  const entitlements = isSubscriptionActive(ent.status) ? ent.entitlements : undefined

  return (
    <DashboardLayout
      role={profile.role as UserRole}
      tenantName={tenant?.name}
      entitlements={entitlements}
    >
      {children}
    </DashboardLayout>
  )
}
