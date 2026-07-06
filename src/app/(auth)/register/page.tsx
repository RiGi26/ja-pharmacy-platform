'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PortalRegisterCard, type RegisterData } from '@/components/auth/PortalRegisterCard'

// Core enum tier → display label (mirrors the pricing page / other portals).
const PLAN_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Growth', enterprise: 'Pro' }

function RegisterForm() {
  const searchParams = useSearchParams()
  const subscribe = searchParams.get('intent') === 'subscribe'
  const tier = searchParams.get('tier')
  const period = searchParams.get('period') === 'yearly' ? 'yearly' : 'monthly'
  const planLabel = (tier && PLAN_LABEL[tier]) || undefined
  // A bare intent without a recognised tier falls back to the trial copy + flow.
  // One consistent flag now drives heading, badge, button, AND redirect (fixes the
  // old page where the button used raw intent while the redirect used the guarded value).
  const subscribing = subscribe && !!planLabel

  async function handleRegister(data: RegisterData): Promise<{ error?: string } | void> {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        namaApotek: data.businessName,
        adminName: data.adminName,
        email: data.email,
        password: data.password,
        phone: data.whatsapp,
      }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      return { error: json?.error ?? 'Registrasi gagal. Coba lagi.' }
    }
    // Success: the API already signed the user in (session cookie set server-side).
    // Paid signup with a valid tier → straight to Midtrans checkout; otherwise → dashboard root.
    if (subscribing && tier) {
      window.location.assign(`/api/billing/checkout?tier=${encodeURIComponent(tier)}&period=${period}`)
      return
    }
    window.location.assign('/')
  }

  return (
    <PortalRegisterCard
      subLabel="APOTEK PORTAL"
      portalLabel="Webzoka Apotek"
      subscribe={subscribing}
      planLabel={planLabel}
      loginHref="/login"
      onSubmit={handleRegister}
    />
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Memuat…</div>}>
      <RegisterForm />
    </Suspense>
  )
}
