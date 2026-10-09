-- Manual visual evidence review. No OCR/parsed-row/amount-tolerance gate.
-- This migration creates a workflow only; it never closes existing cases.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.cross_day_image_reviews (
 id uuid primary key, exception_id uuid not null references public.exceptions(id),
 company text not null, stm_file_id uuid not null references public.source_files(id),
 source_page integer not null check(source_page between 1 and 10000),
 snapshot jsonb not null, bo_key text not null, reason text not null check(length(reason)<=2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 submitted_by uuid not null references auth.users(id), submitted_at timestamptz not null default now(),
 decided_by uuid references auth.users(id), decided_at timestamptz, decision_note text,
 check(decided_by is null or decided_by<>submitted_by)
);
create unique index cross_day_image_case_reserved on public.cross_day_image_reviews(exception_id) where status<>'rejected';
create unique index cross_day_image_bo_reserved on public.cross_day_image_reviews(bo_key) where status<>'rejected';
-- A page can contain several legitimate transactions of the same amount.
-- Reserve the BO case, not an invented machine-readable STM row identity.
-- The head reviewer must check that the visual transaction was not reused.
alter table public.exceptions add column cross_day_image_request_id uuid references public.cross_day_image_reviews(id);
alter table public.cross_day_image_reviews enable row level security;
create policy cross_day_image_read on public.cross_day_image_reviews for select to authenticated
 using(public.current_user_active() and public.has_company_access(company)
 and public.current_app_role() in ('monitor','audit_assistant','lead','admin'));
revoke all on public.cross_day_image_reviews from public,anon,authenticated;
grant select on public.cross_day_image_reviews to authenticated;
create function public.cross_day_image_bo_key(e public.exceptions) returns text
language sql immutable set search_path=public,pg_temp as $$
 select md5(jsonb_build_array(e.company,e.business_date,e.account,e.direction,e.currency,
 e.occurred_at,e.system_amount,e.bo_raw,e.customer_details#>'{source_rows,bo}')::text)
$$;

create function public.submit_cross_day_image_review(p_id uuid,p_case uuid,p_file uuid,p_page integer,p_reason text)
returns public.cross_day_image_reviews language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype; f public.source_files%rowtype;q public.cross_day_image_reviews%rowtype;object_tag text;reason text;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in('monitor','audit_assistant','lead','admin') then raise exception 'ไม่มีสิทธิ์ส่งตรวจภาพ' using errcode='42501';end if;
 if p_id is null or p_page is null or p_page not between 1 and 10000 or length(coalesce(p_reason,''))>2000 then raise exception 'เลือก BO ไฟล์ และเลขหน้าให้ถูกต้อง';end if;
 reason:=coalesce(nullif(btrim(p_reason),''),'ส่งหัวหน้าตรวจ BO กับภาพ STM ต้นฉบับ');
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,41));
 select * into q from public.cross_day_image_reviews where id=p_id;
 if found then
  if q.submitted_by=auth.uid() and q.exception_id=p_case and q.stm_file_id=p_file and q.source_page=p_page and q.reason=reason then return q;end if;
  raise exception 'รหัสคำขอเดิมไม่ตรงกับหลักฐานนี้';
 end if;
 perform 1 from public.daily_recon_jobs where company=(select company from public.exceptions where id=p_case) order by id for update;
 select * into strict e from public.exceptions where id=p_case for update;
 select * into strict f from public.source_files where id=p_file for share;
 if not public.has_company_access(e.company) or f.company is distinct from e.company then raise exception 'บริษัทหรือสิทธิ์ไม่ตรงกัน' using errcode='42501';end if;
 if e.ex_type<>'cross_day' or e.status<>'open' or e.superseded_by_exception_id is not null
 or e.manual_pair_id is not null or e.case_closure_request_id is not null or e.cross_day_request_id is not null
 or e.cross_day_image_request_id is not null or to_jsonb(e)->>'governance_request_id' is not null then raise exception 'เคสถูกดำเนินการแล้ว';end if;
 if not exists(select 1 from public.daily_recon_jobs j where j.company=e.company and not j.is_archived and j.last_run_id=e.run_id) then raise exception 'ผลรันเปลี่ยน กรุณาเปิดเคสล่าสุด';end if;
 if f.kind<>'stm_pdf' or f.storage_path is null or coalesce((to_jsonb(f)->>'is_archived')::boolean,false) then raise exception 'เลือกไฟล์ STM ต้นฉบับ';end if;
 select o.metadata->>'eTag' into object_tag from storage.objects o where o.bucket_id='audit-files' and o.name=f.storage_path;
 if object_tag is null then raise exception 'ยังยืนยันไฟล์ต้นฉบับในคลังไม่ได้';end if;
 insert into public.cross_day_image_reviews(id,exception_id,company,stm_file_id,source_page,snapshot,bo_key,reason,submitted_by)
 values(p_id,e.id,e.company,f.id,p_page,jsonb_build_object('bo',to_jsonb(e),'file',jsonb_build_object('id',f.id,'file_name',f.file_name,'storage_path',f.storage_path,'eTag',object_tag),'source_mode','image'),public.cross_day_image_bo_key(e),reason,auth.uid()) returning * into q;
 update public.exceptions set cross_day_image_request_id=q.id,status='pair_pending',updated_at=now() where id=e.id;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail) values(auth.uid()::text,auth.uid(),'cross_day_image_submit','cross_day_image_review',q.id::text,reason||' / หน้า '||p_page);
 return q;
