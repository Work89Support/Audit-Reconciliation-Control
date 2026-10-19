-- Metadata-only exclusion. Installation does not exclude any real file.
begin;
create or replace function public.audit_source_exclusion_states(p_ids uuid[]) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
begin
 if not coalesce(public.current_user_active(),false) or cardinality(p_ids)>500 then raise exception 'ขอบเขตไฟล์ไม่ถูกต้อง';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'excluded',coalesce(r.excluded,false),
 'reference_date',coalesce(r.business_date,b.business_date),'reference_company',coalesce(r.company,f.company,b.company))), '[]')
 from public.source_files f join public.mail_batches b on b.id=f.batch_id
 left join lateral(select * from public.audit_source_revisions where source_file_id=f.id order by revision desc limit 1)r on true
 where f.id=any(p_ids));
end $$;

create or replace function public.audit_source_exclusion_preview(p_file_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare f public.source_files%rowtype;r public.audit_source_revisions%rowtype;c text;d date;physical uuid;used boolean;busy boolean;raw_date date;
begin
 if not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'') not in ('lead','admin') then raise exception 'เฉพาะหัวหน้า/ผู้ดูแล';end if;
 select * into f from public.source_files where id=p_file_id;
 if not found then raise exception 'ไม่พบไฟล์';end if;
 select * into r from public.audit_source_revisions where source_file_id=f.id order by revision desc limit 1;
 select coalesce(r.company,f.company,b.company),coalesce(r.business_date,b.business_date),b.business_date into c,d,raw_date from public.mail_batches b where b.id=f.batch_id;
 if c is null or d is null or not coalesce(public.has_company_access(c),false) or not coalesce(public.has_company_access(f.company),false) then raise exception 'ไม่มีสิทธิ์บริษัท';end if;
 physical:=coalesce(r.replacement_file_id,f.id);
 -- Preserve all accepted manual versions and current automatic results.
 select exists(select 1 from public.manual_primary_results p where p.company=c and exists(
 select 1 from jsonb_array_elements(p.source_stamp) s where s->>'id' in(f.id::text,physical::text)
 or s->>'physical' in(f.id::text,physical::text)))
 or exists(select 1 from public.daily_recon_jobs j join public.recon_runs rr on rr.id=j.last_run_id
 where j.company=c and not j.is_archived and (
 coalesce(to_jsonb(rr.file_ids),'[]') ?| array[f.id::text,physical::text]
 or (rr.file_ids is null and j.business_date in(d-1,d,raw_date)))) into used;
 select exists(select 1 from public.daily_recon_jobs j where j.company=c and not j.is_archived and j.business_date in(d-1,d,raw_date) and j.status='running')
 or exists(select 1 from public.account_recheck_jobs q where q.company=c and q.business_date in(d-1,d,raw_date) and q.status in('queued','running')) into busy;
 return jsonb_build_object('id',f.id,'name',coalesce(r.effective_name,f.file_name),'company',c,'date',d,'raw_date',raw_date,
 'kind',coalesce(r.kind,f.kind),'revision',coalesce(r.revision,1),'replacement_id',r.replacement_file_id,'excluded',coalesce(r.excluded,false),
 'blocked',used or busy or coalesce(r.kind,f.kind) not in('bo_main','stm_pdf','pm_statement','doc_clarify','unknown'),
 'message',case when coalesce(r.kind,f.kind) not in('bo_main','stm_pdf','pm_statement','doc_clarify','unknown') then 'ไฟล์เสริมชนิดนี้ยังไม่รองรับการยกเว้น ห้ามเปลี่ยนชนิดเพื่อข้ามข้อจำกัด' when used then 'ไฟล์ถูกใช้ในผลหลักแล้ว ไม่อนุญาตให้ยกเว้นหรือคืนย้อนหลังจากปุ่มนี้' when busy then 'มีงานกำลังใช้ไฟล์ในรอบนี้ รอจบงานก่อน' else 'เปลี่ยนเฉพาะการเลือกใช้ไฟล์ เก็บต้นฉบับและประวัติ ไม่รัน ไม่เปลี่ยนผลหลัก ยอดหรือเคส' end);
end $$;

create or replace function public.set_audit_source_excluded(p_file_id uuid,p_expected_revision integer,p_excluded boolean,p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v jsonb;rev public.audit_source_revisions%rowtype;
begin
 v:=public.audit_source_exclusion_preview(p_file_id);
 -- Match worker/acceptance lock order. Adjacent-day sources can feed yesterday.
 perform 1 from public.daily_recon_jobs j where j.company=v->>'company' and not j.is_archived
 and j.business_date in((v->>'date')::date-1,(v->>'date')::date,(v->>'raw_date')::date) order by j.business_date,j.id for update;
 perform 1 from public.source_files where id=p_file_id for update;
 v:=public.audit_source_exclusion_preview(p_file_id);
 if (v->>'revision')::integer is distinct from p_expected_revision then raise exception 'เวอร์ชันไฟล์เปลี่ยนแล้ว กรุณาโหลดใหม่';end if;
 if p_excluded is null or length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'ระบุเหตุผลอย่างน้อย 10 ตัวอักษร';end if;
 if (v->>'blocked')::boolean then raise exception '%',v->>'message';end if;
 if (v->>'excluded')::boolean=p_excluded then return v;end if;
 insert into public.audit_source_revisions(source_file_id,revision,effective_name,company,business_date,kind,replacement_file_id,excluded,original,reason,created_by)
 select f.id,p_expected_revision+1,v->>'name',v->>'company',(v->>'date')::date,v->>'kind',nullif(v->>'replacement_id','')::uuid,p_excluded,to_jsonb(f),trim(p_reason),auth.uid()
 from public.source_files f where f.id=p_file_id returning * into rev;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values(auth.uid()::text,case when p_excluded then 'source_file_excluded' else 'source_file_restored' end,'source_file',p_file_id::text,v->>'company',trim(p_reason),
 jsonb_build_object('revision',rev.revision,'excluded',p_excluded,'original_preserved',true,'run_requested',false));
 -- Existing managed-source guard stops automatic writes; no job/hold is changed.
 return public.audit_source_exclusion_preview(p_file_id);
end $$;
-- Enforce the same primary/busy guard if the older metadata editor is used.
create or replace function public.guard_audit_source_exclusion_revision() returns trigger
language plpgsql security definer set search_path=public as $$
declare previous_excluded boolean;v jsonb;
begin
 select excluded into previous_excluded from public.audit_source_revisions where source_file_id=new.source_file_id order by revision desc limit 1;
 if new.excluded is distinct from coalesce(previous_excluded,false) then
  v:=public.audit_source_exclusion_preview(new.source_file_id);
  if (v->>'blocked')::boolean then raise exception '%',v->>'message';end if;
 end if;
 return new;
end $$;
drop trigger if exists audit_source_exclusion_guard on public.audit_source_revisions;
create trigger audit_source_exclusion_guard before insert on public.audit_source_revisions for each row execute function public.guard_audit_source_exclusion_revision();
revoke all on function public.guard_audit_source_exclusion_revision() from public,anon,authenticated;
revoke all on function public.audit_source_exclusion_states(uuid[]),public.audit_source_exclusion_preview(uuid),public.set_audit_source_excluded(uuid,integer,boolean,text) from public,anon;
grant execute on function public.audit_source_exclusion_states(uuid[]),public.audit_source_exclusion_preview(uuid),public.set_audit_source_excluded(uuid,integer,boolean,text) to authenticated;
commit;
