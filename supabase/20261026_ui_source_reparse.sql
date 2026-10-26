-- Re-read an existing effective source from the authenticated file-management UI.
-- This receipt changes parser metadata only. It never queues reconciliation,
-- writes a run, or creates/updates/closes an exception.
begin;

create or replace function public.record_audit_source_reparse(
  p_file_id uuid,
  p_expected_revision integer,
  p_expected_checksum text,
  p_parser_version text,
  p_row_count integer,
  p_parse_error text,
  p_quality jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  source public.source_files%rowtype;
  physical public.source_files%rowtype;
  revision public.audit_source_revisions%rowtype;
  current_revision integer;
  target_id uuid;
  effective_company text;
  passed boolean;
begin
  if not coalesce(public.current_user_active(),false)
     or coalesce(public.current_app_role(),'') not in ('lead','admin') then
    raise exception 'เฉพาะหัวหน้า/ผู้ดูแล';
  end if;
  if p_row_count<0 or length(coalesce(p_parser_version,'')) not between 3 and 200
     or octet_length(coalesce(p_parse_error,''))>2000
     or jsonb_typeof(coalesce(p_quality,'{}'::jsonb)) is distinct from 'object' then
    raise exception 'ผลอ่านไฟล์ไม่ถูกต้อง';
  end if;

  select * into source from public.source_files where id=p_file_id for update;
  if not found then raise exception 'ไม่พบไฟล์'; end if;
  select * into revision from public.audit_source_revisions
   where source_file_id=p_file_id order by revision desc limit 1;
  current_revision:=coalesce(revision.revision,1);
  target_id:=coalesce(revision.replacement_file_id,source.id);
  effective_company:=coalesce(revision.company,source.company);
  if current_revision is distinct from p_expected_revision then
    raise exception 'เวอร์ชันไฟล์เปลี่ยนแล้ว โหลดใหม่';
  end if;
  if not coalesce(public.has_company_access(effective_company),false) then
    raise exception 'ไม่มีสิทธิ์บริษัท';
  end if;

  select * into physical from public.source_files where id=target_id for update;
  if not found or physical.checksum is distinct from p_expected_checksum
     or physical.storage_path is null or coalesce(physical.size_bytes,0)<=0 then
    raise exception 'ไฟล์จริงเปลี่ยนหรือข้อมูลไม่ครบ โหลดใหม่';
  end if;

  passed:=p_parse_error is null and coalesce((p_quality->>'complete')::boolean,false);
  update public.source_files set
    parsed=passed,
    parsed_at=case when passed then now() else null end,
    row_count=case when passed then p_row_count else row_count end,
    parse_error=case when passed then null else left(coalesce(p_parse_error,'อ่านไฟล์ไม่ครบ'),2000) end
  where id=target_id;

  insert into public.audit_log(actor,action,entity,target,company,detail,meta)
  values(auth.uid()::text,case when passed then 'source_reparse_passed' else 'source_reparse_failed' end,
    'source_file',p_file_id::text,effective_company,
    case when passed then 'อ่านไฟล์เดิมใหม่จากหน้าระบบสำเร็จ' else left(coalesce(p_parse_error,'อ่านไฟล์ไม่ครบ'),2000) end,
    jsonb_build_object('physical_source_file_id',target_id,'revision',current_revision,
      'parser_version',p_parser_version,'row_count',p_row_count,'quality',coalesce(p_quality,'{}'::jsonb),
      'reconciliation_started',false,'case_write',false));

  return jsonb_build_object('file_id',p_file_id,'physical_source_file_id',target_id,
    'revision',current_revision,'parsed',passed,'row_count',case when passed then p_row_count else physical.row_count end,
    'parse_error',case when passed then null else left(coalesce(p_parse_error,'อ่านไฟล์ไม่ครบ'),2000) end);
end;
$$;

revoke all on function public.record_audit_source_reparse(uuid,integer,text,text,integer,text,jsonb) from public,anon;
grant execute on function public.record_audit_source_reparse(uuid,integer,text,text,integer,text,jsonb) to authenticated;

-- A metadata revision must expose the parse state of the physical file that is
-- actually selected. The old expression forced every revised source to remain
-- "ต้องอ่านใหม่" forever, even after the replacement was parsed successfully.
create or replace function public.effective_audit_source_files(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if coalesce(auth.role(),'')<>'service_role' and (not coalesce(public.current_user_active(),false)
 or not coalesce(public.has_company_access(p_company),false)) then raise exception 'ไม่มีสิทธิ์อ่านบริษัทนี้';end if;
 return (select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object(
  'file_name',coalesce(r.effective_name,f.file_name),'original_file_name',f.file_name,
  'company',coalesce(r.company,f.company,b.company),'business_date',coalesce(r.business_date,b.business_date),
  'kind',coalesce(r.kind,f.kind),'revision',coalesce(r.revision,1),'excluded',coalesce(r.excluded,false),
  'replacement_file_id',r.replacement_file_id,'physical_source_file_id',coalesce(r.replacement_file_id,f.id),
  'storage_path',coalesce(replacement.storage_path,f.storage_path),
  'checksum',coalesce(replacement.checksum,f.checksum),
  'size_bytes',coalesce(replacement.size_bytes,f.size_bytes),
  'storage_object_version',o.updated_at,'storage_object_etag',o.metadata->>'eTag',
  'storage_size_bytes',o.metadata->>'size',
  'mime_type',coalesce(replacement.mime_type,f.mime_type),
  'row_count',case when r.replacement_file_id is not null then replacement.row_count else f.row_count end,
  'parse_error',case when r.replacement_file_id is not null then replacement.parse_error else f.parse_error end,
  'parsed',case when r.replacement_file_id is not null then replacement.parsed else f.parsed end,
  'source_file_ocr',(select coalesce(jsonb_agg(to_jsonb(o)),'[]') from public.source_file_ocr o
    where o.source_file_id=coalesce(r.replacement_file_id,f.id))) order by f.created_at,f.id),'[]')
 from public.source_files f join public.mail_batches b on b.id=f.batch_id
 left join lateral(select * from public.audit_source_revisions where source_file_id=f.id order by revision desc limit 1) r on true
 left join public.source_files replacement on replacement.id=r.replacement_file_id
 left join storage.objects o on o.bucket_id='audit-files' and o.name=coalesce(replacement.storage_path,f.storage_path)
 where coalesce(r.company,f.company,b.company)=p_company and coalesce(r.business_date,b.business_date) between p_date and p_date+1
 and not exists(select 1 from public.audit_source_revisions parent where parent.replacement_file_id=f.id)
 and (coalesce(r.business_date,b.business_date)=p_date or (coalesce(r.kind,f.kind)='stm_pdf'
 and ((p_company in ('AT4','FR8','SK8') and coalesce(r.effective_name,f.file_name)~*'(KTB|กรุงไทย)')
 or coalesce(r.effective_name,f.file_name)~*'(BBL|ธนาคารกรุงเทพ)'
 or (p_date in ('2026-10-01'::date,'2026-10-02'::date) and coalesce(r.effective_name,f.file_name)~*'(SCB|ไทยพาณิชย์)')))));
end $$;

notify pgrst,'reload schema';
commit;
