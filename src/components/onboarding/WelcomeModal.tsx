'use client'

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Pill, ShoppingCart, BarChart2, Package, ArrowRight } from 'lucide-react'
import type { OnboardingTrack } from '@/lib/onboarding/steps'

// ============================================================
// WelcomeModal — one-time first-run greeting (Orient phase). Role-based copy.
// Presentational only: parent (OnboardingLauncher) owns open state + persistence.
// ============================================================

interface WelcomeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  track: OnboardingTrack
  userName: string
  onStartTour: () => void
  onSkip: () => void
}

const COPY: Record<OnboardingTrack, { title: string; desc: string; points: { icon: React.ElementType; text: string }[] }> = {
  owner: {
    title: 'Selamat datang di Portal Apotek',
    desc: 'Kami bantu siapkan apotekmu langkah demi langkah, supaya kamu bisa mulai melayani hari ini.',
    points: [
      { icon: Pill, text: 'Kelola master obat & stok per batch' },
      { icon: ShoppingCart, text: 'Layani penjualan lewat kasir (POS)' },
      { icon: BarChart2, text: 'Pantau omzet lewat laporan' },
    ],
  },
  operator: {
    title: 'Selamat datang',
    desc: 'Kenali portal sebentar, supaya kamu nyaman melayani pembeli setiap hari.',
    points: [
      { icon: ShoppingCart, text: 'Layani pembeli di kasir (POS)' },
      { icon: Package, text: 'Cek stok dan batch obat' },
      { icon: BarChart2, text: 'Pantau alert kedaluwarsa' },
    ],
  },
}

export function WelcomeModal({ open, onOpenChange, track, userName, onStartTour, onSkip }: WelcomeModalProps) {
  const copy = COPY[track]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false}>
        {/* Icon badge */}
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10">
          <Sparkles className="h-6 w-6 text-blue-600" strokeWidth={2} />
        </div>

        <div className="mt-4">
          <DialogTitle>
            {copy.title}
            {userName ? `, ${userName.split(' ')[0]}` : ''}
          </DialogTitle>
          <DialogDescription>{copy.desc}</DialogDescription>
        </div>

        {/* What you can do */}
        <ul className="mt-5 space-y-2.5">
          {copy.points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              {text}
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onSkip} className="sm:w-auto">
            Lewati dulu
          </Button>
          <Button onClick={onStartTour} className="gap-2">
            Mulai tur singkat
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
