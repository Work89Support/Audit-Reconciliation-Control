-- Register an explicitly reviewed extra source. Installation changes no records.
begin;
set local lock_timeout='5s';
create or replace function public.add_audit_manual_source(p_company text,p_date date,p_kind text,p_metadata jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare fid uuid:=(p_metadata->>'id')::uuid; path text:=p_metadata->>'storage_path';
 f public.source_files%rowtype; j public.daily_recon_jobs%rowtype;
 r public.audit_source_revisions%rowtype; plan jsonb; duplicate_file jsonb; object_meta jsonb;
begin
 if not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'') not in ('lead','admin')
 or not coalesce(public.has_company_access(p_company),false)
 then raise exception 'เฉพาะหัวหน้า/Admin ในบริษัทที่มีสิทธิ์';end if;
 if p_date is null or p_kind is null or p_kind not in ('bo_main','stm_pdf','pm_statement')
 or length(trim(coalesce(p_reason,''))) not between 10 and 2000
 or length(trim(coalesce(p_metadata->>'file_name',''))) not between 1 and 255
 or (p_metadata->>'file_name')~'[[:cntrl:]/]' or position(chr(92) in p_metadata->>'file_name')>0
 or coalesce((p_metadata->>'size_bytes')::bigint,0) not between 1 and 52428800
 or coalesce(p_metadata->>'checksum','')!~'^[0-9a-f]{64}$'
 or fid is null or path is null or path not like 'manual-replacements/'||auth.uid()::text||'/'||fid::text||'/%'
 then raise exception 'ข้อมูลไฟล์/บริษัท/วันที่/เหตุผลไม่ครบ';end if;
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived for update;
 if not found then raise exception 'ยังไม่มีรอบบริษัท/วันที่นี้ กรุณาตรวจรอบรับไฟล์';end if;
 perform pg_advisory_xact_lock(hashtext('manual-source:'||p_company||':'||p_date));
 select * into f from public.source_files where id=fid;
 if found then
  select * into r from public.audit_source_revisions where source_file_id=f.id order by revision desc limit 1;
  if f.storage_path is distinct from path or f.checksum is distinct from p_metadata->>'checksum'
  or f.file_name is distinct from p_metadata->>'file_name' or f.size_bytes is distinct from (p_metadata->>'size_bytes')::bigint
  or r.company is distinct from p_company or r.business_date is distinct from p_date or r.kind is distinct from p_kind
  or r.created_by is distinct from auth.uid() or r.reason is distinct from trim(p_reason)
  then raise exception 'คำขอเพิ่มไฟล์เดิมไม่ตรง ต้องตรวจประวัติ';end if;
  return jsonb_build_object('source_file_id',f.id,'reused',true,'revision',r.revision);
 end if;
 if j.status='running' or exists(select 1 from public.account_recheck_jobs where company=p_company and business_date=p_date and status in ('queued','running'))
 then raise exception 'มีงานกำลังใช้ชุดไฟล์นี้ รอให้จบก่อนเพิ่มไฟล์';end if;
 select metadata into object_meta from storage.objects where bucket_id='audit-files' and name=path and owner_id=auth.uid()::text;
 if object_meta is null or (object_meta->>'size')::bigint is distinct from (p_metadata->>'size_bytes')::bigint
 then raise exception 'ไม่พบไฟล์อัปโหลดของผู้ใช้หรือขนาดไม่ตรง';end if;
 plan:=public.effective_audit_source_files(p_company,p_date);
 select x into duplicate_file from jsonb_array_elements(plan) x
 where not (x->>'excluded')::boolean and x->>'business_date'=p_date::text and x->>'kind'=p_kind
 and (x->>'checksum'=p_metadata->>'checksum'
 or (nullif(trim(both '"' from x->>'storage_object_etag'),'') is not null
 and trim(both '"' from x->>'storage_object_etag')=trim(both '"' from object_meta->>'eTag')
 and (x->>'storage_size_bytes')::bigint=(object_meta->>'size')::bigint)) limit 1;
 if duplicate_file is not null then return jsonb_build_object('source_file_id',duplicate_file->>'id','reused',true,'duplicate',true);end if;
 -- A separate manual receipt does not pretend the file was attached to an old email.
 insert into public.mail_batches(id,gmail_message_id,subject,sender,received_at,company,business_date,is_supplement,file_count,status,note)
 values(fid,'manual-source:'||fid::text,'[MANUAL] '||p_company||' | '||p_date::text||' | เพิ่มไฟล์โดยผู้ใช้','manual upload',now(),p_company,p_date,true,1,'stored',trim(p_reason));
 insert into public.source_files(id,batch_id,company,file_name,kind,storage_path,mime_type,size_bytes,checksum,parsed)
 values(fid,fid,p_company,p_metadata->>'file_name',p_kind,path,p_metadata->>'mime_type',(p_metadata->>'size_bytes')::bigint,p_metadata->>'checksum',false);
 r:=public.correct_audit_source(fid,1,p_metadata->>'file_name',p_company,p_date,p_kind,null,false,trim(p_reason));
 return jsonb_build_object('source_file_id',fid,'reused',false,'revision',r.revision);
end $$;
revoke all on function public.add_audit_manual_source(text,date,text,jsonb,text) from public,anon;
grant execute on function public.add_audit_manual_source(text,date,text,jsonb,text) to authenticated;
commit;
