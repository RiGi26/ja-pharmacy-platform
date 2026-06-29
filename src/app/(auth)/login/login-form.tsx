'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PortalLoginCard } from '@/components/auth/PortalLoginCard'

const DEMO_EMAIL = 'owner@demo.com'
const DEMO_PASSWORD = 'Demo@1234'

export function LoginForm() {
  const router = useRouter()

  async function onSubmit(email: string, password: string) {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return {
        error:
          error.message === 'Invalid login credentials'
            ? 'Email atau password salah.'
            : error.message,
      }
    }

    router.replace('/dashboard')
    router.refresh()
  }

  async function onDemo() {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    })
    if (error) throw error

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <PortalLoginCard
      subLabel="APOTEK PORTAL"
      portalLabel="Webzoka Apotek"
      onSubmit={onSubmit}
      demo={{ onClick: onDemo }}
    />
  )
}
