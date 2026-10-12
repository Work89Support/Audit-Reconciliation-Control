-- Install with account_recheck migration. No real-file/case correction is executed here.
begin;
create table public.audit_run_holds(
 company text not null,business_date date not null,paused boolean not null,
 reason text not null check(length(reason) between 10 and 2000),revision integer not null,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 primary key(company,business_date));
create table public.audit_source_revisions(
 id uuid primary key default gen_random_uuid(),source_file_id uuid not null references public.source_files(id),
 revision integer not null,effective_name text not null,company text not null,business_date date not null,
 kind text not null check(kind in ('bo_main','stm_pdf','pm_statement','doc_clarify','unknown')),
 replacement_file_id uuid references public.source_files(id),excluded boolean not null default false,
 original jsonb not null,reason text not null check(length(reason) between 10 and 2000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(source_file_id,revision),check(replacement_file_id is distinct from source_file_id));
alter table public.audit_run_holds enable row level security;
alter table public.audit_source_revisions enable row level security;
create policy audit_run_holds_read on public.audit_run_holds for select to authenticated
 using(public.current_user_active() and public.has_company_access(company));
create policy audit_source_revisions_read on public.audit_source_revisions for select to authenticated
 using(public.current_user_active() and public.has_company_access(company)
 and public.has_company_access(original->>'company'));
grant select on public.audit_run_holds,public.audit_source_revisions to authenticated;
revoke insert,update,delete on public.audit_run_holds,public.audit_source_revisions from authenticated,anon;

create function public.set_audit_run_hold(p_company text,p_date date,p_paused boolean,p_reason text,p_expected_revision integer)
returns public.audit_run_holds language plpgsql security definer set search_path=public as $$
declare h public.audit_run_holds%rowtype;j public.daily_recon_jobs%rowtype;
begin
 if coalesce(public.current_app_role(),'') not in ('lead','admin') or not coalesce(public.current_user_active(),false)
  or not coalesce(public.has_company_access(p_company),false) then raise exception 'เฉพาะหัวหน้า/ผู้ดูแลตามสิทธิ์บริษัท';end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 2000 or p_paused is null then raise exception 'กรุณาระบุเหตุผล';end if;
 if not exists(select 1 from public.audit_companies where code=p_company and active) or p_date is null then raise exception 'บริษัท/วันที่ไม่ถูกต้อง';end if;
 perform pg_advisory_xact_lock(hashtext('audit-hold:'||p_company||':'||p_date));
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived for update;
 select * into h from public.audit_run_holds where company=p_company and business_date=p_date for update;
 if coalesce(h.revision,0) is distinct from p_expected_revision then raise exception 'สถานะพักงานเปลี่ยนแล้ว โหลดใหม่';end if;
 if not p_paused and exists(select 1 from public.audit_source_revisions where company=p_company and business_date=p_date)
 and not exists(select 1 from public.account_recheck_jobs q where q.company=p_company and q.business_date=p_date
  and q.status='confirmed' and q.mode='account' and q.account='ALL' and q.direction='all' and q.base_run_id=j.last_run_id
  and (public.account_recheck_snapshot(p_company,p_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(p_company,p_date)))=q.snapshot)
 then raise exception 'ไฟล์มีการแก้ไข ต้องให้หัวหน้า/ผู้ดูแลตรวจและยืนยันผลทุกบัญชีก่อนเปิดงาน';end if;
 insert into public.audit_run_holds(company,business_date,paused,reason,revision,updated_by)
 values(p_company,p_date,p_paused,trim(p_reason),coalesce(h.revision,0)+1,auth.uid())
 on conflict(company,business_date) do update set paused=excluded.paused,reason=excluded.reason,
 revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now() returning * into h;
 if p_paused then
  update public.account_recheck_jobs set status='failed',error='หยุดโดยหัวหน้า/ผู้ดูแล: '||trim(p_reason),
   revision=revision+1,updated_at=now() where company=p_company and business_date=p_date and status in ('queued','running');
 end if;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values(auth.uid()::text,case when p_paused then 'pause_reconciliation' else 'resume_reconciliation' end,
 'company_day',p_company||'|'||p_date,p_company,trim(p_reason),jsonb_build_object('revision',h.revision));
 return h;
end $$;

create function public.correct_audit_source(p_file_id uuid,p_expected_revision integer,p_name text,p_company text,p_date date,p_kind text,p_replacement_id uuid,p_excluded boolean,p_reason text)
returns public.audit_source_revisions language plpgsql security definer set search_path=public as $$
declare f public.source_files%rowtype;replacement public.source_files%rowtype;
 r public.audit_source_revisions%rowtype;old_date date;old_company text;rev integer;
begin
 if coalesce(public.current_app_role(),'') not in ('lead','admin') or not coalesce(public.current_user_active(),false)
 then raise exception 'เฉพาะหัวหน้า/ผู้ดูแล';end if;
 select * into f from public.source_files where id=p_file_id;
 if not found then raise exception 'ไม่พบไฟล์';end if;
 select * into r from public.audit_source_revisions where source_file_id=p_file_id order by revision desc limit 1;
 select coalesce(r.business_date,b.business_date),coalesce(r.company,f.company,b.company)
 into old_date,old_company from public.mail_batches b where b.id=f.batch_id;
 -- Same lock order as confirmation and worker claim: scope before source/job.
 perform 1 from public.daily_recon_jobs j where not j.is_archived
 and ((j.company=old_company and j.business_date=old_date) or (j.company=p_company and j.business_date=p_date))
 order by j.company,j.business_date for update;
 select * into f from public.source_files where id=p_file_id for update;
 select * into r from public.audit_source_revisions where source_file_id=p_file_id order by revision desc limit 1;
 rev:=coalesce(r.revision,1);
 if rev is distinct from p_expected_revision then raise exception 'เวอร์ชันไฟล์เปลี่ยนแล้ว โหลดใหม่';end if;
 if not coalesce(public.has_company_access(old_company),false) or not coalesce(public.has_company_access(p_company),false)
 then raise exception 'ไม่มีสิทธิ์บริษัทต้นทาง/ปลายทาง';end if;
 if not exists(select 1 from public.audit_companies where code=p_company and active) or p_date is null
 or p_kind not in ('bo_main','stm_pdf','pm_statement','doc_clarify','unknown')
 or length(trim(coalesce(p_reason,''))) not between 10 and 2000
 or length(trim(coalesce(p_name,''))) not between 1 and 255 or p_name~'[[:cntrl:]]' or position('/' in p_name)>0 or position(chr(92) in p_name)>0
 or p_excluded is null then raise exception 'ข้อมูลแก้ไขไม่ครบ';end if;
 if p_replacement_id is not null then
  select * into replacement from public.source_files where id=p_replacement_id;
  if not found or p_replacement_id=p_file_id or not coalesce(public.has_company_access(replacement.company),false)
  or coalesce(replacement.size_bytes,0)<=0 or replacement.storage_path is null then raise exception 'ฉบับแทนไม่ถูกต้อง';end if;
  if exists(select 1 from public.audit_source_revisions where source_file_id=p_replacement_id and replacement_file_id is not null)
  then raise exception 'ไม่อนุญาตฉบับแทนซ้อนกัน';end if;
 end if;
 -- Keep immutable source_files/Storage and append a metadata/selection revision.
 insert into public.audit_source_revisions(source_file_id,revision,effective_name,company,business_date,kind,replacement_file_id,excluded,original,reason,created_by)
 values(p_file_id,rev+1,trim(p_name),p_company,p_date,p_kind,p_replacement_id,p_excluded,to_jsonb(f),trim(p_reason),auth.uid()) returning * into r;
 -- Pause BOTH affected scopes. Do not queue, rerun or change prior results.
 insert into public.audit_run_holds(company,business_date,paused,reason,revision,updated_by)
 select distinct c,d,true,'พักหลังแก้ข้อมูลไฟล์: '||left(trim(p_reason),1500),1,auth.uid()
 from (values(old_company,old_date),(p_company,p_date)) scopes(c,d)
 on conflict(company,business_date) do update set paused=true,reason=excluded.reason,
 revision=audit_run_holds.revision+1,updated_by=excluded.updated_by,updated_at=now();
 update public.account_recheck_jobs set status='stale',error='ไฟล์ต้นทางมีเวอร์ชันใหม่ ต้องเลือกและตรวจใหม่',revision=revision+1,updated_at=now()
 where status in ('queued','running','ready') and ((company=old_company and business_date=old_date) or (company=p_company and business_date=p_date));
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values(auth.uid()::text,'source_revision_appended','source_file',f.id::text,p_company,trim(p_reason),
 jsonb_build_object('revision',r.revision,'old_company',old_company,'new_company',p_company,'original_preserved',true));
 return r;
end $$;

create function public.upload_audit_source_revision(p_file_id uuid,p_expected_revision integer,p_metadata jsonb,p_correction jsonb)
returns public.audit_source_revisions language plpgsql security definer set search_path=public as $$
declare f public.source_files%rowtype;new_id uuid:=(p_metadata->>'id')::uuid;path text:=p_metadata->>'storage_path';
 existing public.source_files%rowtype;saved public.audit_source_revisions%rowtype;object_size bigint;
begin
 if coalesce(public.current_app_role(),'') not in ('lead','admin') or not coalesce(public.current_user_active(),false)
 then raise exception 'เฉพาะหัวหน้า/ผู้ดูแล';end if;
 select * into f from public.source_files where id=p_file_id;
 if not found or not coalesce(public.has_company_access(f.company),false)
 or not coalesce(public.has_company_access(p_correction->>'company'),false) then raise exception 'ไม่มีสิทธิ์บริษัท';end if;
 if path not like 'manual-replacements/'||auth.uid()::text||'/'||new_id::text||'/%'
 or nullif(p_metadata->>'file_name','') is null
 or coalesce((p_metadata->>'size_bytes')::bigint,0) not between 1 and 52428800
 or coalesce(p_metadata->>'checksum','')!~'^[0-9a-f]{64}$'
 or not exists(select 1 from storage.objects where bucket_id='audit-files' and name=path
 and owner_id=auth.uid()::text and (metadata->>'size')::bigint=(p_metadata->>'size_bytes')::bigint)
 then raise exception 'ไม่พบไฟล์ฉบับแก้ไขที่อัปโหลดหรือข้อมูลไม่ครบ';end if;
 select * into existing from public.source_files where id=new_id;
 if found then
  if existing.storage_path is distinct from path or existing.checksum is distinct from p_metadata->>'checksum'
  or existing.file_name is distinct from p_metadata->>'file_name' or existing.size_bytes is distinct from (p_metadata->>'size_bytes')::bigint
  then raise exception 'รหัสไฟล์เดิมไม่ตรง ห้ามสร้างหรือเขียนทับ';end if;
  select * into saved from public.audit_source_revisions where source_file_id=p_file_id and replacement_file_id=new_id
   and created_by=auth.uid() and revision=p_expected_revision+1;
  if not found or saved.effective_name is distinct from p_correction->>'name'
   or saved.company is distinct from p_correction->>'company' or saved.business_date is distinct from (p_correction->>'date')::date
   or saved.kind is distinct from p_correction->>'kind' or saved.excluded is distinct from (p_correction->>'excluded')::boolean
   or saved.reason is distinct from trim(p_correction->>'reason') then raise exception 'คำขอฉบับแก้ไขเดิมไม่ตรง ต้องตรวจประวัติ';end if;
  return saved;
 end if;
 insert into public.source_files(id,batch_id,company,file_name,kind,storage_path,mime_type,size_bytes,checksum,parsed)
 values(new_id,f.batch_id,f.company,p_metadata->>'file_name',f.kind,path,p_metadata->>'mime_type',(p_metadata->>'size_bytes')::bigint,p_metadata->>'checksum',false);
 return public.correct_audit_source(p_file_id,p_expected_revision,p_correction->>'name',p_correction->>'company',
 (p_correction->>'date')::date,p_correction->>'kind',new_id,(p_correction->>'excluded')::boolean,p_correction->>'reason');
end $$;
revoke all on function public.upload_audit_source_revision(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.upload_audit_source_revision(uuid,integer,jsonb,jsonb) to authenticated;
create function public.effective_audit_source_files(p_company text,p_date date) returns jsonb
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
  'parse_error',case when r.id is not null then null else f.parse_error end,
  'parsed',case when r.id is null then f.parsed else false end,
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
create function public.audit_run_blocked(p_company text,p_date date) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.audit_run_holds where company=p_company and business_date=p_date and paused)
 or exists(select 1 from public.account_recheck_jobs where company=p_company and business_date=p_date and status in ('queued','running') and lease_expires_at>=now())
$$;
revoke all on function public.audit_run_blocked(text,date) from public,anon;
grant execute on function public.audit_run_blocked(text,date) to authenticated,service_role;
create function public.guard_automatic_run_write() returns trigger language plpgsql security definer set search_path=public as $$
begin
 -- Serialize pause with each commit point. Web reviewers do not use service_role.
 if coalesce(auth.role(),'')='service_role' then
  perform 1 from public.daily_recon_jobs where company=new.company and business_date=new.business_date and not is_archived for update;
  if public.audit_run_blocked(new.company,new.business_date) then raise exception 'พักงาน/ตรวจเฉพาะบัญชีอยู่ ไม่บันทึกผลอัตโนมัติ';end if;
 end if;return new;
end $$;
create trigger audit_hold_recon_write before insert or update on public.recon_runs for each row execute function public.guard_automatic_run_write();
create trigger audit_hold_case_write before insert or update on public.exceptions for each row execute function public.guard_automatic_run_write();
-- Fail closed if the deployed worker claim is not the reviewed shape.
do $$ declare definition text;needle text:='j.status=''queued''';begin
 definition:=pg_get_functiondef('public.claim_daily_recon_jobs(text,integer)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception 'Worker claim changed: review the live definition before install';end if;
 execute replace(definition,needle,needle||' and not public.audit_run_blocked(j.company,j.business_date)');
end $$;
create function public.effective_audit_source_batches(p_company text,p_date date) returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('business_date',d,'company',p_company,'source_files',files) order by d),'[]')
 from (select value->>'business_date' d,jsonb_agg(value) files from jsonb_array_elements(public.effective_audit_source_files(p_company,p_date))
 where not coalesce((value->>'excluded')::boolean,false) group by value->>'business_date') batches
