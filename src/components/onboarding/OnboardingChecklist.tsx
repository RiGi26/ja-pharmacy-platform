'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTransition } from 'react'
import { Check, X, ArrowRight, PlayCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dismissChecklist, markStepDone } from '@/app/actions/onboarding'
import type { ChecklistItem } from '@/lib/onboarding/state'

// ============================================================
// OnboardingChecklist — "Misi Pertama" card on the dashboard (Activate phase).
// Derived steps auto-tick from real data; manual steps mark done on CTA click then
// navigate. Dismissible; hidden once all steps are complete (parent decides
// visibility via getOnboardingState()).
// ============================================================

interface OnboardingChecklistProps {
  items: ChecklistItem[]
  completed: number
  total: number
  progress: number
}

export function OnboardingChecklist({ items, completed, total, progress }: OnboardingChecklistProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleManual(key: string, href: string) {
    startTransition(async () => {
      await markStepDone(key)
      router.push(href)
    })
  }

  function replayTour() {
    window.dispatchEvent(new CustomEvent('onboarding:replay-tour'))
  }

  return (
    <Card data-tour="onboarding-checklist" className="mb-6 animate-fade-in">
      <CardContent className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-gray-900 sm:text-lg">
              Misi Pertama
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
              Selesaikan langkah ini untuk menyiapkan apotekmu.
            </p>
          </div>
          <button
            onClick={() => startTransition(() => void dismissChecklist())}
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Sembunyikan Misi Pertama"
            title="Sembunyikan"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress */}
        <div className="mt-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
            <span className="text-blue-600">{completed} dari {total} selesai</span>
            <span className="text-gray-400 tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <ul className="mt-4 space-y-1.5">
          {items.map((item) => (
            <li
              key={item.key}
              className={cn(
                'flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors',
                item.done ? 'opacity-70' : 'hover:bg-gray-50'
              )}
            >
              {/* Status circle */}
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                  item.done
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-transparent'
                )}
              >
                <Check size={14} strokeWidth={3} />
              </span>

              {/* Label */}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm font-semibold',
                    item.done ? 'text-gray-500 line-through' : 'text-gray-900'
                  )}
                >
                  {item.title}
                </p>
                {!item.done && <p className="mt-0.5 text-xs text-gray-500">{item.desc}</p>}
              </div>

              {/* CTA — only while incomplete */}
              {!item.done &&
                (item.manual ? (
                  <button
                    onClick={() => handleManual(item.key, item.href)}
                    disabled={pending}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-600/10 disabled:opacity-50"
                  >
                    {item.ctaLabel}
                    <ArrowRight size={14} strokeWidth={2.2} />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-600/10"
                  >
                    {item.ctaLabel}
                    <ArrowRight size={14} strokeWidth={2.2} />
                  </Link>
                ))}
            </li>
          ))}
        </ul>

        {/* Footer — replay tour */}
        <div className="mt-3 border-t border-gray-100 pt-3">
          <button
            onClick={replayTour}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-800"
          >
            <PlayCircle size={15} strokeWidth={1.8} />
            Putar ulang tur
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
