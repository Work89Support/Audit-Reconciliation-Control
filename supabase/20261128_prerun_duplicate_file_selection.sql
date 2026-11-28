-- File selection only: never changes accepted results, case state or evidence.
begin;
set local lock_timeout='5s';
alter table public.audit_source_revisions add column if not exists pre_run_duplicate boolean not null default false;
alter table public.audit_source_revisions add column if not exists duplicate_of uuid references public.source_files(id);

-- A claim/attempt, any result, manual review or case makes this ineligible.
-- Correction and exclusion RPCs take the same job-row lock as worker claim.
create or replace function public.audit_scope_not_started(p_company text,p_date date)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.daily_recon_jobs j
 where j.company=p_company and j.business_date=p_date and not j.is_archived
 and (j.status in ('waiting_files','ready','queued') or (j.status='needs_review' and exists(
 select 1 from public.audit_run_holds h where h.company=j.company and h.business_date=j.business_date
 and h.paused and h.reason like 'พักหลังแก้ข้อมูลไฟล์:%'))) and j.last_run_id is null
 and coalesce(j.attempt_count,0)=0
 and nullif(to_jsonb(j)->>'claimed_at','') is null and nullif(to_jsonb(j)->>'claimed_by','') is null)
 and not exists(select 1 from public.recon_runs where company=p_company and business_date=p_date)
 and not exists(select 1 from public.manual_primary_results where company=p_company and business_date=p_date)
 and not exists(select 1 from public.account_recheck_jobs where company=p_company and business_date=p_date)
 and not exists(select 1 from public.exceptions where company=p_company and business_date=p_date)
 and not exists(select 1 from public.audit_run_preflight_drafts where company=p_company and business_date=p_date)
$$;

-- Byte identity comes from trusted Storage metadata, never filename/time alone.
create or replace function public.audit_duplicate_source_keeper(p_file_id uuid)
returns uuid language sql stable security definer set search_path=public,storage as $$
 select k.id from public.source_files f join public.mail_batches b on b.id=f.batch_id
 join storage.objects o on o.bucket_id='audit-files' and o.name=f.storage_path
 join public.source_files k on k.id<>f.id and k.kind=f.kind and k.size_bytes=f.size_bytes
 join public.mail_batches kb on kb.id=k.batch_id
 join storage.objects ko on ko.bucket_id='audit-files' and ko.name=k.storage_path
 left join lateral(select * from public.audit_source_revisions where source_file_id=k.id order by revision desc limit 1) kr on true
 where f.id=p_file_id and f.kind in ('bo_main','stm_pdf','pm_statement') and f.size_bytes>0
 and coalesce(kr.company,k.company,kb.company)=coalesce(f.company,b.company)
 and coalesce(kr.business_date,kb.business_date)=b.business_date
 and coalesce(kr.kind,k.kind)=f.kind and not coalesce(kr.excluded,false) and kr.replacement_file_id is null
 and not exists(select 1 from public.audit_source_revisions parent where parent.replacement_file_id=k.id)
 and nullif(o.metadata->>'eTag','') is not null and o.metadata->>'eTag'=ko.metadata->>'eTag'
 and (o.metadata->>'size')::bigint>0 and o.metadata->>'size'=ko.metadata->>'size'
 order by k.created_at,k.id limit 1
$$;

create or replace function public.classify_pre_run_duplicate_revision()
returns trigger language plpgsql security definer set search_path=public as $$
declare f public.source_files; b public.mail_batches; previous public.audit_source_revisions; keeper uuid;
begin
 -- These fields are server-owned; a caller may never assert eligibility.
 new.pre_run_duplicate:=false; new.duplicate_of:=null;
 select * into f from public.source_files where id=new.source_file_id;
 select * into b from public.mail_batches where id=f.batch_id;
 select * into previous from public.audit_source_revisions where source_file_id=f.id order by revision desc limit 1;
 if new.company=coalesce(f.company,b.company) and new.business_date=b.business_date
 and new.effective_name=f.file_name and new.replacement_file_id is null
 and (previous.id is null or previous.pre_run_duplicate)
 and ((new.kind='doc_clarify' and not new.excluded) or (new.kind=f.kind and new.excluded))
 and public.audit_scope_not_started(new.company,new.business_date) then
  keeper:=public.audit_duplicate_source_keeper(f.id);
  if keeper is not null then new.pre_run_duplicate:=true;new.duplicate_of:=keeper;end if;
 end if;
 return new;
end $$;
drop trigger if exists classify_pre_run_duplicate_revision on public.audit_source_revisions;
create trigger classify_pre_run_duplicate_revision before insert on public.audit_source_revisions
for each row execute function public.classify_pre_run_duplicate_revision();

