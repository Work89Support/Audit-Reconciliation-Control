-- Reopen an incorrectly closed case without deleting its evidence, approval,
-- damage, collection, receipt, or audit history. Installation changes no case.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.damages add column if not exists voided_at timestamptz;
alter table public.damages add column if not exists voided_by uuid references auth.users(id);
alter table public.damages add column if not exists void_reason text;

drop index if exists public.damages_one_per_exception_idx;
create unique index damages_one_per_exception_idx on public.damages(exception_id)
 where exception_id is not null and voided_at is null;

create table if not exists public.damage_closure_reversals (
 id uuid primary key,
 exception_id uuid not null references public.exceptions(id),
 damage_id uuid references public.damages(id),
 closure_request_id uuid references public.case_closure_requests(id),
 company text not null,
 action text not null check(action in ('reopen_audit','return_clarification')),
 reason text not null check(length(btrim(reason)) between 10 and 2000),
 previous_case jsonb not null,
 previous_damage jsonb,
 reversed_by uuid not null references auth.users(id),
 reversed_at timestamptz not null default now()
);
alter table public.damage_closure_reversals enable row level security;
drop policy if exists damage_closure_reversals_read on public.damage_closure_reversals;
create policy damage_closure_reversals_read on public.damage_closure_reversals for select to authenticated
 using(public.current_user_active() and public.current_app_role() in ('monitor','audit_assistant','lead','admin')
   and public.has_company_access(company));
revoke all on public.damage_closure_reversals from public,anon,authenticated;
grant select on public.damage_closure_reversals to authenticated;

-- The ordinary closure guard stays fail-closed. Only the audited RPC below
-- enables this transaction-local path for an already closed case.
do $patch$
declare def text; needle text;
begin
 def:=pg_get_functiondef('public.guard_case_closure_request()'::regprocedure);
 needle:='begin
 if old.case_closure_request_id is null and new.case_closure_request_id is null then return new; end if;';
 if strpos(def,'audit.damage_reversal')=0 then
  if strpos(def,needle)=0 then raise exception 'Unexpected closure guard baseline'; end if;
  execute replace(def,needle,'begin
 if current_setting(''audit.damage_reversal'',true)=''on''
  and public.current_user_active() and public.current_app_role() in (''lead'',''admin'')
  and old.status in (''closed'',''damage'') and new.status in (''answered'',''clarifying'')
  and new.case_closure_request_id is null then return new; end if;
 if old.case_closure_request_id is null and new.case_closure_request_id is null then return new; end if;');
 end if;
end $patch$;

create or replace function public.reverse_wrong_case_closure(
 p_id uuid,p_case uuid,p_previous_status text,p_action text,p_reason text
) returns public.exceptions language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype; d public.damages%rowtype; saved public.damage_closure_reversals%rowtype;
 target_status text;
begin
 if auth.uid() is null or not public.current_user_active() or public.current_app_role() not in ('lead','admin')
 then raise exception 'เฉพาะหัวหน้าออดิทหรือผู้ดูแลระบบเท่านั้น' using errcode='42501'; end if;
 if p_id is null or p_action not in ('reopen_audit','return_clarification')
  or coalesce(length(btrim(p_reason)),0) not between 10 and 2000
 then raise exception 'เลือกการตีกลับและระบุเหตุผล 10–2,000 ตัวอักษร'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,17));
 select * into saved from public.damage_closure_reversals where id=p_id;
 if found then
  if saved.exception_id<>p_case or saved.action<>p_action or saved.reason<>btrim(p_reason) or saved.reversed_by<>auth.uid()
  then raise exception 'รหัสคำขอย้อนเคสถูกใช้แล้ว'; end if;
  select * into e from public.exceptions where id=p_case;
  return e;
 end if;
 select * into e from public.exceptions where id=p_case for update;
 if not found or not public.has_company_access(e.company)
 then raise exception 'ไม่พบเคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;
 if e.status is distinct from p_previous_status or e.status not in ('closed','damage')
 then raise exception 'สถานะเคสเปลี่ยน กรุณาโหลดใหม่ก่อนยกเลิกผล'; end if;
 select * into d from public.damages where exception_id=e.id and voided_at is null for update;
 if found and exists(select 1 from public.damage_receipts r where r.damage_id=d.id and r.voided_at is null)
 then raise exception 'มีรายการรับโอนคืนที่ยังไม่ยกเลิก ต้องตรวจและยกเลิกรายการรับคืนก่อนย้อนเคส'; end if;
 insert into public.damage_closure_reversals(id,exception_id,damage_id,closure_request_id,company,action,reason,
  previous_case,previous_damage,reversed_by)
 values(p_id,e.id,d.id,e.case_closure_request_id,e.company,p_action,btrim(p_reason),to_jsonb(e),
  case when d.id is null then null else to_jsonb(d) end,auth.uid()) returning * into saved;
 if d.id is not null then
  update public.damages set voided_at=now(),voided_by=auth.uid(),void_reason=btrim(p_reason) where id=d.id and voided_at is null;
  if not found then raise exception 'ทะเบียนความเสียหายเปลี่ยน กรุณาโหลดใหม่'; end if;
 end if;
 target_status:=case when p_action='return_clarification' then 'clarifying' else 'answered' end;
 perform set_config('audit.damage_reversal','on',true);
 update public.exceptions set status=target_status,case_closure_request_id=null,auto_closed=false,
  approved_by=null,approved_at=null,resolved_by=null,resolved_at=null,
  resolution_note='ยกเลิกผลปิดโดยหัวหน้า/ผู้ดูแลระบบ: '||btrim(p_reason),updated_at=now()
 where id=e.id returning * into e;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta)
 values(auth.uid()::text,auth.uid(),case when p_action='return_clarification' then 'case_closure_return' else 'case_closure_reopen' end,
  'exception',e.id::text,btrim(p_reason),jsonb_build_object('reversal_id',p_id,'previous_status',p_previous_status,
   'target_status',target_status,'damage_id',d.id,'closure_request_id',saved.closure_request_id));
 return e;
