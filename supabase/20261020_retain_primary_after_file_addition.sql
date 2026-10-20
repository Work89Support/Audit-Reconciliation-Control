-- Keep an accepted primary result usable when sources are only appended.
-- Definitions only: no runs, confirmations, amounts, cases, holds or history change.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.manual_primary_sources_intact(p_stamp jsonb,p_files jsonb)
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select jsonb_typeof(p_stamp)='array' and jsonb_array_length(p_stamp)>0
 and public.manual_primary_sources(p_files) @> p_stamp
$$;
revoke all on function public.manual_primary_sources_intact(jsonb,jsonb) from public,anon;
grant execute on function public.manual_primary_sources_intact(jsonb,jsonb) to authenticated;

create or replace function public.read_manual_primary(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v public.manual_primary_results; j public.daily_recon_jobs; current_stamp jsonb;
 review_needed boolean; source_intact boolean; added_file_count integer;
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false) then raise exception 'ไม่มีสิทธิ์บริษัท';end if;
 select * into v from public.manual_primary_results where company=p_company and business_date=p_date order by accepted_at desc,id desc limit 1;
 if v.id is null then return null;end if;
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived;
 if j.last_run_id is distinct from v.base_run_id and j.status='completed' and coalesce(j.error_count,0)=0
 and exists(select 1 from public.recon_runs r where r.id=j.last_run_id and r.company=p_company and r.business_date=p_date)
 then return null;end if;
 current_stamp:=public.manual_primary_sources(public.effective_audit_source_files(p_company,p_date));
 source_intact:=public.manual_primary_sources_intact(v.source_stamp,public.effective_audit_source_files(p_company,p_date));
 review_needed:=current_stamp is distinct from v.source_stamp or j.last_run_id is distinct from v.base_run_id;
 added_file_count:=greatest(0,jsonb_array_length(current_stamp)-jsonb_array_length(v.source_stamp));
 if not source_intact or j.last_run_id is distinct from v.base_run_id then
  return (to_jsonb(v)-'source_stamp')||jsonb_build_object('stale',true,'review_needed',true,
   'review_reason','ผลหลักเดิมยังเก็บในประวัติ แต่ไฟล์เดิมหรือรอบงานเปลี่ยน ต้องรันทบทวนใหม่','added_file_count',added_file_count);
 end if;
 return (to_jsonb(v)-'source_stamp')||jsonb_build_object('stale',false,'review_needed',review_needed,
  'review_reason',case when review_needed then 'มีไฟล์เพิ่มหลังยืนยัน ผลหลักเดิมยังใช้งานได้ กรุณาทบทวนไฟล์เพิ่มก่อนยืนยันผลหลักชุดใหม่' else null end,
  'added_file_count',added_file_count);
end $$;

-- An appended file does not invalidate the immutable source rows already used
-- by an accepted manual case. Existing hold, role, evidence and approval gates remain.
create or replace function public.cross_day_current_manual_case(e public.exceptions)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.current_user_active() and public.has_company_access(e.company)
 and public.primary_case_is_current(e.id)
 and exists(select 1 from public.manual_primary_case_items i
 join public.manual_primary_results v on v.id=i.primary_id
 join public.account_recheck_jobs q on q.id=v.recheck_id
 join public.daily_recon_jobs j on j.company=v.company and j.business_date=v.business_date
 where i.exception_id=e.id
 and v.id=(select latest.id from public.manual_primary_results latest
  where latest.company=e.company and latest.business_date=e.business_date
  order by latest.accepted_at desc,latest.id desc limit 1)
 and v.company=e.company and v.business_date=e.business_date and v.base_run_id is not distinct from e.run_id
 and not j.is_archived and j.status<>'running' and j.last_run_id is not distinct from v.base_run_id
 and q.status='confirmed' and public.manual_primary_report_projection(q.result)=v.report and q.account='ALL' and q.direction='all'
 and v.report->>'quality'='passed'
 and public.manual_primary_sources_intact(v.source_stamp,public.effective_audit_source_files(v.company,v.business_date))
 and exists(select 1 from jsonb_array_elements(v.source_stamp) p
 join public.source_files bo on bo.id::text=p->>'id'
 join storage.objects obj on obj.bucket_id='audit-files' and obj.name=bo.storage_path
 where p->>'id'=e.customer_details#>>'{source_rows,bo,fileId}'
 and bo.company=e.company and bo.kind='bo_main' and not coalesce((to_jsonb(bo)->>'is_archived')::boolean,false)
 and e.customer_details#>>'{source_rows,bo,row}'~'^[1-9][0-9]*$'))
$$;
revoke all on function public.read_manual_primary(text,date),public.cross_day_current_manual_case(public.exceptions) from public,anon;
grant execute on function public.read_manual_primary(text,date) to authenticated;
notify pgrst,'reload schema';
commit;
