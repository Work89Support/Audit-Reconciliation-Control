-- Exact BO lineage only. No amount/status/approval/evidence changes.
-- Existing waiting cases remain stored and are linked to their canonical case.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

create or replace function public.bo_waiting_cross_day_target(p_old jsonb,p_run_id uuid)
returns uuid language sql stable security invoker set search_path=public as $$
 select case when count(*)=1 then min(c.id::text)::uuid else null end
 from public.exceptions c
 where p_old->>'company' in ('AT4','SK8')
   and p_old->>'status'='open'
   and p_old->'customer_details'->>'waiting_source'='true'
   and p_old->>'ex_type'='missing_stm'
   and p_old->>'superseded_by_exception_id' is null
   and p_old->>'manual_pair_id' is null and p_old->>'cross_day_request_id' is null
   and p_old->>'case_closure_request_id' is null and p_old->>'clarification_file_id' is null
   and p_old->>'requested_by' is null and p_old->>'responded_by' is null
   and p_old->>'bank_amount' is null
   and nullif(p_old->>'bo_raw','') is not null
   and (p_old->>'account') ~ '^[0-9]{10,15}$'
   and coalesce(p_old->'customer_details'->'source_rows'->'bo'->>'row','') ~ '^[1-9][0-9]*$'
   and nullif(p_old->'customer_details'->'source_rows'->'bo'->>'fileId','') is not null
   and nullif(p_old->'customer_details'->'bo'->>'reference','') is not null
   and nullif(p_old->'customer_details'->'bo'->>'user','') is not null
   and nullif(p_old->>'bo_date','') is not null and nullif(p_old->>'bo_time','') is not null
   and c.run_id=p_run_id and c.id::text<>p_old->>'id'
   and c.company=p_old->>'company' and c.business_date::text=p_old->>'business_date'
   and c.ex_type='cross_day' and c.status='open' and c.superseded_by_exception_id is null
   and c.manual_pair_id is null and c.cross_day_request_id is null and c.case_closure_request_id is null
   and c.bank_amount is null and c.system_amount>0
   and c.system_amount=nullif(p_old->>'system_amount','')::numeric
   and coalesce(c.currency,'THB')=coalesce(p_old->>'currency','THB')
   and c.account=p_old->>'account' and c.direction=p_old->>'direction'
   and c.bo_date::text=p_old->>'bo_date' and c.bo_time::text=p_old->>'bo_time'
   and c.bo_raw=p_old->>'bo_raw'
   and c.customer_details->'source_rows'->'bo'->>'fileId'=p_old->'customer_details'->'source_rows'->'bo'->>'fileId'
   and c.customer_details->'source_rows'->'bo'->>'row'=p_old->'customer_details'->'source_rows'->'bo'->>'row'
   and c.customer_details->'bo'->>'reference'=p_old->'customer_details'->'bo'->>'reference'
   and c.customer_details->'bo'->>'user'=p_old->'customer_details'->'bo'->>'user'
   and exists(select 1 from public.exceptions live_old where live_old.id::text=p_old->>'id'
     and (to_jsonb(live_old)-'run_id'-'lifecycle_key'-'updated_at')
       = (p_old-'run_id'-'lifecycle_key'-'updated_at'))
   and not exists(select 1 from public.case_evidence f where f.exception_id::text=p_old->>'id')
   and exists(select 1 from public.recon_runs r join public.source_files f on f.id=any(r.file_ids)
     where r.id=p_run_id and r.company=c.company and r.business_date=c.business_date
       and f.id::text=c.customer_details->'source_rows'->'bo'->>'fileId'
       and f.kind='bo_main' and f.parsed and f.parse_error is null);
$$;
revoke all on function public.bo_waiting_cross_day_target(jsonb,uuid) from public,anon;
grant execute on function public.bo_waiting_cross_day_target(jsonb,uuid) to authenticated,service_role;

-- Patch the reviewed live lifecycle at one anchor; preserve all other rules,
-- privileges and approved-closure preservation code. A drifted body fails closed.
do $patch$
declare body text; old_join text:='on c.run_id=p_run_id and c.lifecycle_key=o.lifecycle_key';
 new_join text:='on c.run_id=p_run_id and (c.lifecycle_key=o.lifecycle_key or c.id=public.bo_waiting_cross_day_target(to_jsonb(o),p_run_id))';
begin
 body:=pg_get_functiondef('public.finish_daily_recon_job(uuid,uuid)'::regprocedure);
 if strpos(body,new_join)>0 then return;end if;
 if (length(body)-length(replace(body,old_join,'')))/length(old_join)<>1 then
   raise exception 'Lifecycle changed: exact anchor not unique; no patch applied';
 end if;
 execute replace(body,old_join,new_join);
end $patch$;

notify pgrst,'reload schema';
commit;
