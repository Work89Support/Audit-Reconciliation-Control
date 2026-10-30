-- Ensure every verified BO-only row in the current reconciliation snapshot has
-- a real, idempotent exception UUID.  The UI must never fabricate an "open
-- real case" button for a snapshot-only row: the button becomes available only
-- after this server-side materialization succeeds.
--
-- This migration does not rerun reconciliation, alter matched totals, close a
-- case, reopen a closed case, or record financial damage.
begin;
set local lock_timeout='5s';

create or replace function public.materialize_bo_waiting_cases_for_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
set statement_timeout='30s'
as $$
declare
  v_job public.daily_recon_jobs;
  v_rows jsonb := '[]'::jsonb;
  v_result jsonb := jsonb_build_object('created',0,'existing',0,'matched',0);
begin
  select * into strict v_job
  from public.daily_recon_jobs
  where id=p_job_id
  for update;

  if v_job.is_archived or v_job.last_run_id is null or v_job.bo_waiting_snapshot is null then
    return v_result||jsonb_build_object('job_id',p_job_id,'skipped',true,'reason','job_not_current_or_snapshot_missing');
  end if;

  select coalesce(jsonb_agg(w order by (w->'boSource'->>'fileId'),(w->'boSource'->>'row')::integer),'[]'::jsonb)
  into v_rows
  from public.recon_runs rr
  cross join lateral jsonb_array_elements(coalesce(v_job.bo_waiting_snapshot->'waiting_bo','[]'::jsonb)) w
  where rr.id=v_job.last_run_id
    and rr.company=v_job.company
    and rr.business_date=v_job.business_date
    and w->>'company'=v_job.company
    and w->>'boDate'=v_job.business_date::text
    and nullif(trim(w->>'account'),'') is not null
    and trim(w->>'account') not in('-','—','–','ไม่ระบุ','ไม่ระบุบัญชี','ไม่มีข้อมูล')
    and exists (
      select 1 from unnest(rr.file_ids) fid
      where fid::text=w->'boSource'->>'fileId'
    );

  if jsonb_array_length(v_rows)>0 then
    v_result:=public.register_bo_waiting_cases(v_job.last_run_id,v_rows);
  end if;

  return v_result||jsonb_build_object(
    'job_id',p_job_id,
    'company',v_job.company,
    'business_date',v_job.business_date,
    'eligible_rows',jsonb_array_length(v_rows),
    'skipped',false
  );
end
$$;

create or replace function public.materialize_bo_waiting_snapshot_cases()
returns trigger
language plpgsql
security definer
set search_path=public
set statement_timeout='30s'
as $$
begin
  if new.last_run_id is not null and not new.is_archived and new.bo_waiting_snapshot is not null then
    perform public.materialize_bo_waiting_cases_for_job(new.id);
  end if;
  return new;
end
$$;

drop trigger if exists bo_waiting_snapshot_cases on public.daily_recon_jobs;
drop trigger if exists bo_waiting_snapshot_cases_on_insert on public.daily_recon_jobs;
drop trigger if exists bo_waiting_snapshot_cases_on_update on public.daily_recon_jobs;
create trigger bo_waiting_snapshot_cases_on_insert
after insert
on public.daily_recon_jobs
for each row
when (
  new.bo_waiting_snapshot is not null
  and new.last_run_id is not null
  and not new.is_archived
)
execute function public.materialize_bo_waiting_snapshot_cases();

create trigger bo_waiting_snapshot_cases_on_update
after update of bo_waiting_snapshot,last_run_id,is_archived
on public.daily_recon_jobs
for each row
when (
  new.bo_waiting_snapshot is not null
  and new.last_run_id is not null
  and not new.is_archived
  and (
    new.bo_waiting_snapshot is distinct from old.bo_waiting_snapshot
    or new.last_run_id is distinct from old.last_run_id
    or new.is_archived is distinct from old.is_archived
  )
)
execute function public.materialize_bo_waiting_snapshot_cases();

-- Explicit, bounded repair for a business date.  This is intentionally
-- service-role only and exists for snapshots captured before the trigger was
-- installed.  Replaying it is safe: register_bo_waiting_cases deduplicates by
-- exact BO file UUID + source row and also respects closed historical cases.
create or replace function public.repair_bo_waiting_cases_for_date(p_business_date date)
returns jsonb
language plpgsql
security definer
set search_path=public
set statement_timeout='90s'
as $$
declare
  v_job record;
  v_results jsonb := '[]'::jsonb;
begin
  if p_business_date is null then
    raise exception 'business date is required';
  end if;

  for v_job in
    select id,company
    from public.daily_recon_jobs
    where business_date=p_business_date
      and not is_archived
      and last_run_id is not null
      and bo_waiting_snapshot is not null
    order by company,id
  loop
    v_results:=v_results||jsonb_build_array(public.materialize_bo_waiting_cases_for_job(v_job.id));
  end loop;

  insert into public.audit_log(actor,action,entity,target,detail,meta)
  values(
    coalesce(auth.uid()::text,'system:bo-source-review'),
    'bo_waiting_case_materialization_repair',
    'daily_recon_jobs',
    p_business_date::text,
    'ซ่อมแถว BO รอหลักฐานให้มีเคสจริง · ไม่รันกระทบยอดซ้ำ · ไม่เปลี่ยนยอด/สถานะเคสเดิม',
    jsonb_build_object('business_date',p_business_date,'results',v_results)
  );

  return jsonb_build_object('business_date',p_business_date,'jobs',jsonb_array_length(v_results),'results',v_results);
end
$$;

revoke all on function public.materialize_bo_waiting_cases_for_job(uuid) from public,anon,authenticated;
revoke all on function public.materialize_bo_waiting_snapshot_cases() from public,anon,authenticated;
revoke all on function public.repair_bo_waiting_cases_for_date(date) from public,anon,authenticated;
grant execute on function public.materialize_bo_waiting_cases_for_job(uuid) to service_role;
grant execute on function public.repair_bo_waiting_cases_for_date(date) to service_role;

notify pgrst,'reload schema';
commit;
