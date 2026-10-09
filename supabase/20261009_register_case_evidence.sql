-- Register an already-uploaded object. No uploads, case updates or policy changes.
-- Exact scoped checks avoid traversing all Storage SELECT policies during INSERT.
begin;
set local lock_timeout='5s';
create or replace function public.register_case_evidence(p_metadata jsonb)
returns public.case_evidence language plpgsql security definer
set search_path=public,pg_temp as $$
declare m public.case_evidence%rowtype; saved public.case_evidence%rowtype;
 e public.exceptions%rowtype; object_size bigint; role_name text;
begin
 if auth.uid() is null or public.current_user_active() is distinct from true then
  raise exception 'ต้องเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์' using errcode='42501';
 end if;
 m:=jsonb_populate_record(null::public.case_evidence,p_metadata);
 if m.id is null or m.exception_id is null or m.uploaded_by is distinct from auth.uid()
 or m.storage_path is distinct from 'case-evidence/'||m.exception_id::text||'/'||auth.uid()::text||'/'||m.id::text
 or m.file_name is null or length(btrim(m.file_name))=0 or m.mime_type is null
 or m.size_bytes is null or m.size_bytes not between 1 and 20971520 then
  raise exception 'คำขอหลักฐานไม่ถูกต้อง' using errcode='22023';
 end if;
 select * into e from public.exceptions where id=m.exception_id for share;
 if not found or public.has_company_access(e.company) is distinct from true then
  raise exception 'ไม่พบเคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501';
 end if;
 select * into saved from public.case_evidence where id=m.id;
 if not found then
  role_name:=public.current_app_role();
  if not coalesce((coalesce(role_name,'') in ('monitor','lead','shift_lead','admin')
    and e.status in ('open','clarifying','answered')
    and (role_name<>'shift_lead' or e.status='clarifying')),false)
    and not coalesce(public.can_attach_pending_pair_evidence(e.id),false) then
   raise exception 'ไม่มีสิทธิ์แนบหลักฐานในสถานะเคสนี้' using errcode='42501';
  end if;
  select (o.metadata->>'size')::bigint into object_size from storage.objects o
   where o.bucket_id='audit-files' and o.name=m.storage_path and o.owner_id=auth.uid()::text for share;
  if not found or object_size is distinct from m.size_bytes then
   raise exception 'ยังยืนยันไฟล์ต้นฉบับและขนาดในคลังไม่ได้' using errcode='22023';
  end if;
  insert into public.case_evidence(id,exception_id,storage_path,file_name,size_bytes,mime_type,uploaded_by)
  values(m.id,m.exception_id,m.storage_path,m.file_name,m.size_bytes,m.mime_type,auth.uid())
  on conflict(id) do nothing;
  select * into saved from public.case_evidence where id=m.id;
 end if;
 if saved.exception_id is distinct from m.exception_id or saved.storage_path is distinct from m.storage_path
 or saved.uploaded_by is distinct from auth.uid() or saved.size_bytes is distinct from m.size_bytes
 or saved.file_name is distinct from m.file_name or saved.mime_type is distinct from m.mime_type then
  raise exception 'ทะเบียนหลักฐานไม่ตรงกับคำขอเดิม ไม่เขียนทับ' using errcode='22023';
 end if;
 return saved;
end $$;
revoke all on function public.register_case_evidence(jsonb) from public,anon;
grant execute on function public.register_case_evidence(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
