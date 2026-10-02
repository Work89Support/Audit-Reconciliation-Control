-- Close carried-forward System 123 duplicate-group exceptions only when the
-- latest run contains match evidence for the exact source row that originally
-- produced the exception.  This handles repeated same-user/same-account/same-
-- amount groups without weakening the existing unique-evidence lifecycle rule.

begin;

create or replace function public.close_repeated_exact_evidence_for_run(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_closed integer := 0;
begin
  if p_run_id is null then
    return 0;
  end if;

  with evidence_rows as (
    select distinct
      upper(coalesce(ev->>'company',r.company,'')) as company,
      upper(trim(coalesce(ev->>'account',''))) as account,
      case lower(coalesce(ev->>'direction',''))
        when 'deposit' then 'ฝาก'
        when 'withdraw' then 'ถอน'
        else coalesce(ev->>'direction','')
      end as direction,
      (ev->>'amount')::numeric as amount,
      side.ex_type,
      side.source_date,
      side.source_sec
    from public.recon_runs r
    cross join lateral jsonb_array_elements(coalesce(r.summary->'match_evidence','[]'::jsonb)) ev
    cross join lateral (
      values
        (
          'missing_bo'::text,
          case when coalesce(ev->'stm'->>'date','') ~ '^\d{4}-\d{2}-\d{2}$'
            then (ev->'stm'->>'date')::date end,
          case when coalesce(ev->'stm'->>'sec','') ~ '^\d+$'
            then (ev->'stm'->>'sec')::integer end
        ),
        (
          'missing_stm'::text,
          case when coalesce(ev->'bo'->>'date','') ~ '^\d{4}-\d{2}-\d{2}$'
            then (ev->'bo'->>'date')::date end,
          case when coalesce(ev->'bo'->>'sec','') ~ '^\d+$'
            then (ev->'bo'->>'sec')::integer end
        )
    ) side(ex_type,source_date,source_sec)
    where r.id=p_run_id
      and coalesce(ev->>'amount','') ~ '^-?[0-9]+([.][0-9]+)?$'
      and side.source_date is not null
      and side.source_sec is not null
  ),
  closed as (
    update public.exceptions e
    set status='closed',
        auto_closed=true,
        resolved_at=now(),
        resolved_by='system:exception-lifecycle-v3',
        closing_run_id=p_run_id,
        closure_rule='exact-side-match-evidence',
        resolution_note='ปิดอัตโนมัติเมื่อรอบใหม่พบคู่ของแถวเดิมตรงทั้งบริษัท บัญชี ทิศทาง ยอด วันที่และเวลา; รองรับยอดซ้ำต่างเวลา',
        updated_at=now()
    from evidence_rows ev
    where e.run_id=p_run_id
      and e.previous_exception_id is not null
      and e.status in ('open','clarifying','answered')
      and e.superseded_by_exception_id is null
      and e.ex_type=ev.ex_type
      and upper(coalesce(e.company,''))=ev.company
      and upper(trim(coalesce(e.account,'')))=ev.account
      and e.direction=ev.direction
      and coalesce(e.bank_amount,e.system_amount,0)=ev.amount
      and e.business_date=ev.source_date
      and floor(extract(epoch from e.occurred_at))::integer=ev.source_sec
    returning e.id,e.previous_exception_id,e.ex_type,e.occurred_at
  ),
  logged as (
    insert into public.audit_log(actor,action,entity,target,detail,meta)
    select
      'system:exception-lifecycle-v3',
      'exception_auto_closed_on_exact_repeated_match',
      'exception',
      c.id::text,
      'รอบใหม่จับคู่แถวต้นทางเดิมได้ตรงวันที่และเวลา จึงปิดเคสซ้ำที่ถูกยกมาจากรอบก่อน',
      jsonb_build_object(
        'closing_run_id',p_run_id,
        'previous_exception_id',c.previous_exception_id,
        'exception_type',c.ex_type,
        'occurred_at',c.occurred_at,
        'rule','exact-side-match-evidence'
      )
    from closed c
    returning id
  )
  select count(*)::integer into v_closed from closed;

  return v_closed;
end $$;

create or replace function public.close_repeated_exact_evidence_after_job_finish()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.close_repeated_exact_evidence_for_run(new.last_run_id);
  return new;
end $$;

drop trigger if exists daily_recon_jobs_close_repeated_exact_evidence
  on public.daily_recon_jobs;
create trigger daily_recon_jobs_close_repeated_exact_evidence
after update of last_run_id,status on public.daily_recon_jobs
for each row
when (
  new.status='completed'
  and new.last_run_id is not null
  and new.last_run_id is distinct from old.last_run_id
)
execute function public.close_repeated_exact_evidence_after_job_finish();

-- Backfill the SK8 2026-10-01 rerun that exposed the lifecycle gap.  The helper
-- remains fully evidence-driven and will return zero if that run is no longer
-- current or the exact source rows are not present.
select public.close_repeated_exact_evidence_for_run(j.last_run_id)
from public.daily_recon_jobs j
where upper(j.company)='SK8'
  and j.business_date=date '2026-10-01'
  and j.status='completed'
  and j.last_run_id is not null;

revoke all on function public.close_repeated_exact_evidence_for_run(uuid) from public,anon;
revoke all on function public.close_repeated_exact_evidence_after_job_finish() from public,anon;
grant execute on function public.close_repeated_exact_evidence_for_run(uuid) to authenticated,service_role;
grant execute on function public.close_repeated_exact_evidence_after_job_finish() to authenticated,service_role;

notify pgrst, 'reload schema';
commit;
