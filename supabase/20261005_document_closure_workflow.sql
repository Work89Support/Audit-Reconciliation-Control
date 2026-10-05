-- Two-stage document review and per-company SLA. Installation changes no old case.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.company_case_sla (
 company text primary key references public.audit_companies(code),
 document_days integer not null check(document_days between 1 and 365),
 updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table public.case_closure_requests (
 id uuid primary key,
 exception_id uuid not null references public.exceptions(id),
 company text not null, business_date date not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 outcome text not null check(outcome in ('no_loss','damage')),
 loss_amount numeric(16,2) not null,
 audit_reason text not null check(length(btrim(audit_reason)) between 10 and 2000),
 damage_category text check(damage_category in ('employee','backoffice','external','pm','game')),
 snapshot jsonb not null,
 requested_by uuid not null references auth.users(id), requested_at timestamptz not null default now(),
 decided_by uuid references auth.users(id), decided_at timestamptz, decision_note text,
 check((outcome='no_loss' and loss_amount=0) or (outcome='damage' and loss_amount>0 and damage_category is not null))
);
create unique index case_closure_one_pending on public.case_closure_requests(exception_id) where status='pending';
alter table public.exceptions add column case_closure_request_id uuid references public.case_closure_requests(id),
 add column document_due_at timestamptz;
alter table public.company_case_sla enable row level security;
alter table public.case_closure_requests enable row level security;
create policy company_case_sla_read on public.company_case_sla for select to authenticated
 using(public.current_user_active() and public.has_company_access(company));
create policy closure_request_read on public.case_closure_requests for select to authenticated
 using(public.current_user_active() and public.current_app_role() in ('monitor','lead','admin') and public.has_company_access(company));
revoke all on public.company_case_sla,public.case_closure_requests from public,anon,authenticated;
grant select on public.company_case_sla,public.case_closure_requests to authenticated;

create function public.save_company_case_sla(p_company text,p_days integer) returns public.company_case_sla
 language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.company_case_sla%rowtype;
begin
 if auth.uid() is null or not public.current_user_active() or public.current_app_role() not in ('lead','admin')
   or not public.has_company_access(p_company) then raise exception 'ไม่มีสิทธิ์ตั้ง SLA บริษัท' using errcode='42501'; end if;
 if p_days is null or p_days not between 1 and 365 then raise exception 'กำหนด SLA 1-365 วัน'; end if;
 insert into public.company_case_sla(company,document_days,updated_by) values(p_company,p_days,auth.uid())
 on conflict(company) do update set document_days=excluded.document_days,updated_by=auth.uid(),updated_at=now() returning * into s;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(auth.uid()::text,auth.uid(),'company_case_sla_update','company',p_company,'คำขอใหม่: '||p_days||' วัน; ไม่เปลี่ยนกำหนดเคสเก่า');
 return s;
end $$;

create function public.set_document_case_deadline() returns trigger
 language plpgsql security definer set search_path=public,pg_temp as $$
declare days integer;
begin
 if new.status='clarifying' and old.status is distinct from 'clarifying' and old.document_due_at is null then
  if public.case_has_stored_document(old.id) then raise exception 'มีเอกสารแล้ว ให้ Audit ตรวจและส่งหัวหน้า ไม่ส่งผู้ชี้แจงซ้ำ'; end if;
  select document_days into days from public.company_case_sla where company=new.company;
  new.requested_at:=coalesce(old.requested_at,now()); -- Caller cannot backdate a new request to bypass SLA.
  new.document_due_at:=new.requested_at+make_interval(days=>coalesce(days,15));
 elsif old.document_due_at is not null then
  new.document_due_at:=old.document_due_at; -- Resend/settings edits cannot reset the clock.
 else
  new.document_due_at:=null; -- Deadline is set only by the first real clarification request.
 end if;
 return new;
end $$;
create trigger exceptions_document_deadline before update on public.exceptions for each row execute function public.set_document_case_deadline();

create function public.case_has_stored_document(p_case uuid) returns boolean
 language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.case_evidence f join storage.objects o on o.bucket_id='audit-files' and o.name=f.storage_path
  where f.exception_id=p_case and f.size_bytes>0)
 or exists(select 1 from public.exceptions e join public.source_files f on f.id=e.clarification_file_id
  join storage.objects o on o.bucket_id='audit-files' and o.name=f.storage_path where e.id=p_case and f.kind='doc_clarify')
$$;
revoke all on function public.case_has_stored_document(uuid) from public,anon,authenticated;

create function public.submit_case_closure(p_id uuid,p_case uuid,p_outcome text,p_amount numeric,p_reason text,p_category text default null)
 returns public.case_closure_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype; q public.case_closure_requests%rowtype; has_document boolean;
