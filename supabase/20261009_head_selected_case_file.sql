-- Explicit evidence reference only: no closure, amount edits, file moves or wider visibility.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function public.link_selected_case_file(
  p_exception_id uuid, p_file_id uuid, p_note text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  e public.exceptions%rowtype;
  f public.source_files%rowtype;
  file_company text;
begin
  if auth.uid() is null or not public.current_user_active()
    or public.current_app_role() not in ('lead','admin') then
    raise exception 'เฉพาะหัวหน้า / ผู้ดูแลระบบเลือกไฟล์ข้ามบริษัทได้';
  end if;
  if p_note is null or length(btrim(p_note)) not between 10 and 2000 then
    raise exception 'ระบุรายการ วันที่ ยอด และเหตุผลที่ใช้เอกสาร 10–2000 ตัวอักษร';
  end if;
  select * into e from public.exceptions where id=p_exception_id for update;
  if not found or e.status not in ('open','clarifying','answered')
    or e.manual_pair_id is not null or e.case_closure_request_id is not null
    or e.superseded_by_exception_id is not null then
    raise exception 'เคสปิดแล้ว มีคำขออยู่ หรือถูกแทนที่ กรุณาโหลดสถานะล่าสุด';
  end if;
  if not public.has_company_access(e.company) then raise exception 'ไม่มีสิทธิ์บริษัทของเคส'; end if;
  if not exists(select 1 from public.daily_recon_jobs j where j.last_run_id=e.run_id
    and j.company=e.company and j.business_date=e.business_date and not j.is_archived) then
    raise exception 'ไม่ใช่เคสในผลรอบปัจจุบัน';
  end if;
  select * into f from public.source_files where id=p_file_id for share;
  if not found or f.is_archived or nullif(f.storage_path,'') is null then
    raise exception 'ไม่พบไฟล์ที่พร้อมเปิดตรวจ';
  end if;
  select upper(coalesce(nullif(f.company,''),b.company)) into file_company
    from public.mail_batches b where b.id=f.batch_id;
  if file_company is null or not public.has_company_access(file_company) then
    raise exception 'ไม่มีสิทธิ์บริษัทเจ้าของไฟล์';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='audit-files' and name=f.storage_path) then
    raise exception 'ยังไม่พบไฟล์ต้นฉบับในคลัง';
  end if;
  if e.clarification_file_id is not null and e.clarification_file_id<>f.id then
    raise exception 'เคสมีหลักฐานเดิมแล้ว ไม่เขียนทับหลักฐาน';
  end if;
  if e.clarification_file_id is distinct from f.id then
    update public.exceptions set clarification_file_id=f.id where id=e.id;
    insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta)
    values(auth.uid()::text,auth.uid(),'case_note','exception',e.id::text,btrim(p_note),
      jsonb_build_object('source_file_id',f.id,'file_company',file_company,
        'case_company',e.company,'evidence_link_only',true));
  end if;
  return jsonb_build_object('exception_id',e.id,'source_file_id',f.id,'status',e.status);
end $$;
revoke all on function public.link_selected_case_file(uuid,uuid,text) from public,anon;
grant execute on function public.link_selected_case_file(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
