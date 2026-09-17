-- Link one existing recommendation document to one current case. No closure,
-- no cross-company status propagation, and no new company visibility.
begin;
set local lock_timeout='5s';
create or replace function public.link_recommended_case_evidence(
  p_exception_id uuid, p_recommendation_id uuid, p_note text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  e public.exceptions%rowtype;
  r public.evidence_recommendations%rowtype;
  f public.source_files%rowtype;
begin
  if auth.uid() is null or not public.current_user_active()
    or public.current_app_role() not in ('monitor','lead','admin') then
    raise exception 'ไม่มีสิทธิ์รับรองหลักฐาน';
  end if;
  if p_note is null or length(btrim(p_note)) not between 10 and 2000 then
    raise exception 'กรุณาระบุเหตุผล 10–2000 ตัวอักษร';
  end if;
  select * into e from public.exceptions where id=p_exception_id for update;
  if not found or e.status not in ('open','clarifying','answered') then
    raise exception 'เคสไม่เปิดหรือไม่มีข้อมูล';
  end if;
  select * into r from public.evidence_recommendations where id=p_recommendation_id;
  if not found or r.status<>'pending_audit' then raise exception 'ไม่พบคำแนะนำ'; end if;
  if not public.has_company_access(e.company)
    or not public.has_company_access(r.company)
    or not public.has_company_access(r.payer_company)
    or e.company not in(r.company,r.payer_company)
    or e.business_date<>r.business_date then raise exception 'บริษัทหรือวันที่ไม่ตรงหรือไม่มีสิทธิ์'; end if;
  if not exists(select 1 from public.evidence_recommendation_cases
    where recommendation_id=r.id and exception_id=e.id) then raise exception 'ไม่มีลิงก์แนะนำตรงเคส'; end if;
  if not exists(select 1 from public.daily_recon_jobs j where j.last_run_id=e.run_id
    and j.company=e.company and j.business_date=e.business_date and not j.is_archived) then
    raise exception 'ไม่ใช่ผลรอบปัจจุบัน';
  end if;
  select * into f from public.source_files where id=r.source_file_id;
  if not found or f.kind<>'doc_clarify' or f.company is null
    or upper(f.company) not in(r.company,r.payer_company) then raise exception 'เอกสารไม่ตรงกลุ่ม'; end if;
  if e.clarification_file_id is not null and e.clarification_file_id<>f.id then
    raise exception 'เคสมีเอกสารเดิมแล้ว ไม่เขียนทับหลักฐาน';
  end if;
  update public.exceptions set clarification_file_id=f.id where id=e.id;
  insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta)
  values(auth.uid()::text,auth.uid(),'case_note','exception',e.id::text,btrim(p_note),
    jsonb_build_object('source_file_id',f.id,'recommendation_id',r.id,'evidence_link_only',true));
  return jsonb_build_object('exception_id',e.id,'source_file_id',f.id,'status',e.status);
end $$;
revoke all on function public.link_recommended_case_evidence(uuid,uuid,text) from public,anon;
grant execute on function public.link_recommended_case_evidence(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
