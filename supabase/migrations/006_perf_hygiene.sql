-- ============================================================
-- 006_perf_hygiene.sql  (DB performance audit 2026-06-28)
-- P1: covering index for every unindexed single-column FK (additive, zero behavior change)
-- P2: wrap bare auth.<fn>() in (select ...) so it is evaluated once per query (InitPlan),
--     not once per row. Behavior-preserving. Idempotent.
-- Applied to live DB via Supabase MCP; committed here for repo/DB parity.
-- ============================================================

-- P1: FK covering indexes
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_disposals_approved_by on public.disposals(approved_by);
create index if not exists idx_disposals_batch_id on public.disposals(batch_id);
create index if not exists idx_disposals_medicine_id on public.disposals(medicine_id);
create index if not exists idx_disposals_submitted_by on public.disposals(submitted_by);
create index if not exists idx_disposals_supplier_id on public.disposals(supplier_id);
create index if not exists idx_disposals_tenant_id on public.disposals(tenant_id);
create index if not exists idx_medicine_batches_supplier_id on public.medicine_batches(supplier_id);
create index if not exists idx_prescriptions_dispensed_by on public.prescriptions(dispensed_by);
create index if not exists idx_price_histories_changed_by on public.price_histories(changed_by);
create index if not exists idx_price_histories_medicine_id on public.price_histories(medicine_id);
create index if not exists idx_price_histories_tenant_id on public.price_histories(tenant_id);
create index if not exists idx_scan_logs_medicine_id on public.scan_logs(medicine_id);
create index if not exists idx_scan_logs_scanned_by on public.scan_logs(scanned_by);
create index if not exists idx_scan_logs_tenant_id on public.scan_logs(tenant_id);
create index if not exists idx_shifts_cashier_id on public.shifts(cashier_id);
create index if not exists idx_shifts_tenant_id on public.shifts(tenant_id);
create index if not exists idx_stock_movements_batch_id on public.stock_movements(batch_id);
create index if not exists idx_stock_movements_created_by on public.stock_movements(created_by);
create index if not exists idx_transaction_items_batch_id on public.transaction_items(batch_id);
create index if not exists idx_transaction_items_medicine_id on public.transaction_items(medicine_id);
create index if not exists idx_transaction_items_tenant_id on public.transaction_items(tenant_id);
create index if not exists idx_transactions_prescription_id on public.transactions(prescription_id);
create index if not exists idx_transactions_shift_id on public.transactions(shift_id);
create index if not exists idx_transactions_void_by on public.transactions(void_by);

-- P2: RLS init-plan wrap. Self-targeting (only policies with a bare, not-already-wrapped
-- auth call) + idempotent. Reads the live expression and wraps each auth.<fn>() call.
do $$
declare
  r record; q text; wc text; v_sql text;
begin
  for r in
    select c.relname as tbl, p.polname as pol,
           pg_get_expr(p.polqual, p.polrelid) as q,
           pg_get_expr(p.polwithcheck, p.polrelid) as wc
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (
        (pg_get_expr(p.polqual, p.polrelid) ~ 'auth\.(uid|jwt|role|email)\(\)'
           and pg_get_expr(p.polqual, p.polrelid) !~* '\(\s*select\s+auth\.')
        or
        (pg_get_expr(p.polwithcheck, p.polrelid) ~ 'auth\.(uid|jwt|role|email)\(\)'
           and pg_get_expr(p.polwithcheck, p.polrelid) !~* '\(\s*select\s+auth\.')
      )
  loop
    q := r.q; wc := r.wc;
    if q is not null then
      q := replace(q, 'auth.uid()',  '(select auth.uid())');
      q := replace(q, 'auth.jwt()',  '(select auth.jwt())');
      q := replace(q, 'auth.role()', '(select auth.role())');
      q := replace(q, 'auth.email()','(select auth.email())');
    end if;
    if wc is not null then
      wc := replace(wc, 'auth.uid()',  '(select auth.uid())');
      wc := replace(wc, 'auth.jwt()',  '(select auth.jwt())');
      wc := replace(wc, 'auth.role()', '(select auth.role())');
      wc := replace(wc, 'auth.email()','(select auth.email())');
    end if;
    v_sql := format('alter policy %I on public.%I', r.pol, r.tbl);
    if q  is not null then v_sql := v_sql || format(' using (%s)', q); end if;
    if wc is not null then v_sql := v_sql || format(' with check (%s)', wc); end if;
    execute v_sql;
    raise notice 'rewrapped: %', v_sql;
  end loop;
end $$;
