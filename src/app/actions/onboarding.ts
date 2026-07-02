'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// Onboarding state mutations. All scoped to the signed-in user via RLS
// (user_onboarding policies allow only auth.uid() = user_id). Demo is NOT blocked —
// onboarding is non-sensitive and per-user.
// ============================================================

type Patch = {
  welcome_dismissed_at?: string
  tour_completed_at?: string
  checklist_dismissed_at?: string
  completed_steps?: string[]
  seen_coachmarks?: string[]
}

async function getUserTenant() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single()
  if (!profile) return null
  return { supabase, userId: user.id, tenantId: profile.tenant_id as string }
}

async function upsertOnboarding(patch: Patch): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getUserTenant()
  if (!ctx) return { error: 'Sesi tidak valid.' }

  const { error } = await ctx.supabase
    .from('user_onboarding')
    .upsert(
      {
        user_id: ctx.userId,
        tenant_id: ctx.tenantId,
        updated_at: new Date().toISOString(),
        ...patch,
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('upsertOnboarding error:', error)
    return { error: 'Gagal menyimpan status onboarding.' }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

/** Dismiss the one-time welcome modal. */
export async function dismissWelcome() {
  return upsertOnboarding({ welcome_dismissed_at: new Date().toISOString() })
}

/** Mark the product tour as seen/skipped so it doesn't auto-run again. */
export async function completeTour() {
  return upsertOnboarding({ tour_completed_at: new Date().toISOString() })
}

/** Hide the "Misi Pertama" checklist for this user. */
export async function dismissChecklist() {
  return upsertOnboarding({ checklist_dismissed_at: new Date().toISOString() })
}

/** Mark a manual (non-derived) checklist step complete. */
export async function markStepDone(key: string) {
  if (!key || typeof key !== 'string') return { error: 'Langkah tidak valid.' }

  const ctx = await getUserTenant()
  if (!ctx) return { error: 'Sesi tidak valid.' }

  const { data } = await ctx.supabase
    .from('user_onboarding')
    .select('completed_steps')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  const current: string[] = Array.isArray(data?.completed_steps) ? (data!.completed_steps as string[]) : []
  if (current.includes(key)) return { success: true }

  return upsertOnboarding({ completed_steps: [...current, key] })
}

/** Mark a one-time contextual coachmark (or feature announcement) as seen. */
export async function markCoachmarkSeen(key: string) {
  if (!key || typeof key !== 'string') return { error: 'Key tidak valid.' }

  const ctx = await getUserTenant()
  if (!ctx) return { error: 'Sesi tidak valid.' }

  const { data } = await ctx.supabase
    .from('user_onboarding')
    .select('seen_coachmarks')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  const current: string[] = Array.isArray(data?.seen_coachmarks) ? (data!.seen_coachmarks as string[]) : []
  if (current.includes(key)) return { success: true }

  return upsertOnboarding({ seen_coachmarks: [...current, key] })
}