create or replace function public.audit_source_scope_managed(p_company text,p_date date) returns boolean
language sql stable security definer set search_path=public as $$
 with latest_revision as (
 select r.*,row_number() over(partition by r.source_file_id order by r.revision desc,r.created_at desc,r.id desc) revision_rank
 from public.audit_source_revisions r)
 select exists(select 1 from latest_revision r
 join public.source_files f on f.id=r.source_file_id join public.mail_batches b on b.id=f.batch_id
 where r.revision_rank=1 and not coalesce(r.excluded,false) and not r.pre_run_duplicate
 and ((r.company=p_company and r.business_date=p_date)
 or (coalesce(f.company,b.company)=p_company and b.business_date=p_date)))
$$;
create or replace function public.correct_audit_source(p_file_id uuid,p_expected_revision integer,p_name text,p_company text,p_date date,p_kind text,p_replacement_id uuid,p_excluded boolean,p_reason text)
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
 -- Only a verified duplicate removed before any work began can stay in the normal queue.
 if not r.pre_run_duplicate then
 -- Pause BOTH affected scopes. Do not queue, rerun or change prior results.
 insert into public.audit_run_holds(company,business_date,paused,reason,revision,updated_by)
 select distinct c,d,true,'พักหลังแก้ข้อมูลไฟล์: '||left(trim(p_reason),1500),1,auth.uid()
 from (values(old_company,old_date),(p_company,p_date)) scopes(c,d)
 on conflict(company,business_date) do update set paused=true,reason=excluded.reason,
 revision=audit_run_holds.revision+1,updated_by=excluded.updated_by,updated_at=now();
 update public.account_recheck_jobs set status='stale',error='ไฟล์ต้นทางมีเวอร์ชันใหม่ ต้องเลือกและตรวจใหม่',revision=revision+1,updated_at=now()
 where status in ('queued','running','ready') and ((company=old_company and business_date=old_date) or (company=p_company and business_date=p_date));
 end if;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values(auth.uid()::text,'source_revision_appended','source_file',f.id::text,p_company,trim(p_reason),
 jsonb_build_object('revision',r.revision,'old_company',old_company,'new_company',p_company,'original_preserved',true));
 return r;
end $$;


-- A quarantined duplicate is not an unread input that should requeue a completed day.
do $patch$ declare d text;n text;begin
 d:=pg_get_functiondef('public.audit_source_file_effectively_parsed(uuid)'::regprocedure);
 if position('pre_run_duplicate' in d)=0 then
  n:=replace(d,'select coalesce(source_file.parsed, false)',
   'select exists(select 1 from public.audit_source_revisions v where v.source_file_id=source_file.id and v.pre_run_duplicate and (v.excluded or v.kind=''doc_clarify'') and v.revision=(select max(revision) from public.audit_source_revisions where source_file_id=source_file.id)) or coalesce(source_file.parsed, false)');
  if n=d then raise exception 'Unexpected effective parse helper; review before applying';end if;
  execute n;
 end if;
end $patch$;

-- Both screens use exactly the effective company, date, type and file version.
-- Original mail labels remain available for diagnosis, but do not hide a file.
create or replace function public.audit_source_inbox_batches(p_from date,p_to date,p_company text default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not coalesce(public.current_user_active(),false) or p_from is null or p_to is null or p_to<p_from
 then raise exception 'ขอบเขตวันที่ไม่ถูกต้อง';end if;
 if p_company is not null and p_company<>'ALL' and not coalesce(public.has_company_access(p_company),false)
 then raise exception 'ไม่มีสิทธิ์บริษัท';end if;
 return (with scopes as materialized (
 select distinct coalesce(r.company,f.company,b.company) company,coalesce(r.business_date,b.business_date) business_date
 from public.source_files f join public.mail_batches b on b.id=f.batch_id
 left join lateral(select * from public.audit_source_revisions where source_file_id=f.id order by revision desc limit 1) r on true
 where coalesce(r.business_date,b.business_date) between p_from and p_to
 and (p_company is null or p_company='ALL' or coalesce(r.company,f.company,b.company)=p_company)
 and public.has_company_access(coalesce(r.company,f.company,b.company))
 and public.has_company_access(coalesce(f.company,b.company))
 ), files as materialized (
 select s.company,s.business_date,f from scopes s
 cross join lateral jsonb_array_elements(public.effective_audit_source_files(s.company,s.business_date)) f
 where (f->>'business_date')::date=s.business_date
 ), batches as (
 select b.id, s.company,s.business_date,b.received_at,
 to_jsonb(b)||jsonb_build_object('company',s.company,'business_date',s.business_date,'original_company',b.company,
 'source_files',jsonb_agg(s.f||jsonb_build_object('reference_company',s.company,'reference_date',s.business_date) order by s.f->>'created_at',s.f->>'id')) payload
 from files s join public.mail_batches b on b.id=(s.f->>'batch_id')::uuid
 group by b.id,s.company,s.business_date
 ) select coalesce(jsonb_agg(payload order by received_at desc,id),'[]') from batches);
end $$;
revoke all on function public.audit_scope_not_started(text,date),public.audit_duplicate_source_keeper(uuid),public.classify_pre_run_duplicate_revision() from public,anon,authenticated;
revoke all on function public.audit_source_inbox_batches(date,date,text) from public,anon;
grant execute on function public.audit_source_inbox_batches(date,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