$$;
revoke all on function public.effective_audit_source_batches(text,date) from public,anon;
grant execute on function public.effective_audit_source_batches(text,date) to authenticated,service_role;
revoke all on function public.set_audit_run_hold(text,date,boolean,text,integer),public.correct_audit_source(uuid,integer,text,text,date,text,uuid,boolean,text),public.effective_audit_source_files(text,date) from public,anon;
grant execute on function public.set_audit_run_hold(text,date,boolean,text,integer),public.correct_audit_source(uuid,integer,text,text,date,text,uuid,boolean,text),public.effective_audit_source_files(text,date) to authenticated;
grant execute on function public.effective_audit_source_files(text,date) to service_role;
create policy manual_source_revision_upload on storage.objects for insert to authenticated
with check(bucket_id='audit-files' and public.current_user_active() and public.current_app_role() in ('lead','admin')
 and name like 'manual-replacements/'||auth.uid()::text||'/%');
create function public.can_read_effective_audit_source(p_path text) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(public.current_user_active(),false) and exists(
 select 1 from public.audit_source_revisions r join public.source_files f on f.id=coalesce(r.replacement_file_id,r.source_file_id)
 where f.storage_path=p_path and public.has_company_access(r.company)
 and r.revision=(select max(v.revision) from public.audit_source_revisions v where v.source_file_id=r.source_file_id))
$$;
revoke all on function public.can_read_effective_audit_source(text) from public,anon;
grant execute on function public.can_read_effective_audit_source(text) to authenticated;
create policy manual_source_revision_read on storage.objects for select to authenticated
using(bucket_id='audit-files' and public.can_read_effective_audit_source(name));
notify pgrst,'reload schema';
commit;
