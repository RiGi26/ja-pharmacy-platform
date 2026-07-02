-- Onboarding first-run per user (welcome/tour/checklist/coachmarks).
-- One row per auth user; RLS = own-row only (auth.uid() wrapped for init-plan).
create table if not exists public.user_onboarding (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  completed_steps        jsonb not null default '[]'::jsonb,
  seen_coachmarks        jsonb not null default '[]'::jsonb,
  welcome_dismissed_at   timestamptz,
  tour_completed_at      timestamptz,
  checklist_dismissed_at timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_user_onboarding_tenant on public.user_onboarding (tenant_id);
alter table public.user_onboarding enable row level security;
create policy user_onboarding_select_own on public.user_onboarding for select using ((select auth.uid()) = user_id);
create policy user_onboarding_insert_own on public.user_onboarding for insert with check ((select auth.uid()) = user_id);
create policy user_onboarding_update_own on public.user_onboarding for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