begin
 if auth.uid() is null or not public.current_user_active() or public.current_app_role() not in ('monitor','lead','admin') then
  raise exception 'เฉพาะ Audit ส่งผลตรวจให้หัวหน้าได้' using errcode='42501'; end if;
 select * into e from public.exceptions where id=p_case for update;
 if not found or not public.has_company_access(e.company) then raise exception 'ไม่พบเคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,9));
 select * into q from public.case_closure_requests where id=p_id;
 if found then
  if q.requested_by=auth.uid() and q.exception_id=p_case and q.outcome=p_outcome and q.loss_amount=p_amount
    and q.audit_reason=btrim(p_reason) and q.damage_category is not distinct from p_category then return q; end if;
  raise exception 'รหัสคำขอถูกใช้แล้ว';
 end if;
 if e.status is null or e.status not in ('open','clarifying','answered') or e.manual_pair_id is not null or e.case_closure_request_id is not null
   or e.superseded_by_exception_id is not null then raise exception 'สถานะเคสเปลี่ยนหรือมีคำขออยู่แล้ว'; end if;
 if p_id is null or p_outcome is null or p_outcome not in ('no_loss','damage') or coalesce(length(btrim(p_reason)),0) not between 10 and 2000
  or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2) or p_amount<0 or p_amount>=100000000000000
  or (p_outcome='no_loss' and p_amount<>0) or (p_outcome='damage' and (p_amount<=0 or p_category is null or p_category not in ('employee','backoffice','external','pm','game')))
  then raise exception 'ระบุผลตรวจ ยอดเสียหายจริง และเหตุผลให้ถูกต้อง'; end if;
 has_document:=public.case_has_stored_document(e.id);
 if p_outcome='damage' and coalesce(e.currency,'THB')<>'THB' then raise exception 'รายการเงินต่างประเทศต้องตรวจยอดแปลงก่อน ไม่บันทึกเป็นบาทโดยอัตโนมัติ'; end if;
 if p_outcome='no_loss' and not has_document then raise exception 'ปิดแบบไม่เสียหายต้องมีเอกสารที่ผูกเคสอยู่ในคลังจริง'; end if;
 if p_outcome='damage' and not has_document and (e.requested_at is null or e.document_due_at is null or now()<e.document_due_at)
   then raise exception 'ยังไม่ครบ SLA เอกสาร หรือยังไม่ได้ส่งขอชี้แจง'; end if;
 if p_category='employee' and (coalesce(btrim(e.employee),'') in ('','-','ไม่ระบุ','รอยืนยันผู้เกี่ยวข้อง') or coalesce(btrim(e.shift),'') in ('','-','รอยืนยันกะ'))
   then raise exception 'ต้องยืนยันผู้เกี่ยวข้องและกะจริงก่อนระบุเป็นความเสียหายพนักงาน'; end if;
 insert into public.case_closure_requests(id,exception_id,company,business_date,outcome,loss_amount,audit_reason,damage_category,snapshot,requested_by)
 values(p_id,e.id,e.company,e.business_date,p_outcome,p_amount,btrim(p_reason),p_category,to_jsonb(e)||jsonb_build_object('stored_document_at_submit',has_document),auth.uid()) returning * into q;
 update public.exceptions set case_closure_request_id=q.id,status='answered',updated_at=now() where id=e.id;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(auth.uid()::text,auth.uid(),'case_closure_submit','case_closure_request',q.id::text,q.outcome||' / เสียหายเสนอ '||q.loss_amount||' / '||q.audit_reason);
 return q;
end $$;

create function public.decide_case_closure(p_id uuid,p_action text,p_note text default null)
 returns public.case_closure_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.case_closure_requests%rowtype; e public.exceptions%rowtype; note text; has_document boolean;
