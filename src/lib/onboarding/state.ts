import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getTenantEntitlements } from '@/lib/tenant-entitlements'
import { STEPS_BY_TRACK, trackForRole, type OnboardingTrack } from './steps'

// ============================================================
// Onboarding state — computed server-side on dashboard load. Derived steps run
// their real-data resolvers in parallel; manual steps read from the persisted
// completed_steps array. Wrapped in React cache() so the layout (launcher flags)
// and the page (full checklist) share one computation per request.
// ============================================================

export interface ChecklistItem {
  key: string
  title: string
  desc: string
  ctaLabel: string
  href: string
  done: boolean
  /** true = completion is marked by the user (not derived from data) */
  manual: boolean
}

export interface OnboardingState {
  role: string
  track: OnboardingTrack
  userName: string
  items: ChecklistItem[]
  total: number
  completed: number
  progress: number // 0..100
  allDone: boolean
  checklistVisible: boolean
  showWelcome: boolean
  showTour: boolean
}

/** Signed-in user + tenant context for onboarding (one query set per request). */
const getOnboardingContext = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id, role, full_name')
    .eq('user_id', user.id)
    .single()
  if (!profile) return null

  const [{ data: tenant }, ent] = await Promise.all([
    supabase.from('tenants').select('slug').eq('id', profile.tenant_id).single(),
    getTenantEntitlements(profile.tenant_id),
  ])

  return {
    supabase,
    userId: user.id,
    tenantId: profile.tenant_id as string,
    role: profile.role as string,
    userName: (profile.full_name as string) ?? '',
    // Single shared tenant is the pitch/demo apotek; its pre-seeded data would
    // render the checklist ~complete and confuse prospects.
    isDemo: tenant?.slug === 'demo',
    entitlements: ent.entitlements as string[],
  }
})

const EMPTY: OnboardingState = {
  role: '',
  track: 'operator',
  userName: '',
  items: [],
  total: 0,
  completed: 0,
  progress: 0,
  allDone: false,
  checklistVisible: false,
  showWelcome: false,
  showTour: false,
}

/** Keys of contextual coachmarks / feature announcements this user has already seen. */
export const getSeenCoachmarks = cache(async (): Promise<string[]> => {
  const ctx = await getOnboardingContext()
  if (!ctx) return []
  const { data } = await ctx.supabase
    .from('user_onboarding')
    .select('seen_coachmarks')
    .eq('user_id', ctx.userId)
    .maybeSingle()
  return Array.isArray(data?.seen_coachmarks) ? (data!.seen_coachmarks as string[]) : []
})

export const getOnboardingState = cache(async (): Promise<OnboardingState> => {
  const ctx = await getOnboardingContext()
  if (!ctx) return EMPTY

  const track = trackForRole(ctx.role)
  const defs = STEPS_BY_TRACK[track].filter(
    (s) => !s.feature || ctx.entitlements.includes(s.feature)
  )

  const { data: row } = await ctx.supabase
    .from('user_onboarding')
    .select('completed_steps, welcome_dismissed_at, tour_completed_at, checklist_dismissed_at')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  const showWelcome = !row?.welcome_dismissed_at
  const showTour = !row?.tour_completed_at
  const checklistDismissed = !!row?.checklist_dismissed_at

  // Skip the checklist entirely when:
  //  - demo tenant: data is pre-seeded, so a "misi pertama" checklist reads as ~done
  //    and confuses prospects — demo keeps only welcome + tour (feature discovery);
  //  - already dismissed: never show again, and avoid the per-load resolver queries;
  //  - no applicable steps for this role/entitlements.
  if (ctx.isDemo || checklistDismissed || defs.length === 0) {
    return {
      ...EMPTY,
      role: ctx.role,
      track,
      userName: ctx.userName,
      showWelcome,
      showTour,
    }
  }

  const completedManual: string[] = Array.isArray(row?.completed_steps)
    ? (row!.completed_steps as string[])
    : []

  // Derived resolvers are independent → run in parallel.
  const resolved = await Promise.all(
    defs.map((d) => (d.resolver ? d.resolver(ctx.supabase, ctx.tenantId) : Promise.resolve<boolean | null>(null)))
  )

  const items: ChecklistItem[] = defs.map((d, i) => {
    const manual = !d.resolver
    const done = manual ? completedManual.includes(d.key) : !!resolved[i]
    return { key: d.key, title: d.title, desc: d.desc, ctaLabel: d.ctaLabel, href: d.href, done, manual }
  })

  const total = items.length
  const completed = items.filter((i) => i.done).length
  const allDone = total > 0 && completed === total

  return {
    role: ctx.role,
    track,
    userName: ctx.userName,
    items,
    total,
    completed,
    progress: total ? Math.round((completed / total) * 100) : 0,
    allDone,
    checklistVisible: !allDone,
    showWelcome,
    showTour,
  }
})
