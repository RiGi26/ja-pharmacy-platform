'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { WelcomeModal } from './WelcomeModal'
import { dismissWelcome, completeTour } from '@/app/actions/onboarding'
import type { OnboardingTrack } from '@/lib/onboarding/steps'

// driver.js + CSS stay out of the initial bundle until the tour actually runs.
const ProductTour = dynamic(() => import('./ProductTour').then((m) => m.ProductTour), { ssr: false })

// ============================================================
// OnboardingLauncher — mounted once in the dashboard layout. Owns the first-run
// flow: welcome modal → tour. Listens for a window event so the checklist and the
// "?" help button can replay the tour on demand. Persistence is fire-and-forget.
// ============================================================

interface OnboardingLauncherProps {
  showWelcome: boolean
  showTour: boolean
  track: OnboardingTrack
  userName: string
}

export function OnboardingLauncher({ showWelcome, showTour, track, userName }: OnboardingLauncherProps) {
  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome)
  const [runToken, setRunToken] = useState(0)

  const startTour = useCallback(() => {
    setWelcomeOpen(false)
    void dismissWelcome()
    setRunToken((t) => t + 1)
  }, [])

  // Skipping the welcome = done with first-run: mark tour complete too so it never
  // auto-shows again (user can still replay via the "?" button / checklist).
  const skip = useCallback(() => {
    setWelcomeOpen(false)
    void dismissWelcome()
    void completeTour()
  }, [])

  // Radix-driven closes (escape / overlay click) count the same as skip.
  const handleOpenChange = useCallback((open: boolean) => {
    setWelcomeOpen(open)
    if (!open) {
      void dismissWelcome()
      void completeTour()
    }
  }, [])

  const onTourDone = useCallback(() => {
    void completeTour()
  }, [])

  // Replay the tour from the checklist footer or the "?" help button.
  useEffect(() => {
    const handler = () => setRunToken((t) => t + 1)
    window.addEventListener('onboarding:replay-tour', handler)
    return () => window.removeEventListener('onboarding:replay-tour', handler)
  }, [])

  return (
    <>
      <WelcomeModal
        open={welcomeOpen}
        onOpenChange={handleOpenChange}
        track={track}
        userName={userName}
        onStartTour={startTour}
        onSkip={skip}
      />
      {/* Mount the tour lazily; it stays inert until runToken increments. */}
      {(showTour || runToken > 0) && (
        <ProductTour runToken={runToken} track={track} onDone={onTourDone} />
      )}
    </>
  )
}
