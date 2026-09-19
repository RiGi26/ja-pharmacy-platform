begin;

drop policy if exists user_profiles_access on public.user_profiles;
drop policy if exists user_profiles_own on public.user_profiles;
drop policy if exists user_profiles_select on public.user_profiles;
drop policy if exists user_profiles_update_own_contact on public.user_profiles;

create policy user_profiles_select
  on public.user_profiles
  for select
  to authenticated
  using (
    (select public.is_superadmin())
    or tenant_id = (select public.get_tenant_id())
    or user_id = (select auth.uid())
  );

create policy user_profiles_update_own_contact
  on public.user_profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()) and is_active = true)
  with check (user_id = (select auth.uid()) and is_active = true);

-- RLS chooses the row; column grants limit an ordinary self-edit to these two
-- contact fields. Email remains bound to the verified Auth flow.
revoke all on table public.user_profiles from public, anon, authenticated;
grant select on table public.user_profiles to authenticated;
grant update (full_name, phone) on table public.user_profiles to authenticated;
grant all on table public.user_profiles to service_role;

create or replace function public.guard_user_profiles_security_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  request_role text := coalesce(nullif((select auth.jwt() ->> 'role'), ''), current_user);
begin
  if request_role in ('anon', 'authenticated') then
    if tg_op <> 'UPDATE' then
      raise exception 'user_profiles insert/delete requires a server-admin path'
        using errcode = '42501';
    end if;

    if new.id is distinct from old.id
       or new.tenant_id is distinct from old.tenant_id
       or new.user_id is distinct from old.user_id
       or new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
       or new.created_at is distinct from old.created_at then
      raise exception 'authorization-bearing profile fields are immutable to authenticated users'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.guard_user_profiles_security_fields() from public, anon, authenticated;

drop trigger if exists user_profiles_security_guard on public.user_profiles;
create trigger user_profiles_security_guard
before insert or update or delete on public.user_profiles
for each row execute function public.guard_user_profiles_security_fields();

commit;
