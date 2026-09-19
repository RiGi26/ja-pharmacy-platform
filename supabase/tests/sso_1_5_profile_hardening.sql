begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email)
values
  ('30000000-0000-0000-0000-000000000001', 'security-a1@example.invalid'),
  ('30000000-0000-0000-0000-000000000002', 'security-a2@example.invalid'),
  ('30000000-0000-0000-0000-000000000003', 'security-b1@example.invalid');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-0000-0000-000000000001', 'Security A', 'security-a'),
  ('10000000-0000-0000-0000-000000000002', 'Security B', 'security-b');

insert into public.user_profiles (id, user_id, tenant_id, full_name, email, role, phone, is_active)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Owner A', 'security-a1@example.invalid', 'owner', null, true),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Cashier A', 'security-a2@example.invalid', 'kasir', null, true),
  ('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Cashier B', 'security-b1@example.invalid', 'kasir', null, true);

select ok(not has_table_privilege('authenticated', 'public.user_profiles', 'INSERT'), 'authenticated cannot insert profiles');
select ok(not has_table_privilege('authenticated', 'public.user_profiles', 'DELETE'), 'authenticated cannot delete profiles');
select ok(not has_table_privilege('authenticated', 'public.user_profiles', 'TRUNCATE'), 'authenticated cannot truncate profiles');
select ok(not has_table_privilege('authenticated', 'public.user_profiles', 'REFERENCES'), 'authenticated cannot create references');
select ok(not has_table_privilege('authenticated', 'public.user_profiles', 'TRIGGER'), 'authenticated cannot create triggers');
select ok(has_column_privilege('authenticated', 'public.user_profiles', 'full_name', 'UPDATE'), 'authenticated may update full_name');
select ok(has_column_privilege('authenticated', 'public.user_profiles', 'phone', 'UPDATE'), 'authenticated may update phone');
select ok(not has_column_privilege('authenticated', 'public.user_profiles', 'role', 'UPDATE'), 'authenticated cannot update role');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"tenant_id":"10000000-0000-0000-0000-000000000001","role":"owner"}}', true);
select lives_ok(
  $$update public.user_profiles set full_name = 'Owner A Updated', phone = '628123' where user_id = '30000000-0000-0000-0000-000000000001'$$,
  'ordinary user can edit own allowed contact fields'
);
select throws_ok(
  $$update public.user_profiles set role = 'superadmin' where user_id = '30000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table user_profiles',
  'ordinary user cannot self-promote'
);
select is_empty(
  $$update public.user_profiles set phone = 'same-tenant' where user_id = '30000000-0000-0000-0000-000000000002' returning id$$,
  'ordinary user cannot edit another same-tenant profile'
);
select is_empty(
  $$update public.user_profiles set phone = 'cross-tenant' where user_id = '30000000-0000-0000-0000-000000000003' returning id$$,
  'ordinary user cannot edit a cross-tenant profile'
);

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  $$update public.user_profiles set is_active = false where user_id = '30000000-0000-0000-0000-000000000002'$$,
  'validated server-admin path can change activation'
);

select * from finish();
rollback;
