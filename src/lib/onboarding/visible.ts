// ============================================================
// Viewport-aware anchor picking for tour/coachmark targets.
// This portal renders the mobile sidebar ALWAYS (translated off-screen with
// -translate-x-full), so getClientRects() alone reports it "visible" and the
// tour would highlight elements the user cannot see.
//
// The filter is HORIZONTAL-only on purpose: below-the-fold anchors (e.g. the
// dashboard quick-action cards on a phone) are legitimate targets — driver.js
// scrolls to them — while the hidden sidebar sits entirely left of x=0.
// ============================================================

export function isReachable(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth
}

/** First element matching `selector` that the user can actually see or scroll to. */
export function firstVisible(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return els.find(isReachable) ?? null
}
