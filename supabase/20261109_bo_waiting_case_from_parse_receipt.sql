-- Keep the verified BO rows waiting for STM/PM from the same Worker receipt.
-- The former snapshot patch targeted an obsolete return statement and never
-- reached the current Production parse RPC. No reconciliation is run here.
begin;
set local lock_timeout='5s';

alter table public.daily_recon_jobs add column if not exists bo_waiting_snapshot jsonb;

do $migration$
declare
  definition text;
  declaration_anchor text := 'v_job public.daily_recon_jobs%rowtype;';
  result_anchor text := 'v_result:=jsonb_build_object(''updated'',v_updated';
begin
  definition := pg_get_functiondef('public.record_source_file_parse_results(uuid,jsonb)'::regprocedure);
  if position('bo_waiting_parse_receipt_v2' in definition)>0 then return; end if;
  if position(declaration_anchor in definition)=0 or position(result_anchor in definition)=0 then
    raise exception 'Unexpected parse RPC body; BO waiting snapshot not installed';
  end if;
  definition := replace(definition,declaration_anchor,declaration_anchor||' v_snapshot jsonb;');
  definition := replace(definition,result_anchor,$insert$
  -- bo_waiting_parse_receipt_v2: store only verified BO source rows.
  v_snapshot := p_results->0->'bo_waiting_snapshot';
  if v_errors=0 and v_snapshot is not null
     and v_snapshot->>'company'=v_job.company
     and v_snapshot->>'business_date'=v_job.business_date::text
     and jsonb_typeof(v_snapshot->'waiting_bo')='array'
     and jsonb_array_length(v_snapshot->'waiting_bo')<=10000
     and not exists (
       select 1 from jsonb_array_elements(v_snapshot->'waiting_bo') w
       where w->>'company' is distinct from v_job.company
          or w->>'boDate' is distinct from v_job.business_date::text
          or not exists (
            select 1 from public.source_files f
            join public.mail_batches b on b.id=f.batch_id
            where f.id::text=w->'boSource'->>'fileId'
              and f.kind='bo_main' and f.parsed and f.parse_error is null
              and b.business_date=v_job.business_date
              and upper(coalesce(f.company,b.company,''))=upper(v_job.company)
              and exists (
                select 1 from jsonb_array_elements(p_results) p
                where p->>'id'=f.id::text
                  and nullif(trim(p->>'parse_error'),'') is null
              )
          )
     ) then
    update public.daily_recon_jobs
    set bo_waiting_snapshot=v_snapshot||jsonb_build_object('captured_at',now())
    where id=p_job_id;
  else
    -- Never carry a prior run's BO-only rows into a new or failed parse.
    update public.daily_recon_jobs set bo_waiting_snapshot=null where id=p_job_id
      and bo_waiting_snapshot is not null;
  end if;
  $insert$||result_anchor);
  execute definition;
end
$migration$;

-- The receipt arrives before a new recon_run is persisted. During a rerun,
-- last_run_id still points to the old run. Guard the existing materializer
-- without replacing its other logic or case-lifecycle protections.
do $migration$
declare
  definition text;
  anchor text := 'where rr.id=v_job.last_run_id';
begin
  definition := pg_get_functiondef('public.materialize_bo_waiting_cases_for_job(uuid)'::regprocedure);
  if position('bo_waiting_current_run_v2' in definition)>0 then return; end if;
  if position(anchor in definition)=0 then
    raise exception 'Unexpected BO waiting materializer; no changes applied';
  end if;
  definition := replace(definition,anchor,
    anchor||' and rr.created_at >= (v_job.bo_waiting_snapshot->>''captured_at'')::timestamptz /* bo_waiting_current_run_v2 */');
  execute definition;
end
$migration$;

notify pgrst,'reload schema';
commit;
