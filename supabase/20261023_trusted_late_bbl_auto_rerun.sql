-- Same-day BBL statements for 3XB/AT4/SK8 commonly arrive after the 08:00 run.
-- Treat only those exact late STM receipts as informational so the next normal
-- round can parse and reconcile them. Every other post-run source remains held.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.audit_run_preflight_review(p_company text,p_date date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
 j public.daily_recon_jobs;
 r public.recon_runs;
 draft public.audit_run_preflight_drafts;
 warnings jsonb:='[]';
 informational jsonb:='[]';
 arrivals jsonb:='[]';
begin
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived;
 if j.last_run_id is not null then
  select * into r from public.recon_runs where id=j.last_run_id and company=p_company and business_date=p_date;
 elsif j.id is not null then
  select * into r from public.recon_runs where company=p_company and business_date=p_date
  and summary->>'job_id'=j.id::text order by created_at desc,id desc limit 1;
 end if;
 select * into draft from public.audit_run_preflight_drafts where job_id=j.id order by created_at desc,id desc limit 1;

 with files as (
  select f.id,coalesce(v.effective_name,f.file_name) name,coalesce(v.kind,f.kind) kind,
   coalesce(v.business_date,b.business_date) effective_day,
   case when v.id is null then f.parse_error else null end error,
   coalesce(v.replacement_file_id,f.id) physical_id,f.created_at
  from public.source_files f join public.mail_batches b on b.id=f.batch_id
  left join lateral(select * from public.audit_source_revisions where source_file_id=f.id order by revision desc limit 1) v on true
  where coalesce(v.company,f.company,b.company)=p_company and coalesce(v.business_date,b.business_date)=p_date
  and not coalesce(v.excluded,false)
  and not exists(select 1 from public.audit_source_revisions parent where parent.replacement_file_id=f.id)
 ), notices as (
  select 'file_day_mismatch' code,id,name,substring(name from '20[0-9]{2}-[0-9]{2}-[0-9]{2}') detail
  from files where kind in ('bo_main','stm_pdf','pm_statement')
  and substring(name from '20[0-9]{2}-[0-9]{2}-[0-9]{2}') is not null
  and substring(name from '20[0-9]{2}-[0-9]{2}-[0-9]{2}')<>effective_day::text
  union all
  select 'parse_error',id,name,error from files
  where kind in ('bo_main','stm_pdf','pm_statement') and nullif(error,'') is not null
  union all
  select 'files_after_run',id,name,'มีไฟล์ใหม่หลังผลรันเดิม ต้องทบทวนก่อนรันต่อ' from files
  where r.id is not null and created_at>r.created_at
  and not(physical_id=any(coalesce(r.file_ids,'{}'::uuid[])))
  and kind in ('bo_main','stm_pdf','pm_statement')
  and not(
   p_company in ('3XB','AT4','SK8')
   and kind='stm_pdf'
   and name~*'(^|[^A-Z0-9])BBL([^A-Z0-9]|$)|ธนาคารกรุงเทพ'
   and effective_day=p_date
   and nullif(error,'') is null
  )
 )
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'file_id',id,'file_name',name,'detail',detail)
  order by code,name,id),'[]') into warnings from notices;

 with files as (
  select f.id,coalesce(v.effective_name,f.file_name) name,coalesce(v.kind,f.kind) kind,
   coalesce(v.business_date,b.business_date) effective_day,
   case when v.id is null then f.parse_error else null end error,
   coalesce(v.replacement_file_id,f.id) physical_id,f.created_at
  from public.source_files f join public.mail_batches b on b.id=f.batch_id
  left join lateral(select * from public.audit_source_revisions where source_file_id=f.id order by revision desc limit 1) v on true
  where coalesce(v.company,f.company,b.company)=p_company and coalesce(v.business_date,b.business_date)=p_date
  and not coalesce(v.excluded,false)
  and not exists(select 1 from public.audit_source_revisions parent where parent.replacement_file_id=f.id)
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'code','trusted_late_bbl','file_id',id,'file_name',name,
  'detail','BBL วันที่เดียวกันมาหลังรอบแรก ให้รอบอัตโนมัติถัดไปอ่านและกระทบยอด') order by name,id),'[]')
 into informational from files
 where r.id is not null and created_at>r.created_at
 and not(physical_id=any(coalesce(r.file_ids,'{}'::uuid[])))
 and p_company in ('3XB','AT4','SK8') and kind='stm_pdf'
 and name~*'(^|[^A-Z0-9])BBL([^A-Z0-9]|$)|ธนาคารกรุงเทพ'
 and effective_day=p_date and nullif(error,'') is null;

 if exists(select 1 from public.audit_run_holds where company=p_company and business_date=p_date and paused)
 or public.audit_source_scope_managed(p_company,p_date) then
  warnings:=warnings||jsonb_build_array(jsonb_build_object('code','source_held','detail','รอบนี้พักรันหรือมีเวอร์ชันแก้ไข ต้องให้คนทบทวนก่อน'));
 end if;

 if r.id is not null then
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'code',e.code,'source_date',e.business_date,
   'report_date',r.business_date,'account',e.account,'direction',e.direction,'amount',e.system_amount,
   'status',e.status,'run_id',e.run_id,'source_rows',e.customer_details->'source_rows','read_only',true)
   order by e.business_date,e.occurred_at,e.id),'[]') into arrivals
  from public.exceptions e where e.run_id=r.id and e.company=p_company and e.business_date<>p_date
  and e.ex_type='cross_day' and e.superseded_by_exception_id is null;
 end if;
 if jsonb_array_length(arrivals)>0 then
  informational:=informational||jsonb_build_array(jsonb_build_object('code','cross_day_scope',
   'detail','พบรายการข้ามวันตามบริบท เก็บวันและแถวเดิมให้ทีมตรวจ ไม่หยุดรอบเพราะวันต่างกันอย่างเดียว',
   'count',jsonb_array_length(arrivals)));
 end if;
 if draft.id is not null then
  warnings:=warnings||draft.warnings;
  select arrivals||coalesce(jsonb_agg(jsonb_build_object('code',e->>'code','source_date',e->>'business_date',
   'report_date',p_date,'account',e->>'account','direction',e->>'direction','amount',e->'system_amount',
   'source_rows',e#>'{customer_details,source_rows}','draft_id',draft.id,'read_only',true,'persisted_case',false)),'[]')
  into arrivals from jsonb_array_elements(draft.exceptions) e where e->>'business_date' is distinct from p_date::text;
 end if;
 return jsonb_build_object('version',3,'policy','trusted_late_bbl_v1','informational',informational,
  'blocked',jsonb_array_length(warnings)>0,'warnings',warnings,'cross_day_queue',arrivals,
  'run_id',r.id,'draft_id',draft.id,'review_mode','warnings_only','read_only',true);
end $$;

revoke all on function public.audit_run_preflight_review(text,date) from public,anon,authenticated;
grant execute on function public.audit_run_preflight_review(text,date) to service_role;
notify pgrst,'reload schema';
commit;
