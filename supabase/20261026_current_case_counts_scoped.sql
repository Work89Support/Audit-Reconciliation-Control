-- Read-only totals for every UI summary. Counts are derived from the exact
-- current case membership used by the work queue, never accumulated history.
begin;
set local lock_timeout='5s';

create or replace function public.audit_current_case_counts_scoped(
 p_from date default null,p_to date default null,p_company text default 'ALL')
returns table(
 company text,business_date date,total_count bigint,open_count bigint,resolved_count bigint
) language sql stable security invoker set search_path=public,pg_temp as $$
 with heads as materialized (
  select distinct on(v.company,v.business_date) v.id,v.company,v.business_date,v.base_run_id
  from public.manual_primary_results v
  order by v.company,v.business_date,v.accepted_at desc,v.id desc
 ), scopes as materialized (
  select j.company,j.business_date,
   case when h.id is not null and j.last_run_id is not distinct from h.base_run_id then h.id end manual_primary_id,
   greatest(coalesce(q.exception_count,0),0)::bigint expected_count
  from public.daily_recon_jobs j
  left join heads h on h.company=j.company and h.business_date=j.business_date
  left join public.v_recon_quality q on q.company=j.company and q.business_date=j.business_date and q.run_id=j.last_run_id
  where not j.is_archived and (p_from is null or j.business_date>=p_from)
   and (p_to is null or j.business_date<=p_to)
   and (p_company is null or p_company='ALL' or j.company=p_company)
   and public.current_user_active() and public.has_company_access(j.company)
 ), current_rows as materialized (
  select e.* from public.audit_current_case_rows_scoped(p_from,p_to,p_company) e
 ), selected_ids as materialized (
  -- Accepted manual primaries already have exact membership.
  select e.id from current_rows e join scopes s using(company,business_date)
  where s.manual_primary_id is not null
  union all
  -- Automatic reprocessing can reuse one run_id while old case rows remain for
  -- audit history. Keep only the latest N projections reported by the current
  -- reconciliation result; never count the accumulated rows behind that run.
  select ranked.id from (
   select e.id,s.expected_count,
    row_number() over(partition by e.company,e.business_date order by e.created_at desc,e.id desc) as current_ordinal
   from current_rows e join scopes s using(company,business_date)
   where s.manual_primary_id is null
  ) ranked where ranked.current_ordinal<=ranked.expected_count
 ), counts as materialized (
  select e.company,e.business_date,
   count(*)::bigint as total_count,
   count(*) filter(where coalesce(e.status,'open') not in('closed','approved'))::bigint as open_count,
   count(*) filter(where e.status in('closed','approved'))::bigint as resolved_count
  from current_rows e join selected_ids selected on selected.id=e.id
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
