'use client'

import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import type { OnboardingTrack } from '@/lib/onboarding/steps'
import { preemptDriver, registerDriver, releaseDriver } from '@/lib/onboarding/driver-guard'
import { firstVisible } from '@/lib/onboarding/visible'

// ============================================================
// ProductTour — driver.js coachmark tour, role-aware, mobile-safe.
// Loaded via next/dynamic(ssr:false) from OnboardingLauncher, so driver.js + CSS
// stay out of the initial bundle. Runs whenever `runToken` increments to a new
// positive value.
//
// Each logical step points at a data-tour KEY. Desktop resolves to the sidebar;
// on mobile the sidebar is translated off-screen, so keys are ALSO placed on the
// dashboard quick-action cards where available and firstVisible() (viewport-aware)
// picks the anchor the user can actually see. Steps with no visible anchor are
// silently skipped.
// ============================================================

interface TourStep {
  /** data-tour key (without the attribute wrapper) */
  key: string
  title: string
  description: string
}

const OWNER_TOUR: TourStep[] = [
  {
    key: 'onboarding-checklist',
    title: 'Misi Pertama',
    description: 'Ikuti daftar singkat ini untuk menyiapkan apotekmu. Progresnya tersimpan otomatis.',
  },
  {
    key: 'nav-medicines',
    title: 'Obat',
    description: 'Mulai di sini — masukkan daftar obat yang kamu jual, lengkap dengan harga.',
  },
  {
    key: 'nav-inventory',
    title: 'Inventori',
    description: 'Catat stok masuk per batch, lengkap dengan tanggal kedaluwarsa.',
  },
  {
    key: 'nav-pos',
    title: 'Kasir (POS)',
    description: 'Layani pembeli di sini — scan barcode, keranjang, lalu terima pembayaran.',
  },
  {
    key: 'nav-reports',
    title: 'Laporan',
    description: 'Lihat omzet dan performa apotekmu kapan saja.',
  },
]

const OPERATOR_TOUR: TourStep[] = [
  {
    key: 'nav-pos',
    title: 'Kasir (POS)',
    description: 'Ini kerjaan utamamu — layani pembeli, scan barcode, terima pembayaran.',
  },
  {
    key: 'nav-inventory',
    title: 'Inventori',
    description: 'Cek sisa stok dan tanggal kedaluwarsa tiap batch di sini.',
  },
  {
    key: 'nav-dashboard',
    title: 'Dashboard',
    description: 'Ringkasan hari ini: penjualan, stok, dan alert kedaluwarsa.',
  },
]

interface ProductTourProps {
  runToken: number
  track: OnboardingTrack
  onDone: () => void
}

export function ProductTour({ runToken, track, onDone }: ProductTourProps) {
  const lastRun = useRef(0)

  useEffect(() => {
    if (runToken <= 0 || runToken === lastRun.current) return
    lastRun.current = runToken

    const defs = track === 'owner' ? OWNER_TOUR : OPERATOR_TOUR
    const steps = defs
      .map((s) => {
        const el = firstVisible(`[data-tour="${s.key}"]`)
        return el ? { element: el, popover: { title: s.title, description: s.description } } : null
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    if (steps.length === 0) {
      onDone()
      return
    }

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      onDone()
    }

    const handle = { destroy: () => d.destroy() }
    const d = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: 'rgba(2, 6, 23, 0.55)',
      nextBtnText: 'Lanjut',
      prevBtnText: 'Kembali',
      doneBtnText: 'Selesai',
      progressText: '{{current}} / {{total}}',
      popoverClass: 'ja-tour',
      onDestroyed: () => {
        releaseDriver(handle)
        finish()
      },
    })

    // The tour is an explicit user action — tear down any coachmark that's showing
    // (driver.js is a module-global singleton; two live instances break each other),
    // then hold the slot so coachmarks defer while the tour runs.
    preemptDriver()
    registerDriver(handle)
    d.setSteps(steps)
    d.drive()

    return () => {
      if (d.isActive()) d.destroy()
    }
  }, [runToken, track, onDone])

  return null
}
