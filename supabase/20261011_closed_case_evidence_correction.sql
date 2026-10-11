-- Append-only evidence corrections. Never update exceptions, amounts or old files.
begin;
set local lock_timeout='5s';
alter table public.case_evidence add column if not exists replaces_evidence_id uuid references public.case_evidence(id);
alter table public.case_evidence add column if not exists replaces_source_file_id uuid references public.source_files(id);
alter table public.case_evidence add column if not exists correction_reason text;

-- Direct REST inserts must not fabricate replacement history via older insert policies.
create or replace function public.guard_case_evidence_correction()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype;
begin
 if new.replaces_evidence_id is not null or new.replaces_source_file_id is not null or new.correction_reason is not null then
  select * into e from public.exceptions where id=new.exception_id for update;
  if auth.uid() is null or public.current_user_active() is distinct from true
   or coalesce(public.current_app_role(),'') not in ('lead','admin')
   or public.has_company_access(e.company) is distinct from true or e.status not in ('closed','approved')
   or new.uploaded_by is distinct from auth.uid() then
   raise exception 'ไม่มีสิทธิ์บันทึกประวัติแก้หลักฐาน' using errcode='42501';
  end if;
  if coalesce(length(btrim(new.correction_reason)),0) not between 1 and 2000
   or (new.replaces_evidence_id is null)=(new.replaces_source_file_id is null)
   or new.replaces_evidence_id is not null and not exists(select 1 from public.case_evidence f where f.id=new.replaces_evidence_id and f.exception_id=new.exception_id)
   or new.replaces_source_file_id is not null and new.replaces_source_file_id is distinct from e.clarification_file_id then
   raise exception 'ประวัติหลักฐานไม่ถูกต้อง' using errcode='22023';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_case_evidence_correction() from public,anon,authenticated;
drop trigger if exists guard_case_evidence_correction on public.case_evidence;
create trigger guard_case_evidence_correction before insert on public.case_evidence
 for each row execute function public.guard_case_evidence_correction();

create or replace function public.register_closed_case_evidence(p_metadata jsonb)
returns public.case_evidence language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.case_evidence%rowtype; saved public.case_evidence%rowtype; e public.exceptions%rowtype; object_size bigint;
begin
 if auth.uid() is null or public.current_user_active() is distinct from true
 or coalesce(public.current_app_role(),'') not in ('lead','admin') then
  raise exception 'เฉพาะหัวหน้า/ผู้ดูแลแก้หลักฐานเคสที่ปิดแล้วได้' using errcode='42501';
 end if;
 m:=jsonb_populate_record(null::public.case_evidence,p_metadata);
 if m.id is null or m.exception_id is null or m.uploaded_by is distinct from auth.uid()
 or m.storage_path is distinct from 'case-evidence/'||m.exception_id::text||'/'||auth.uid()::text||'/'||m.id::text
 or coalesce(length(btrim(m.file_name)),0)=0 or m.mime_type is null
 or m.size_bytes is null or m.size_bytes not between 1 and 20971520
 or coalesce(length(btrim(m.correction_reason)),0) not between 1 and 2000
 or (m.replaces_evidence_id is null)=(m.replaces_source_file_id is null) then
  raise exception 'ต้องเลือกหลักฐานเดิมและระบุเหตุผล' using errcode='22023';
 end if;
 select * into e from public.exceptions where id=m.exception_id for update;
 if not found or public.has_company_access(e.company) is distinct from true or e.status not in ('closed','approved') then
  raise exception 'ไม่มีสิทธิ์บริษัทหรือสถานะล่าสุดไม่ใช่เคสปิดแล้ว' using errcode='42501';
 end if;
 if m.replaces_evidence_id is not null and not exists(select 1 from public.case_evidence f where f.id=m.replaces_evidence_id and f.exception_id=e.id) then
  raise exception 'หลักฐานเดิมไม่ได้อยู่ในเคสนี้' using errcode='22023';
 end if;
 if m.replaces_source_file_id is not null and m.replaces_source_file_id is distinct from e.clarification_file_id then
  raise exception 'ไฟล์ชี้แจงเดิมไม่ได้อยู่ในเคสนี้' using errcode='22023';
 end if;
 select * into saved from public.case_evidence where id=m.id;
 if not found then
  -- Serializing on the case prevents two simultaneous replacements of one original.
  if exists(select 1 from public.case_evidence f where f.exception_id=e.id
    and ((m.replaces_evidence_id is not null and f.replaces_evidence_id=m.replaces_evidence_id)
      or (m.replaces_source_file_id is not null and f.replaces_source_file_id=m.replaces_source_file_id))) then
   raise exception 'หลักฐานเดิมถูกแทนที่แล้ว กรุณาโหลดล่าสุดและเลือกไฟล์ใหม่' using errcode='40001';
  end if;
  select (o.metadata->>'size')::bigint into object_size from storage.objects o
   where o.bucket_id='audit-files' and o.name=m.storage_path and o.owner_id=auth.uid()::text for share;
  if not found or object_size is distinct from m.size_bytes then
   raise exception 'ยังยืนยันไฟล์ใหม่ในคลังไม่ได้' using errcode='22023';
  end if;
  insert into public.case_evidence(id,exception_id,storage_path,file_name,size_bytes,mime_type,uploaded_by,replaces_evidence_id,replaces_source_file_id,correction_reason)
   values(m.id,e.id,m.storage_path,m.file_name,m.size_bytes,m.mime_type,auth.uid(),m.replaces_evidence_id,m.replaces_source_file_id,btrim(m.correction_reason)) returning * into saved;
  insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
   values(auth.uid()::text,auth.uid(),'case_evidence_corrected','exception',e.id::text,
    'แก้ไขหลักฐาน (คงเคสปิดเดิม): '||coalesce(m.replaces_evidence_id,m.replaces_source_file_id)::text||' → '||m.id::text||' / '||btrim(m.correction_reason));
 end if;
 if saved.exception_id is distinct from m.exception_id or saved.storage_path is distinct from m.storage_path
 or saved.uploaded_by is distinct from auth.uid() or saved.size_bytes is distinct from m.size_bytes
 or saved.file_name is distinct from m.file_name or saved.mime_type is distinct from m.mime_type
 or saved.replaces_evidence_id is distinct from m.replaces_evidence_id or saved.replaces_source_file_id is distinct from m.replaces_source_file_id
 or saved.correction_reason is distinct from btrim(m.correction_reason) then
  raise exception 'คำขอซ้ำไม่ตรงกับประวัติเดิม ไม่เขียนทับ' using errcode='22023';
 end if;
 return saved;
end $$;
revoke all on function public.register_closed_case_evidence(jsonb) from public,anon;
grant execute on function public.register_closed_case_evidence(jsonb) to authenticated;
drop policy if exists case_evidence_closed_correction_upload on storage.objects;
create policy case_evidence_closed_correction_upload on storage.objects for insert to authenticated
with check(bucket_id='audit-files' and public.current_user_active()
 and public.current_app_role() in ('lead','admin') and split_part(name,'/',1)='case-evidence'
 and split_part(name,'/',3)=auth.uid()::text and array_length(string_to_array(name,'/'),1)=4
 and exists(select 1 from public.exceptions e where e.id::text=split_part(name,'/',2)
  and public.has_company_access(e.company) and e.status in ('closed','approved')));
notify pgrst,'reload schema';
commit;
