-- Read-only totals for every UI summary. Counts are derived from the exact
-- current case membership used by the work queue, never accumulated history.
begin;
set local lock_timeout='5s';

create or replace function public.audit_current_case_counts_scoped(
 p_from date default null,p_to date default null,p_company text default 'ALL')
returns table(
 company text,business_date date,total_count bigint,open_count bigint,resolved_count bigint
) language sql stable security invoker set search_path=public,pg_temp as $$
 with scopes as materialized (
  select j.company,j.business_date
  from public.daily_recon_jobs j
  where not j.is_archived and (p_from is null or j.business_date>=p_from)
   and (p_to is null or j.business_date<=p_to)
   and (p_company is null or p_company='ALL' or j.company=p_company)
   and public.current_user_active() and public.has_company_access(j.company)
 ), counts as materialized (
  select e.company,e.business_date,
   count(*)::bigint as total_count,
   count(*) filter(where coalesce(e.status,'open') not in('closed','approved'))::bigint as open_count,
   count(*) filter(where e.status in('closed','approved'))::bigint as resolved_count
  from public.audit_current_case_rows_scoped(p_from,p_to,p_company) e
  group by e.company,e.business_date
 )
 select s.company,s.business_date,coalesce(c.total_count,0),coalesce(c.open_count,0),coalesce(c.resolved_count,0)
 from scopes s left join counts c using(company,business_date)
 order by s.business_date desc,s.company
$$;

revoke all on function public.audit_current_case_counts_scoped(date,date,text) from public,anon;
grant execute on function public.audit_current_case_counts_scoped(date,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
