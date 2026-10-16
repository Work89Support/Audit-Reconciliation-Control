-- Read-path optimization only. No case, source, report or hold data changes.
begin;
set local lock_timeout='5s';

-- Resolve the small primary-version registry once, not by re-reading the
-- 200k+ row exception history through a scalar function for every candidate.
-- SECURITY INVOKER and all existing table RLS policies remain in force.
create or replace view public.active_audit_exceptions with(security_invoker=true) as
with heads as materialized (
 select distinct on(company,business_date) id,company,business_date,base_run_id
 from public.manual_primary_results order by company,business_date,accepted_at desc,id desc
)
-- No manual primary: retain the existing system/history visibility contract.
select e.* from public.exceptions e
where (select public.current_user_active()) and public.has_company_access(e.company)
 and not exists(select 1 from heads m where m.company=e.company and m.business_date=e.business_date)
union all
-- Current manual primary: begin at the exact case IDs already materialized.
select e.* from heads m
join public.daily_recon_jobs j on j.company=m.company and j.business_date=m.business_date and not j.is_archived
 and j.last_run_id is not distinct from m.base_run_id
join public.manual_primary_case_items i on i.primary_id=m.id
join public.exceptions e on e.id=i.exception_id and e.company=m.company and e.business_date=m.business_date
where (select public.current_user_active()) and public.has_company_access(e.company)
union all
-- A newer completed system run supersedes a manual version, never vice versa.
select e.* from heads m
join public.daily_recon_jobs j on j.company=m.company and j.business_date=m.business_date and not j.is_archived
 and j.last_run_id is distinct from m.base_run_id and j.status='completed' and coalesce(j.error_count,0)=0
join public.recon_runs r on r.id=j.last_run_id and r.company=m.company and r.business_date=m.business_date
join public.exceptions e on e.run_id=j.last_run_id and e.company=m.company and e.business_date=m.business_date
where (select public.current_user_active()) and public.has_company_access(e.company)
 and e.customer_details->>'manual_primary_id' is null;

-- The dashboard already knows its authorized latest run IDs. Resolve those
-- scopes before touching exception rows, including in RLS plans; otherwise an
-- anti-join can still scan obsolete manual-base cases before discarding them.
create or replace function public.audit_current_case_rows(p_run_ids uuid[])
returns setof public.exceptions language plpgsql stable strict security invoker set search_path=public,pg_temp as $$
begin
 if cardinality(p_run_ids) is null or cardinality(p_run_ids) not between 1 and 1000
  or array_position(p_run_ids,null) is not null then raise exception 'Invalid current-run scope';end if;
 if not coalesce(public.current_user_active(),false) then raise exception 'Active authenticated user required' using errcode='42501';end if;
 return query
 with jobs as materialized (
  select j.company,j.business_date,j.last_run_id,j.status,j.error_count from public.daily_recon_jobs j
  where j.last_run_id=any(p_run_ids) and not j.is_archived
 ), heads as materialized (
  select distinct on(v.company,v.business_date) v.id,v.company,v.business_date,v.base_run_id
  from public.manual_primary_results v join jobs j on j.company=v.company and j.business_date=v.business_date
  order by v.company,v.business_date,v.accepted_at desc,v.id desc
 ), system_scopes as materialized (
  select j.* from jobs j left join heads m on m.company=j.company and m.business_date=j.business_date
  where m.id is null or (j.last_run_id is distinct from m.base_run_id and j.status='completed' and coalesce(j.error_count,0)=0
   and exists(select 1 from public.recon_runs r where r.id=j.last_run_id and r.company=j.company and r.business_date=j.business_date))
 )
 select e.* from system_scopes j cross join lateral (
  select e.* from public.exceptions e where e.run_id=j.last_run_id and e.company=j.company and e.business_date=j.business_date
   and e.superseded_by_exception_id is null and e.customer_details->>'manual_primary_id' is null offset 0
 ) e
 union all
 select e.* from heads m join jobs j on j.company=m.company and j.business_date=m.business_date
  and j.last_run_id is not distinct from m.base_run_id
 join public.manual_primary_case_items i on i.primary_id=m.id
 join public.exceptions e on e.id=i.exception_id and e.company=m.company and e.business_date=m.business_date
 where e.superseded_by_exception_id is null;
end $$;
create or replace function public.audit_current_cases(p_run_ids uuid[],p_limit integer default 1000,p_offset integer default 0)
returns setof public.exceptions language sql stable security invoker set search_path=public,pg_temp as $$
 select e.* from public.audit_current_case_rows(p_run_ids) e
 order by e.business_date desc,e.occurred_at desc,e.id desc
 limit least(greatest(coalesce(p_limit,1000),1),1000) offset greatest(coalesce(p_offset,0),0)
$$;
revoke all on function public.audit_current_case_rows(uuid[]),public.audit_current_cases(uuid[],integer,integer) from public,anon;
grant execute on function public.audit_current_case_rows(uuid[]),public.audit_current_cases(uuid[],integer,integer) to authenticated;

-- Use that same current-case contract for checklist counts. Keep file rules,
-- RLS, date bounds, archived-run filtering, and every other checklist rule.
-- Guard the exact known fragment; never silently patch a changed definition.
do $$declare definition text; old_fragment text; matches integer;
begin
 definition:=pg_get_functiondef('public.audit_daily_checklist(date,date,text,integer)'::regprocedure);
 old_fragment:='from[[:space:]]+public[.]exceptions[[:space:]]+where[[:space:]]+run_id[[:space:]]*=[[:space:]]*j[.]last_run_id';
 if position('from public.audit_current_case_rows' in definition)=0 then
  -- Also support reapplying after the earlier view-only read-path definition.
  definition:=replace(definition,'from public.active_audit_exceptions','from public.exceptions');
  select count(*) into matches from regexp_matches(definition,old_fragment,'g');
  if matches<>1 then raise exception 'Checklist definition changed; review before replacing';end if;
  execute regexp_replace(definition,old_fragment,E'from public.audit_current_case_rows(case when j.last_run_id is null then null else array[j.last_run_id] end)\n where run_id=j.last_run_id');
 end if;
end $$;
notify pgrst,'reload schema';
commit;
