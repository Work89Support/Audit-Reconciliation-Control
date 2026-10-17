-- Read-only current queue. No source, case, primary, history or hold writes.
begin;
set local lock_timeout='5s';
create or replace function public.audit_current_cases_scoped(
 p_from date default null,p_to date default null,p_company text default 'ALL',
 p_limit integer default 1000,p_offset integer default 0)
returns setof public.exceptions language plpgsql stable security invoker set search_path=public,pg_temp as $$
begin
 if not coalesce(public.current_user_active(),false) then
  raise exception 'Active authenticated user required' using errcode='42501';
 end if;
 if p_from is not null and p_to is not null and p_from>p_to then raise exception 'Invalid date scope';end if;
 return query
 with jobs as materialized (
  select j.company,j.business_date,j.last_run_id,j.status,j.error_count
  from public.daily_recon_jobs j where not j.is_archived
   and (p_from is null or j.business_date>=p_from) and (p_to is null or j.business_date<=p_to)
   and (p_company is null or p_company='ALL' or j.company=p_company)
   and public.has_company_access(j.company)
 ), heads as materialized (
  select distinct on(v.company,v.business_date) v.id,v.company,v.business_date,v.base_run_id
  from public.manual_primary_results v join jobs j on j.company=v.company and j.business_date=v.business_date
  order by v.company,v.business_date,v.accepted_at desc,v.id desc
 ), system_scopes as materialized (
  select j.* from jobs j left join heads m on m.company=j.company and m.business_date=j.business_date
  where m.id is null or (j.last_run_id is distinct from m.base_run_id and j.status='completed' and coalesce(j.error_count,0)=0
   and exists(select 1 from public.recon_runs r where r.id=j.last_run_id and r.company=j.company and r.business_date=j.business_date))
 ), current_rows as (
  select e.* from system_scopes j cross join lateral (
   select e.* from public.exceptions e where e.run_id=j.last_run_id and e.company=j.company and e.business_date=j.business_date
    and e.superseded_by_exception_id is null and e.customer_details->>'manual_primary_id' is null offset 0
  ) e
  union all
  select e.* from heads m join jobs j on j.company=m.company and j.business_date=m.business_date
   and j.last_run_id is not distinct from m.base_run_id
  join public.manual_primary_case_items i on i.primary_id=m.id
  join public.exceptions e on e.id=i.exception_id and e.company=m.company and e.business_date=m.business_date
  where e.superseded_by_exception_id is null
 )
 select e.* from current_rows e order by e.business_date desc,e.occurred_at desc,e.id desc
 limit least(greatest(coalesce(p_limit,1000),1),1000) offset greatest(coalesce(p_offset,0),0);
end $$;
revoke all on function public.audit_current_cases_scoped(date,date,text,integer,integer) from public,anon;
grant execute on function public.audit_current_cases_scoped(date,date,text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
