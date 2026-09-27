-- A run must never become the current result unless every exception computed
-- by the worker has been persisted.  This catches partial/failed PostgREST
-- batches before exception lifecycle logic can copy historical cases into the
-- new run and make the dashboard look complete when it is not.
begin;

create or replace function public.verify_recon_run_exception_count(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='30s'
as $$
declare
  v_expected integer;
  v_saved integer;
begin
  select exception_count into v_expected
  from public.recon_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'ไม่พบผลรัน %',p_run_id;
  end if;

  select count(*)::integer into v_saved
  from public.exceptions
  where run_id=p_run_id;

  if v_saved<>v_expected then
    raise exception 'บันทึก Exception ไม่ครบ: run % คำนวณ % แถว แต่บันทึกได้ % แถว',
      p_run_id,v_expected,v_saved;
  end if;
end $$;

-- Lifecycle carry rows preserve the unresolved historical record, but they
-- are not exceptions computed by the current reconciliation.  Keep them in
-- history while excluding them from the current-run work queue and totals.
create or replace view public.v_current_exceptions as
select e.id, e.run_id, e.code, e.business_date, e.occurred_at,
       e.company, e.bank, e.account, e.direction, e.member_code,
       e.ex_type, e.type_name, e.severity, e.status, e.track, e.due_at,
       e.system_amount, e.bank_amount, e.amount_diff, e.risk_amount,
       e.currency, e.fx_rate, e.time_diff_sec, e.employee, e.shift,
       e.cause, e.detail, e.stm_raw, e.bo_raw, e.created_at, e.updated_at,
       e.customer_details
from public.daily_recon_jobs j
join public.exceptions e on e.run_id=j.last_run_id
where j.status='completed'
  and e.superseded_by_exception_id is null
  and e.previous_exception_id is null;

revoke all on function public.verify_recon_run_exception_count(uuid) from public,anon;
grant execute on function public.verify_recon_run_exception_count(uuid) to authenticated,service_role;
grant select on public.v_current_exceptions to authenticated;

notify pgrst,'reload schema';
commit;
