// ============================================================
// driver-guard — one driver.js UI at a time.
// driver.js (v1.x) keeps its config & state in MODULE-GLOBAL variables, so two
// live instances (e.g. a layout feature announcement + a page coachmark, or the
// product tour + a coachmark) overwrite each other's config and the visible
// popover's buttons stop responding. This tiny client-side registry serializes
// them: coachmarks defer while another driver is active, and the tour (an
// explicit user action) preempts whatever is showing.
// ============================================================

interface DriverHandle {
  /** Tear down this driver's UI without treating it as user-completed. */
  destroy: () => void
}

let active: DriverHandle | null = null

export function isDriverBusy(): boolean {
  return active !== null
}

export function registerDriver(handle: DriverHandle): void {
  active = handle
}

export function releaseDriver(handle: DriverHandle): void {
  if (active === handle) active = null
}

/** Destroy the currently active driver UI (if any), e.g. before starting the tour. */
export function preemptDriver(): void {
  const handle = active
  active = null
  handle?.destroy()
}
