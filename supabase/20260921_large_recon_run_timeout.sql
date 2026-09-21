-- Large daily runs keep one audit-evidence row per matched pair.  Insert and
-- lifecycle reconciliation therefore need a transaction-local timeout longer
-- than the default PostgREST statement timeout; no global database setting is
-- changed.
begin;

create or replace function public.create_recon_run_with_timeout(p_run jsonb)
returns public.recon_runs
language plpgsql
security definer
set search_path=public
set statement_timeout='120s'
as $$
declare
  v_run public.recon_runs%rowtype;
begin
  insert into public.recon_runs(
    business_date,company,run_by,elapsed_ms,stm_count,bo_count,matched,
    match_rate,exception_count,no_stm_count,file_ids,summary
  ) values (
    (p_run->>'business_date')::date,
    p_run->>'company',
    p_run->>'run_by',
    nullif(p_run->>'elapsed_ms','')::integer,
    coalesce(nullif(p_run->>'stm_count','')::integer,0),
    coalesce(nullif(p_run->>'bo_count','')::integer,0),
    coalesce(nullif(p_run->>'matched','')::integer,0),
    nullif(p_run->>'match_rate','')::numeric,
    coalesce(nullif(p_run->>'exception_count','')::integer,0),
    coalesce(nullif(p_run->>'no_stm_count','')::integer,0),
    array(select jsonb_array_elements_text(coalesce(p_run->'file_ids','[]'::jsonb))::uuid),
    coalesce(p_run->'summary','{}'::jsonb)
  ) returning * into v_run;
  return v_run;
end $$;

alter function public.finish_daily_recon_job(uuid,uuid)
  set statement_timeout='120s';

revoke all on function public.create_recon_run_with_timeout(jsonb) from public,anon;
grant execute on function public.create_recon_run_with_timeout(jsonb) to authenticated,service_role;

notify pgrst, 'reload schema';
commit;
