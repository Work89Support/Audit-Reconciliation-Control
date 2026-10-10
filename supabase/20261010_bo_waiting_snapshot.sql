-- Read-only reporting snapshot. Preserve all quality gates and permissions.
begin;
set local lock_timeout='5s';
alter table public.daily_recon_jobs add column if not exists bo_waiting_snapshot jsonb;
do $$
declare definition text; anchor text := $anchor$  return jsonb_build_object('updated', v_updated, 'errors', v_errors, 'passed', v_errors = 0);$anchor$;
begin
 definition:=pg_get_functiondef('public.record_source_file_parse_results(uuid,jsonb)'::regprocedure);
 if position('bo_waiting_snapshot_v1' in definition)=0 then
  if position(anchor in definition)=0 then raise exception 'Unexpected parse function; no changes applied'; end if;
  definition:=replace(definition,'  v_updated integer := 0;','  v_snapshot jsonb;'||chr(10)||'  v_updated integer := 0;');
  definition:=replace(definition,anchor,$insert$
  -- bo_waiting_snapshot_v1: no accepted run, cases, totals or approvals changed.
  v_snapshot:=p_results->0->'bo_waiting_snapshot';
  if v_snapshot is not null then
    if v_errors=0 and v_snapshot->>'company'=v_job.company
       and v_snapshot->>'business_date'=v_job.business_date::text
       and jsonb_typeof(v_snapshot->'waiting_bo')='array'
       and not exists (
        select 1 from jsonb_array_elements(v_snapshot->'waiting_bo') w
        where w->>'company' is distinct from v_job.company
         or w->>'boDate' is distinct from v_job.business_date::text
         or not exists (
          select 1 from public.source_files f join public.mail_batches b on b.id=f.batch_id
          where f.id::text=w->'boSource'->>'fileId' and f.parsed and f.parse_error is null
           and b.business_date=v_job.business_date and upper(coalesce(f.company,b.company,''))=upper(v_job.company)
           and exists(select 1 from jsonb_array_elements(p_results) p where p->>'id'=f.id::text and nullif(p->>'parse_error','') is null)
         )
       ) then
      update public.daily_recon_jobs set bo_waiting_snapshot=v_snapshot||jsonb_build_object('captured_at',now(),'report_only',true) where id=p_job_id;
    else
      update public.daily_recon_jobs set bo_waiting_snapshot=null where id=p_job_id;
    end if;
  end if;
$insert$||anchor);
  execute definition;
 end if;
end $$;
-- Keep an explicit rerun request from being overwritten by saved incomplete coverage.
do $$
declare definition text; anchor text:='elsif v_old.last_run_id is not null and v_files>0 and v_parsed=v_files and v_errors=0';
begin
 definition:=pg_get_functiondef('public.refresh_daily_recon_job(date,text)'::regprocedure);
 if position('bo_waiting_manual_rerun_v1' in definition)=0 then
  if position(anchor in definition)=0 then raise exception 'Unexpected refresh function; no changes applied'; end if;
  execute replace(definition,anchor,anchor||' and v_old.rerun_requested_at is null /* bo_waiting_manual_rerun_v1 */');
 end if;
end $$;
commit;
