-- Read-only original file catalogue for emergency manual reconciliation.
begin;
create or replace function public.audit_source_archive_manifest(p_company text,p_date date,p_include_evidence boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare j public.daily_recon_jobs%rowtype;run_files uuid[];files jsonb;source_ids uuid[];extra jsonb;
begin
 if auth.uid() is null or not coalesce(public.current_user_active(),false)
 or coalesce(public.current_app_role(),'') not in ('monitor','lead','admin')
 or not coalesce(public.has_company_access(p_company),false) then raise exception 'ไม่มีสิทธิ์ดาวน์โหลดบริษัทนี้';end if;
 if p_date is null or not exists(select 1 from public.audit_companies where code=p_company and active)
 then raise exception 'เลือกบริษัทและวันที่ให้ถูกต้อง';end if;
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived;
 select file_ids into run_files from public.recon_runs where id=j.last_run_id;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id','s_'||f.id,'origin','mail','company',p_company,'source_date',b.business_date,
  'file_name',f.file_name,'storage_path',f.storage_path,'kind',f.kind,
  'checksum',f.checksum,'registered_size_bytes',f.size_bytes,'object_version',o.updated_at,'object_etag',o.metadata->>'eTag',
  'size_bytes',coalesce(case when o.metadata->>'size' ~ '^[0-9]{1,12}$' then (o.metadata->>'size')::bigint end,f.size_bytes),
  'parsed',f.parsed,'parse_error',f.parse_error
 ) order by f.created_at,f.id),'[]'),coalesce(array_agg(f.id),'{}') into files,source_ids
 from public.source_files f join public.mail_batches b on b.id=f.batch_id
 left join storage.objects o on o.bucket_id='audit-files' and o.name=f.storage_path
 where coalesce(nullif(f.company,''),b.company)=p_company
 and (b.business_date=p_date or f.id=any(coalesce(run_files,'{}'))
  or (p_include_evidence and f.id in(select clarification_file_id from public.exceptions where company=p_company and business_date=p_date)))
 and (p_include_evidence or f.kind is distinct from 'doc_clarify');
 if p_include_evidence then
  select coalesce(jsonb_agg(jsonb_build_object(
   'id','e_'||ce.id,'origin','case_evidence','company',p_company,'source_date',e.business_date,
   'file_name',ce.file_name,'storage_path',ce.storage_path,'kind','doc_clarify',
   'checksum',to_jsonb(ce)->>'checksum','registered_size_bytes',ce.size_bytes,'object_version',o.updated_at,'object_etag',o.metadata->>'eTag',
   'size_bytes',coalesce(case when o.metadata->>'size' ~ '^[0-9]{1,12}$' then (o.metadata->>'size')::bigint end,ce.size_bytes),
   'parsed',false,'parse_error',null
  ) order by ce.created_at,ce.id),'[]') into extra
  from public.case_evidence ce join public.exceptions e on e.id=ce.exception_id
  left join storage.objects o on o.bucket_id='audit-files' and o.name=ce.storage_path
  where e.company=p_company and e.business_date=p_date;
  files:=files||extra;
  if to_regclass('public.source_file_replacements') is not null then
   execute $query$select coalesce(jsonb_agg(jsonb_build_object(
    'id','h_'||r.id,'origin','source_history','company',$1,'source_date',$2,
    'file_name',r.old_file_name,'storage_path',r.old_storage_path,'kind',r.kind,
    'checksum',r.old_checksum,'registered_size_bytes',r.old_size_bytes,'object_version',o.updated_at,'object_etag',o.metadata->>'eTag',
    'size_bytes',coalesce(case when o.metadata->>'size' ~ '^[0-9]{1,12}$' then (o.metadata->>'size')::bigint end,r.old_size_bytes),
    'parsed',false,'parse_error',null
   ) order by r.replaced_at,r.id),'[]') from public.source_file_replacements r
   left join storage.objects o on o.bucket_id='audit-files' and o.name=r.old_storage_path
   where r.source_file_id=any($3) and r.company=$1$query$
   into extra using p_company,p_date,source_ids;
   files:=files||extra;
  end if;
  if to_regclass('public.audit_source_revisions') is not null then
   execute $query$select coalesce(jsonb_agg(jsonb_build_object(
    'id','v_'||r.id,'origin','source_history','company',$1,'source_date',$2,
    'file_name',r.original->>'file_name','storage_path',r.original->>'storage_path','kind',r.original->>'kind',
    'checksum',r.original->>'checksum','registered_size_bytes',r.original->'size_bytes','object_version',o.updated_at,'object_etag',o.metadata->>'eTag',
    'size_bytes',case when o.metadata->>'size' ~ '^[0-9]{1,12}$' then to_jsonb((o.metadata->>'size')::bigint) else r.original->'size_bytes' end,
    'parsed',false,'parse_error',null
   ) order by r.created_at,r.id),'[]') from public.audit_source_revisions r
   left join storage.objects o on o.bucket_id='audit-files' and o.name=r.original->>'storage_path'
   where r.source_file_id=any($3) and r.original->>'company'=$1$query$
   into extra using p_company,p_date,source_ids;
   files:=files||extra;
  end if;
 end if;
 return jsonb_build_object('company',p_company,'business_date',p_date,'run_id',j.last_run_id,'job_status',j.status,
 'files',files,'file_count',jsonb_array_length(files),'read_only',true);
end $$;
create or replace function public.audit_source_archive_validate(p_company text,p_date date,p_include_evidence boolean,p_files jsonb)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare current_files jsonb;
begin
 current_files:=public.audit_source_archive_manifest(p_company,p_date,p_include_evidence)->'files';
 if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files)>500 then raise exception 'รายการไฟล์ไม่ถูกต้อง';end if;
 return not exists(select 1 from jsonb_array_elements(p_files) wanted where not exists(
  select 1 from jsonb_array_elements(current_files) actual where actual->>'id'=wanted->>'id'
  and actual->>'storage_path'=wanted->>'storage_path' and actual->>'file_name'=wanted->>'file_name'
  and actual->>'checksum' is not distinct from wanted->>'checksum'
  and actual->>'object_version' is not distinct from wanted->>'object_version'
  and actual->>'object_etag' is not distinct from wanted->>'object_etag'
  and actual->>'size_bytes' is not distinct from wanted->>'size_bytes'));
end $$;
revoke all on function public.audit_source_archive_manifest(text,date,boolean) from public,anon;
grant execute on function public.audit_source_archive_manifest(text,date,boolean) to authenticated;
revoke all on function public.audit_source_archive_validate(text,date,boolean,jsonb) from public,anon;
grant execute on function public.audit_source_archive_validate(text,date,boolean,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
