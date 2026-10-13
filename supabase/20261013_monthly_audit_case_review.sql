-- Read-only lineage for the fixed sample. No re-sampling or financial/case writes.
begin;
create or replace function public.monthly_audit_item_review(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare i public.monthly_audit_items%rowtype;c text;cases jsonb;
begin
 select * into i from public.monthly_audit_items where id=p_item;
 if not found or not coalesce(public.can_read_monthly_audit(i.set_id),false) then
  raise exception 'ไม่มีสิทธิ์อ่านรายการตรวจนี้' using errcode='42501';
 end if;
 select company into c from public.monthly_audit_sets where id=i.set_id;
 -- Same run, company, date and exact file/row/direction lineage. Never amount-only.
 select coalesce(jsonb_agg(jsonb_build_object(
  'record',to_jsonb(e),
  'closed_by_name',(select full_name from public.app_profiles p where p.user_id::text=coalesce(to_jsonb(e)->>'approved_by',to_jsonb(e)->>'resolved_by')),
  'closures',(select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object(
    'requested_name',(select full_name from public.app_profiles where user_id=q.requested_by),
    'decided_name',(select full_name from public.app_profiles where user_id=q.decided_by)) order by q.requested_at),'[]')
   from public.case_closure_requests q where q.exception_id=e.id and q.company=c),
  'evidence',(select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at),'[]') from public.case_evidence f where f.exception_id=e.id),
  'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'file_name',f.file_name,'storage_path',f.storage_path,'mime_type',f.mime_type,'size_bytes',f.size_bytes,'kind',f.kind)),'[]')
    from public.source_files f where f.company=c and f.id::text=to_jsonb(e)->>'clarification_file_id'),
  'history',(select coalesce(jsonb_agg(jsonb_build_object('action',a.action,'detail',a.detail,'created_at',a.created_at,'actor_name',
    (select full_name from public.app_profiles where user_id=a.actor_user_id)) order by a.created_at),'[]')
    from public.audit_log a where a.company=c and a.target=e.id::text)
 ) order by e.id),'[]') into cases
 from public.exceptions e
 where e.company=c and e.business_date=i.business_date
 and (e.id=i.exception_id or (e.run_id=i.run_id and public.monthly_source_key(jsonb_build_object(
   'direction',e.direction,'bo',e.customer_details->'source_rows'->'bo','stm',e.customer_details->'source_rows'->'stm'))=i.source_key));
 return jsonb_build_object('item_id',i.id,'company',c,'business_date',i.business_date,'run_id',i.run_id,
  'snapshot',i.snapshot,'checked_at',statement_timestamp(),'cases',cases,
  'lineage_status',case when jsonb_array_length(cases)>0 then 'cases_found'
    when i.snapshot->>'kind'='matched' then 'no_case_at_sampling_run' else 'no_linked_case_at_sampling_run' end,
  'run',(select jsonb_build_object('id',r.id,'company',r.company,'business_date',r.business_date,
    'stm_count',to_jsonb(r)->'stm_count','bo_count',to_jsonb(r)->'bo_count','matched',to_jsonb(r)->'matched',
    'exception_count',to_jsonb(r)->'exception_count') from public.recon_runs r where r.id=i.run_id and r.company=c and r.business_date=i.business_date));
end $$;
revoke all on function public.monthly_audit_item_review(uuid) from public,anon;
grant execute on function public.monthly_audit_item_review(uuid) to authenticated;
commit;
