import type { EntitlementKey } from '@/lib/entitlements'

// ============================================================
// Feature announcements — one-time "Fitur baru: …" coachmarks shown to EXISTING
// users when something new ships. Reuses the seen_coachmarks store + PageCoachmark.
//
// To announce a new feature: add an entry here. It shows once, to users who
// (a) hold the entitlement (if `feature` is set) and (b) haven't seen `key` yet,
// and (c) have already finished first-run onboarding (so brand-new users aren't
// double-guided). Keep `key` stable & unique; bump the suffix (e.g. -v2) to re-announce.
// ============================================================

export interface FeatureAnnouncement {
  /** stored in user_onboarding.seen_coachmarks; use a 'feature:' prefix */
  key: string
  /** only show to tenants holding this entitlement (omit = everyone) */
  feature?: EntitlementKey
  /** CSS selector of the element to highlight (must be visible on load) */
  selector: string
  title: string
  description: string
}

export const FEATURE_ANNOUNCEMENTS: FeatureAnnouncement[] = [
  {
    key: 'feature:help-button-v1',
    selector: '[data-coach="help-button"]',
    title: 'Baru: tombol Panduan',
    description: 'Klik ikon ini kapan saja untuk memutar ulang tur portal.',
  },
]

/** First eligible, unseen announcement whose entitlement (if any) the tenant holds. */
export function firstPendingAnnouncement(
  entitlements: string[],
  seen: string[]
): FeatureAnnouncement | null {
  return (
    FEATURE_ANNOUNCEMENTS.find(
      (a) => (!a.feature || entitlements.includes(a.feature)) && !seen.includes(a.key)
    ) ?? null
  )
}
