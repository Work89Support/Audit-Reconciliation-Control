-- Selecting an existing document is client-only. Submit answer + file atomically.
begin;
set local lock_timeout='5s';
create or replace function public.case_clarification_history(p_case uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare e public.exceptions%rowtype; result jsonb;
begin
 select * into e from public.exceptions where id=p_case;
 if not found or auth.uid() is null or not public.current_user_active()
  or public.current_app_role() not in ('shift_lead','monitor','audit_assistant','lead','admin')
  or not public.has_company_access(e.company) then raise exception 'ไม่มีสิทธิ์อ่านคำชี้แจง' using errcode='42501';end if;
 select coalesce(jsonb_agg(x.value order by x.at),'[]') into result from (
  select e.responded_at as at,jsonb_build_object('label','คำชี้แจงที่ส่งแล้ว','text',e.response_text,'at',e.responded_at,
    'actor_name',(select full_name from public.app_profiles where user_id=e.responded_by),'file_name',(select file_name from public.source_files where id=e.clarification_file_id and company=e.company)) value
  where nullif(btrim(e.response_text),'') is not null
  union all
  select null::timestamptz,jsonb_build_object('label','ข้อความเลือกไฟล์เดิม / ผลตรวจเดิม (ไม่ใช่การอนุมัติใหม่)','text',e.resolution_note,'at',null,'actor_name',e.resolved_by,
    'file_name',(select file_name from public.source_files where id=e.clarification_file_id and company=e.company))
  where nullif(btrim(e.resolution_note),'') is not null and e.resolution_note is distinct from e.response_text
  union all
  select a.at,jsonb_build_object('label','ประวัติคำชี้แจง / การเลือกหลักฐาน','text',coalesce(a.meta->>'response_text',a.meta->>'note',a.detail),
    'at',a.at,'actor_name',coalesce(p.full_name,a.actor),'file_name',f.file_name)
  from public.audit_log a left join public.app_profiles p on p.user_id=a.actor_user_id
  left join public.source_files f on f.id::text=coalesce(a.meta->>'source_file_id',case when a.entity='source_file' then a.target end) and f.company=e.company
  where a.action in ('clarification_submitted','clarification_manual_multi_match','case_note')
    and ((a.entity='exception' and a.target=e.id::text)
      or (a.entity='source_file' and a.meta->'exception_ids' @> jsonb_build_array(e.id)))
  union all
  select a.at,jsonb_build_object('label','คำชี้แจงก่อนการส่งเพิ่มเติม','text',a.meta->>'previous_response_text','at',a.meta->>'previous_responded_at',
    'actor_name',(select full_name from public.app_profiles where user_id::text=a.meta->>'previous_responded_by'),
    'file_name',(select file_name from public.source_files where id::text=a.meta->>'previous_file_id' and company=e.company))
  from public.audit_log a where a.action='clarification_submitted' and a.entity='exception' and a.target=e.id::text
    and nullif(btrim(a.meta->>'previous_response_text'),'') is not null
 ) x;
 return result;
end $$;
create or replace function public.submit_case_clarification(p_case uuid,p_response text,p_file uuid,p_previous_status text,p_previous_file uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.exceptions%rowtype;f public.source_files%rowtype;reason text:=btrim(p_response);
begin
 if auth.uid() is null or not public.current_user_active() or public.current_app_role() not in ('shift_lead','monitor','audit_assistant','lead','admin') then raise exception 'ไม่มีสิทธิ์ส่งคำชี้แจง' using errcode='42501';end if;
 if reason is null or length(reason) not between 10 and 2000 then raise exception 'ระบุสาเหตุ 10–2,000 ตัวอักษร';end if;
 select * into e from public.exceptions where id=p_case for update;
 if not found or not public.has_company_access(e.company) then raise exception 'ไม่มีสิทธิ์บริษัทของเคส' using errcode='42501';end if;
 if e.status not in ('clarifying','answered') or e.status is distinct from p_previous_status or e.clarification_file_id is distinct from p_previous_file then raise exception 'สถานะหรือหลักฐานเปลี่ยน กรุณาเปิดเคสล่าสุดก่อนส่ง';end if;
 if p_file is not null then
  select * into f from public.source_files where id=p_file for share;
  if not found or f.company is distinct from e.company or f.kind<>'doc_clarify' or coalesce(f.size_bytes,0)<=0
    or not exists(select 1 from storage.objects o where o.bucket_id='audit-files' and o.name=f.storage_path) then raise exception 'หลักฐานไม่ตรงบริษัทหรือไม่มีไฟล์ต้นฉบับ';end if;
 elsif not exists(select 1 from public.case_evidence ce join storage.objects o on o.bucket_id='audit-files' and o.name=ce.storage_path where ce.exception_id=e.id and ce.size_bytes>0) then raise exception 'ต้องมีหลักฐานจริงก่อนส่งคำชี้แจง';end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,company,detail,meta)
 values(auth.uid()::text,auth.uid(),'clarification_submitted','exception',e.id::text,e.company,reason,
  jsonb_build_object('response_text',reason,'source_file_id',p_file,'previous_response_text',e.response_text,'previous_responded_at',e.responded_at,'previous_responded_by',e.responded_by,'previous_file_id',e.clarification_file_id,'previous_status',e.status));
 update public.exceptions set response_text=reason,clarification_file_id=p_file,status='answered',responded_by=auth.uid(),responded_at=now(),updated_at=now() where id=e.id returning * into e;
 return to_jsonb(e);
end $$;
revoke all on function public.case_clarification_history(uuid),public.submit_case_clarification(uuid,text,uuid,text,uuid) from public,anon;
grant execute on function public.case_clarification_history(uuid),public.submit_case_clarification(uuid,text,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