end $$;
revoke all on function public.reverse_wrong_case_closure(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.reverse_wrong_case_closure(uuid,uuid,text,text,text) to authenticated;

-- Existing routines must treat a voided loss as history, not as the current
-- damage result. Patch the installed latest definitions in place so later
-- role/self-review safeguards remain intact.
do $patch$
declare def text; sig regprocedure;
begin
 foreach sig in array array[
  'public.confirm_damage(uuid,text,numeric,text)'::regprocedure,
  'public.confirm_damage_details(uuid,text,numeric,text,text,text,time without time zone)'::regprocedure
 ] loop
  def:=pg_get_functiondef(sig);
  if strpos(def,'voided_at is null')=0 then
   if strpos(def,'where exception_id=e.id;')=0 then raise exception 'Unexpected damage confirmation baseline: %',sig; end if;
   execute replace(def,'where exception_id=e.id;','where exception_id=e.id and voided_at is null;');
  end if;
 end loop;

 sig:='public.decide_case_closure(uuid,text,text)'::regprocedure;
 def:=pg_get_functiondef(sig);
 if strpos(def,'damages where exception_id=e.id and voided_at is null')=0 then
  if strpos(def,'damages where exception_id=e.id)')=0 then raise exception 'Unexpected closure decision baseline'; end if;
  execute replace(def,'damages where exception_id=e.id)','damages where exception_id=e.id and voided_at is null)');
 end if;

 sig:='public.audit_assistant_pair_ready(uuid,uuid,text)'::regprocedure;
 def:=pg_get_functiondef(sig);
 if strpos(def,'d.voided_at is null')=0 then
  if strpos(def,'d.exception_id in(a.id,b.id))')=0 then raise exception 'Unexpected pair readiness baseline'; end if;
  execute replace(def,'d.exception_id in(a.id,b.id))','d.exception_id in(a.id,b.id) and d.voided_at is null)');
 end if;

 sig:='public.approve_damage_collection(uuid,text,text,text,numeric,text)'::regprocedure;
 def:=pg_get_functiondef(sig);
 if strpos(def,'d.voided_at is not null')=0 then
  if strpos(def,'if not found or not public.has_company_access(d.company)')=0 then raise exception 'Unexpected collection baseline'; end if;
  execute replace(def,'if not found or not public.has_company_access(d.company)',
   'if not found or d.voided_at is not null or not public.has_company_access(d.company)');
 end if;

 sig:='public.confirm_damage_receipt(uuid,uuid,date,numeric,text,uuid,text)'::regprocedure;
 def:=pg_get_functiondef(sig);
 if strpos(def,'d.voided_at is not null')=0 then
  if strpos(def,'if d.company is distinct from c.company')=0 then raise exception 'Unexpected receipt baseline'; end if;
  execute replace(def,'if d.company is distinct from c.company','if d.voided_at is not null or d.company is distinct from c.company');
 end if;

 sig:='public.finance_case_report(text,date,date)'::regprocedure;
 def:=pg_get_functiondef(sig);
 if strpos(def,'voided_at is null')=0 then
  def:=replace(def,'from public.damages where company=p_company and business_date<=p_to',
   'from public.damages where company=p_company and business_date<=p_to and voided_at is null');
  def:=replace(def,'where d.company=p_company and d.business_date<=p_to;',
   'where d.company=p_company and d.business_date<=p_to and d.voided_at is null;');
  def:=replace(def,'join public.damages d on d.id=c.damage_id and d.company=c.company where',
   'join public.damages d on d.id=c.damage_id and d.company=c.company and d.voided_at is null where');
  def:=replace(def,'join public.damages d on d.id=r.damage_id and d.company=r.company
 where',
   'join public.damages d on d.id=r.damage_id and d.company=r.company and d.voided_at is null
 where');
  def:=replace(def,'not exists(select 1 from public.damages d where d.exception_id=e.id)',
   'not exists(select 1 from public.damages d where d.exception_id=e.id and d.voided_at is null)');
  execute def;
 end if;
end $patch$;

notify pgrst,'reload schema';
commit;