end $$;

create function public.decide_cross_day_image_review(p_id uuid,p_action text,p_note text)
returns public.cross_day_image_reviews language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.cross_day_image_reviews%rowtype;e public.exceptions%rowtype;f public.source_files%rowtype;tag text;k text;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in('lead','admin') then raise exception 'เฉพาะหัวหน้าอนุมัติ' using errcode='42501';end if;
 select * into strict q from public.cross_day_image_reviews where id=p_id;
 if not public.has_company_access(q.company) or q.submitted_by=auth.uid() then raise exception 'ต้องให้หัวหน้าอีกบัญชีตรวจ' using errcode='42501';end if;
 if p_action is null or p_action not in('approve','reject') or coalesce(length(btrim(p_note)),0) not between 1 and 2000 then raise exception 'ระบุผลตรวจจากภาพ';end if;
 perform 1 from public.daily_recon_jobs where company=q.company order by id for update;
 select * into strict e from public.exceptions where id=q.exception_id for update;
 select * into strict f from public.source_files where id=q.stm_file_id for share;
 select * into strict q from public.cross_day_image_reviews where id=p_id for update;
 if q.status<>'pending' then
  if q.decided_by=auth.uid() and q.status=(case p_action when 'approve' then 'approved' else 'rejected' end) then return q;end if;
  raise exception 'คำขอไม่ได้รออนุมัติแล้ว';
 end if;
 if e.status<>'pair_pending' or e.cross_day_image_request_id is distinct from q.id or (p_action='approve' and e.superseded_by_exception_id is not null)
 or e.manual_pair_id is not null or e.case_closure_request_id is not null or e.cross_day_request_id is not null then raise exception 'สถานะเคสเปลี่ยน';end if;
 if p_action='approve' then
  if not exists(select 1 from public.daily_recon_jobs j where j.company=e.company and not j.is_archived and j.last_run_id=e.run_id) then raise exception 'ผลรันเปลี่ยน ต้องส่งกลับตรวจ';end if;
  foreach k in array array['run_id','company','business_date','occurred_at','direction','account','currency','system_amount','bo_raw','customer_details'] loop
   if to_jsonb(e)->k is distinct from q.snapshot->'bo'->k then raise exception 'BO ต้นทางเปลี่ยนหลังส่ง';end if;
  end loop;
  select o.metadata->>'eTag' into tag from storage.objects o where o.bucket_id='audit-files' and o.name=f.storage_path;
  if f.company is distinct from q.company or f.storage_path is distinct from q.snapshot#>>'{file,storage_path}' or tag is null or tag is distinct from q.snapshot#>>'{file,eTag}' then raise exception 'ไฟล์ต้นฉบับเปลี่ยนหรือหาย';end if;
 end if;
 update public.cross_day_image_reviews set status=case p_action when 'approve' then 'approved' else 'rejected' end,decided_by=auth.uid(),decided_at=now(),decision_note=btrim(p_note) where id=q.id returning * into q;
 if p_action='approve' then
  update public.exceptions set status='closed',auto_closed=false,approved_by=auth.uid(),approved_at=now(),resolved_by=auth.uid()::text,resolved_at=now(),closure_rule='head-cross-day-image-review',resolution_note='หัวหน้าตรวจภาพ STM หน้า '||q.source_page||': '||btrim(p_note),updated_at=now() where id=e.id;
 else
  update public.exceptions set status='open',cross_day_image_request_id=null,updated_at=now() where id=e.id;
 end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail) values(auth.uid()::text,auth.uid(),'cross_day_image_'||p_action,'cross_day_image_review',q.id::text,btrim(p_note));
 return q;
