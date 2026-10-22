-- Read-only workbench scope. No amount, case, status, run, hold or history rows change.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.cross_day_workbench_for_case(p_case uuid)
returns jsonb language plpgsql stable security definer
set search_path=public,pg_temp set statement_timeout='12s' as $$
declare anchor public.exceptions%rowtype; cases jsonb; files jsonb;
begin
 if auth.uid() is null or not public.current_user_active() then
  raise exception 'ไม่มีสิทธิ์เปิดงานข้ามวัน' using errcode='42501';
 end if;
 select * into anchor from public.exceptions where id=p_case;
 if anchor.id is null or not public.has_company_access(anchor.company)
 or anchor.account is null or anchor.business_date is null
 or anchor.status not in ('open','pending_next_day')
 or anchor.superseded_by_exception_id is not null or anchor.cross_day_request_id is not null
 or anchor.manual_pair_id is not null or anchor.case_closure_request_id is not null
 or to_jsonb(anchor)->>'governance_request_id' is not null
 or not public.cross_day_actionable_case(anchor)
 or not public.cross_day_case_source_ready(anchor)
 then raise exception 'เคสข้ามวันไม่ใช่เคสล่าสุด หรือต้นทางยังไม่พร้อม';
 end if;

 with candidate_ids as materialized (
  select e.id from public.exceptions e
  where e.company=anchor.company and e.business_date=anchor.business_date
  and e.account=anchor.account and e.ex_type in ('cross_day','missing_stm')
  and e.status in ('open','pending_next_day')
  and coalesce(e.bo_time,e.occurred_at) between time '23:00:00' and time '23:59:59.999999'
  and e.superseded_by_exception_id is null and e.cross_day_request_id is null
  and e.manual_pair_id is null and e.case_closure_request_id is null
  and to_jsonb(e)->>'governance_request_id' is null
 )
 select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at,e.id),'[]') into cases
 from candidate_ids c join public.exceptions e on e.id=c.id
 where public.cross_day_actionable_case(e) and public.cross_day_case_source_ready(e);

 with candidate_files as materialized (
  select f.id,f.company,b.business_date,f.file_name,f.storage_path
  from public.source_files f join public.mail_batches b on b.id=f.batch_id
  where f.company=anchor.company and f.kind='stm_pdf'
  and b.business_date between anchor.business_date-3 and anchor.business_date+3
  and not coalesce((to_jsonb(f)->>'is_archived')::boolean,false)
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',f.id,'company',f.company,'business_date',f.business_date,
  'file_name',f.file_name,'storage_path',f.storage_path,
  'rows',coalesce((select jsonb_agg(n||jsonb_build_object('verified',true) order by (n->>'rowNo')::integer)
    from public.cross_day_verified_rows(f.id) n
    where n->>'account'=anchor.account and n->>'date'=anchor.business_date::text
    and n->>'sec'~'^[0-9]+$' and (n->>'sec')::integer between 82800 and 86399),'[]')
 ) order by f.business_date,f.file_name),'[]') into files
 from candidate_files f;

 return jsonb_build_object('version',2,'scope',jsonb_build_object(
  'case_id',anchor.id,'company',anchor.company,'business_date',anchor.business_date,'account',anchor.account),
  'cases',cases,'files',files);
end $$;

revoke all on function public.cross_day_workbench_for_case(uuid) from public,anon;
grant execute on function public.cross_day_workbench_for_case(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
