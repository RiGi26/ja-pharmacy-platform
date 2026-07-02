'use client'

import { useEffect, useRef } from 'react'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { markCoachmarkSeen } from '@/app/actions/onboarding'
import { isDriverBusy, registerDriver, releaseDriver } from '@/lib/onboarding/driver-guard'
import { firstVisible } from '@/lib/onboarding/visible'

// ============================================================
// PageCoachmark — one-time contextual hint pointing at a page's primary action.
// Fires the first time a user lands on a page (when `seen` is false), highlights the
// target once, then persists it as seen. Retries briefly while the target (rendered
// by a client component) mounts, and never marks seen if the target never appears.
// ============================================================

interface PageCoachmarkProps {
  coachKey: string
  /** CSS selector of the element to highlight (usually a data-coach anchor). */
  target: string
  title: string
  description: string
  seen: boolean
}

export function PageCoachmark({ coachKey, target, title, description, seen }: PageCoachmarkProps) {
  const started = useRef(false)

  useEffect(() => {
    if (seen || started.current) return

    let cancelled = false
    let d: Driver | null = null
    let tries = 0

    const tryStart = () => {
      if (cancelled) return
      const el = firstVisible(target)
      // Defer while another driver.js UI is up (tour or another coachmark) —
      // driver.js keeps config/state module-global, so a second live instance
      // breaks the visible popover's buttons. Give up unseen → shows next visit.
      if (el && !isDriverBusy()) {
        started.current = true
        let preempted = false
        const handle = {
          destroy: () => {
            preempted = true
            d?.destroy()
          },
        }
        d = driver({
          allowClose: true,
          overlayColor: 'rgba(2, 6, 23, 0.55)',
          doneBtnText: 'Mengerti',
          showProgress: false,
          popoverClass: 'ja-tour',
          onDestroyed: () => {
            releaseDriver(handle)
            // A coachmark preempted by the tour is not "seen" — let it retry later.
            if (!preempted) void markCoachmarkSeen(coachKey)
          },
        })
        registerDriver(handle)
        d.setSteps([{ element: el, popover: { title, description } }])
        d.drive()
        return
      }
      if (tries++ < 10) setTimeout(tryStart, 400)
    }

    const t = setTimeout(tryStart, 400)

    return () => {
      cancelled = true
      clearTimeout(t)
      if (d && d.isActive()) d.destroy()
    }
  }, [seen, target, title, description, coachKey])

  return null
}