end $$;
-- Freeze reserved source data and require the recorded reviewer decision.
create function public.guard_cross_day_image_request() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.cross_day_image_reviews%rowtype;
begin
 if old.cross_day_image_request_id is null and new.cross_day_image_request_id is null then return new;end if;
 select * into q from public.cross_day_image_reviews where id=coalesce(old.cross_day_image_request_id,new.cross_day_image_request_id);
 if q.id is null or q.exception_id<>old.id then raise exception 'คำขอตรวจภาพไม่ตรงเคส';end if;
 if (to_jsonb(new)-array['cross_day_image_request_id','status','updated_at','approved_by','approved_at','resolved_by','resolved_at','auto_closed','closure_rule','resolution_note']) is distinct from
 (to_jsonb(old)-array['cross_day_image_request_id','status','updated_at','approved_by','approved_at','resolved_by','resolved_at','auto_closed','closure_rule','resolution_note']) then raise exception 'ต้นทางถูกจอง ห้ามเปลี่ยนระหว่างรอตรวจภาพ';end if;
 if old.cross_day_image_request_id is null and new.cross_day_image_request_id=q.id and old.status='open' and new.status='pair_pending' and q.status='pending' and q.submitted_by=auth.uid() then return new;end if;
 if q.decided_by=auth.uid() and public.current_app_role() in('lead','admin') then
  if q.status='approved' and old.status='pair_pending' and new.status='closed' and new.cross_day_image_request_id=q.id then return new;end if;
  if q.status='rejected' and new.status='open' and new.cross_day_image_request_id is null then return new;end if;
 end if;
 if to_jsonb(new)-'updated_at'=to_jsonb(old)-'updated_at' then return new;end if;
 raise exception 'ดำเนินการผ่านคำขอตรวจภาพเท่านั้น';
end $$;
create trigger exceptions_cross_day_image_guard before update on public.exceptions
 for each row execute function public.guard_cross_day_image_request();
create trigger cross_day_image_no_delete before delete on public.cross_day_image_reviews
 for each row execute function public.cross_day_request_no_delete();
revoke all on function public.guard_cross_day_image_request() from public,anon,authenticated;
-- Carry only an existing head decision across identical accepted reruns.
-- Never invent a native STM row or approve a changed transaction.
create function public.preserve_cross_day_image_reviews() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare c record;
begin
 if new.is_archived or new.last_run_id is null or new.last_run_id is not distinct from old.last_run_id then return new;end if;
 for c in
  select e.id new_id,o.id old_id,q.id review_id,o.approved_by,o.approved_at,o.resolved_by,o.resolved_at,o.resolution_note
  from public.exceptions e join public.cross_day_image_reviews q on q.bo_key=public.cross_day_image_bo_key(e) and q.status='approved'
  join public.exceptions o on o.id=q.exception_id and o.status='closed' and o.closure_rule='head-cross-day-image-review'
  join public.source_files f on f.id=q.stm_file_id and f.company=q.company
  join storage.objects obj on obj.bucket_id='audit-files' and obj.name=f.storage_path
  where e.run_id=new.last_run_id and e.company=new.company and e.business_date=new.business_date
   and e.ex_type='cross_day' and e.status='open' and e.superseded_by_exception_id is null
   and e.manual_pair_id is null and e.case_closure_request_id is null and e.cross_day_request_id is null and e.cross_day_image_request_id is null
   and to_jsonb(e)->>'governance_request_id' is null and e.run_id<>o.run_id
   and e.lifecycle_key is not null and e.lifecycle_key=o.lifecycle_key
   and e.bank_amount is not distinct from o.bank_amount and e.stm_raw is not distinct from o.stm_raw
   and e.customer_details#>'{source_rows,bo}' is not null
   and f.storage_path=q.snapshot#>>'{file,storage_path}' and obj.metadata->>'eTag'=q.snapshot#>>'{file,eTag}'
   and not coalesce((to_jsonb(f)->>'is_archived')::boolean,false)
   and 1=(select count(*) from public.exceptions z where z.run_id=e.run_id and z.superseded_by_exception_id is null and public.cross_day_image_bo_key(z)=q.bo_key)
  order by e.id
 loop
  update public.exceptions set status='closed',previous_exception_id=c.old_id,auto_closed=false,
   approved_by=c.approved_by,approved_at=c.approved_at,resolved_by=c.resolved_by,resolved_at=c.resolved_at,
   closure_rule='prior-head-cross-day-image-review',resolution_note=c.resolution_note,updated_at=now() where id=c.new_id and status='open';
  insert into public.audit_log(actor,action,entity,target,detail)
   values('system:cross-day-image-preservation','cross_day_image_preserved','exception',c.new_id::text,'คงผลหัวหน้าตรวจภาพเดิม / คำขอ '||c.review_id||' / เคสต้นทาง '||c.old_id);
 end loop;
 return new;
end $$;
create trigger daily_recon_jobs_image_preservation after update of last_run_id on public.daily_recon_jobs
 for each row execute function public.preserve_cross_day_image_reviews();
revoke all on function public.cross_day_image_bo_key(public.exceptions),public.preserve_cross_day_image_reviews() from public,anon,authenticated;
revoke all on function public.submit_cross_day_image_review(uuid,uuid,uuid,integer,text),public.decide_cross_day_image_review(uuid,text,text) from public,anon;
grant execute on function public.submit_cross_day_image_review(uuid,uuid,uuid,integer,text),public.decide_cross_day_image_review(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
