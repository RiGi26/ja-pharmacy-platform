// ============================================================
// Viewport-aware anchor picking for tour/coachmark targets.
// This portal renders the mobile sidebar ALWAYS (translated off-screen with
// -translate-x-full), so getClientRects() alone reports it "visible" and the
// tour would highlight elements the user cannot see. An anchor counts only if
// its box actually intersects the viewport.
// ============================================================

export function isInViewport(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false
  const r = el.getBoundingClientRect()
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.right > 0 &&
    r.bottom > 0 &&
    r.left < window.innerWidth &&
    r.top < window.innerHeight
  )
}

/** First element matching `selector` that the user can actually see. */
export function firstVisible(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return els.find(isInViewport) ?? null
}