begin
 if auth.uid() is null or not public.current_user_active() or public.current_app_role() not in ('lead','admin') then
  raise exception 'เฉพาะหัวหน้า Audit อนุมัติปิดเคสได้' using errcode='42501'; end if;
 select * into q from public.case_closure_requests where id=p_id;
 if not found or not public.has_company_access(q.company) then raise exception 'ไม่พบคำขอหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;
 select * into e from public.exceptions where id=q.exception_id for update;
 select * into q from public.case_closure_requests where id=p_id for update;
 note:=coalesce(nullif(btrim(p_note),''),'หัวหน้าตรวจผล Audit และหลักฐาน อนุมัติปิดเคส');
 if p_action is null or p_action not in ('approve','reject') or length(note)>2000 or (p_action='reject' and coalesce(length(btrim(p_note)),0)<10) then
  raise exception 'เหตุผลอนุมัติไม่บังคับ แต่ส่งกลับต้องระบุอย่างน้อย 10 ตัวอักษร'; end if;
 if q.status<>'pending' then
  if q.decided_by=auth.uid() and q.decision_note=note and q.status=(case when p_action='approve' then 'approved' else 'rejected' end) then return q; end if;
  raise exception 'คำขอไม่ได้รออนุมัติ';
 end if;
 if e.status<>'answered' or e.case_closure_request_id is distinct from q.id or e.manual_pair_id is not null or e.superseded_by_exception_id is not null then
  raise exception 'สถานะเคสเปลี่ยน ต้องตรวจใหม่'; end if;
 if exists(select 1 from unnest(array['run_id','company','business_date','direction','account','currency','system_amount','bank_amount','bo_raw','stm_raw','clarification_file_id','document_due_at']) k
   where to_jsonb(e)->k is distinct from q.snapshot->k) then raise exception 'ต้นทางเปลี่ยนหลังส่งคำขอ ต้องตรวจใหม่'; end if;
 has_document:=public.case_has_stored_document(e.id);
 if q.requested_by=auth.uid() and (p_action<>'approve' or q.outcome<>'no_loss' or not has_document
   or e.system_amount is null or e.bank_amount is null or abs(e.system_amount-e.bank_amount)>5) then
  raise exception 'คำขอตัวเองต้องมีเอกสาร ยอดต่างไม่เกิน 5 บาท และปิดแบบไม่เสียหาย'; end if;
 if p_action='approve' then
  if q.outcome='no_loss' and not has_document then raise exception 'หลักฐานไม่อยู่ในคลังแล้ว'; end if;
  if q.outcome='damage' and not has_document and (e.document_due_at is null or now()<e.document_due_at) then raise exception 'ยังไม่ครบ SLA เอกสาร'; end if;
  if exists(select 1 from public.damages where exception_id=e.id) then raise exception 'มีทะเบียนความเสียหายเดิม ต้องตรวจแทนการบันทึกซ้ำ'; end if;
  if q.outcome='damage' then
   insert into public.damages(code,exception_id,business_date,company,employee,shift,occurred_at,amount,currency,fx_rate,amount_thb,cause,cycle,has_evidence,hr_status,finance_status)
   values('DMG-'||e.id,e.id,e.business_date,e.company,nullif(e.employee,'ไม่ระบุ'),e.shift,e.occurred_at::time,q.loss_amount,'THB',1,q.loss_amount,
     '[damage:v2:'||q.damage_category||'] '||q.audit_reason,
     case when extract(day from e.business_date)<=15 then 'C1' when extract(day from e.business_date)<=25 then 'C2' else 'C3' end,
     has_document,'ยังไม่ส่งบุคคล','รอปิดรอบ');
  end if;
 end if;
 update public.case_closure_requests set status=case when p_action='approve' then 'approved' else 'rejected' end,
  decided_by=auth.uid(),decided_at=now(),decision_note=note where id=q.id returning * into q;
 if p_action='approve' then
  update public.exceptions set status='closed',auto_closed=false,approved_by=auth.uid(),approved_at=now(),resolved_by=auth.uid()::text,resolved_at=now(),
   resolution_note='หัวหน้าอนุมัติ: '||case when q.outcome='no_loss' then 'ไม่มีความเสียหาย 0 บาท' else 'เสียหายจริง '||q.loss_amount||' บาท' end||' / '||q.audit_reason||' / '||note,updated_at=now() where id=e.id;
 else
  update public.exceptions set status=q.snapshot->>'status',case_closure_request_id=null,updated_at=now() where id=e.id;
 end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(auth.uid()::text,auth.uid(),'case_closure_'||p_action,'case_closure_request',q.id::text,q.outcome||' / เสียหาย '||q.loss_amount||' / '||note);
 return q;
end $$;

create function public.guard_case_closure_request() returns trigger
 language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.case_closure_requests%rowtype;
begin
 if old.case_closure_request_id is null and new.case_closure_request_id is null then return new; end if;
 select * into q from public.case_closure_requests where id=coalesce(old.case_closure_request_id,new.case_closure_request_id);
 if q.id is null or q.exception_id<>old.id then raise exception 'คำขอปิดไม่ตรงเคส'; end if;
 if old.case_closure_request_id is null and new.case_closure_request_id=q.id and q.status='pending' and q.requested_by=auth.uid() and new.status='answered' then return new; end if;
 if old.case_closure_request_id=q.id and q.decided_by=auth.uid() then
  if q.status='approved' and new.status='closed' and new.case_closure_request_id=q.id then return new; end if;
  if q.status='rejected' and new.status=q.snapshot->>'status' and new.case_closure_request_id is null then return new; end if;
 end if;
 if to_jsonb(new)-'updated_at'=to_jsonb(old)-'updated_at' then return new; end if;
 raise exception 'มีคำขอรอหัวหน้า ต้องอนุมัติ/ส่งกลับผ่านคำขอเดิม';
end $$;
create trigger exceptions_closure_request_guard before update on public.exceptions for each row execute function public.guard_case_closure_request();
revoke all on function public.set_document_case_deadline(),public.guard_case_closure_request() from public,anon,authenticated;
revoke all on function public.save_company_case_sla(text,integer),public.submit_case_closure(uuid,uuid,text,numeric,text,text),public.decide_case_closure(uuid,text,text) from public,anon;
grant execute on function public.save_company_case_sla(text,integer),public.submit_case_closure(uuid,uuid,text,numeric,text,text),public.decide_case_closure(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
