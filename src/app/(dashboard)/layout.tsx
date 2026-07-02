import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { OnboardingLauncher } from '@/components/onboarding/OnboardingLauncher'
import { PageCoachmark } from '@/components/onboarding/PageCoachmark'
import { getTenantEntitlements } from '@/lib/tenant-entitlements'
import { isSubscriptionActive } from '@/lib/entitlements'
import { getOnboardingState, getSeenCoachmarks } from '@/lib/onboarding/state'
import { firstPendingAnnouncement } from '@/lib/onboarding/coachmarks'
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

  // Shares one computation with the dashboard page via React cache().
  const onboarding = await getOnboardingState()

  // Feature announcements: only for users past first-run onboarding, so we don't
  // pile a "what's new" on top of the welcome/tour a brand-new user is still doing.
  const announcement =
    !onboarding.showWelcome && !onboarding.showTour
      ? firstPendingAnnouncement(ent.entitlements, await getSeenCoachmarks())
      : null

  return (
    <DashboardLayout
      role={profile.role as UserRole}
      tenantName={tenant?.name}
      entitlements={entitlements}
    >
      {children}
      {/* Always mounted so the "?" help button can replay the tour even after
          onboarding is done; welcome only opens when showWelcome, driver.js stays lazy. */}
      <OnboardingLauncher
        showWelcome={onboarding.showWelcome}
        showTour={onboarding.showTour}
        track={onboarding.track}
        userName={onboarding.userName}
      />
      {announcement && (
        <PageCoachmark
          coachKey={announcement.key}
          target={announcement.selector}
          title={announcement.title}
          description={announcement.description}
          seen={false}
        />
      )}
    </DashboardLayout>
  )
}
