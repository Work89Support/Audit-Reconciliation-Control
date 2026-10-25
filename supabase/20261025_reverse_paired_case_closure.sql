-- Allow a lead/admin to reverse an incorrectly approved manual pair without
-- deleting its pair, case, evidence, damage, receipt, or audit history.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.manual_case_pairs add column if not exists reversed_at timestamptz;
alter table public.manual_case_pairs add column if not exists reversed_by uuid references auth.users(id);
alter table public.manual_case_pairs add column if not exists reversal_reason text;
alter table public.damage_closure_reversals add column if not exists manual_pair_id uuid references public.manual_case_pairs(id);
alter table public.damage_closure_reversals add column if not exists previous_pair jsonb;

do $patch$
declare def text; needle text;
begin
 def:=pg_get_functiondef('public.guard_manual_pair_case()'::regprocedure);
 needle:='begin
 if old.manual_pair_id is null and new.manual_pair_id is null then return new; end if;';
 if strpos(def,'audit.manual_pair_reversal')=0 then
  if strpos(def,needle)=0 then raise exception 'Unexpected manual pair guard baseline'; end if;
  execute replace(def,needle,'begin
 if current_setting(''audit.manual_pair_reversal'',true)=''on''
  and public.current_user_active() and public.current_app_role() in (''lead'',''admin'')
  and old.status in (''closed'',''damage'') and new.status in (''open'',''answered'',''clarifying'')
  and old.manual_pair_id is not null and new.manual_pair_id is null then return new; end if;
 if old.manual_pair_id is null and new.manual_pair_id is null then return new; end if;');
 end if;
end $patch$;

create or replace function public.reverse_wrong_case_closure(
 p_id uuid,p_case uuid,p_previous_status text,p_action text,p_reason text
) returns public.exceptions language plpgsql security definer set search_path=public,pg_temp as $$
declare
 e public.exceptions%rowtype; d public.damages%rowtype; saved public.damage_closure_reversals%rowtype;
 pair_row public.manual_case_pairs%rowtype; target_status text; prior_status text;
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
 if e.manual_pair_id is not null then
  select * into pair_row from public.manual_case_pairs where id=e.manual_pair_id for update;
  if not found or pair_row.status<>'approved' or e.id not in(pair_row.bo_case_id,pair_row.stm_case_id)
  then raise exception 'คู่เคสไม่ใช่ผลอนุมัติปัจจุบัน กรุณาโหลดใหม่'; end if;
  perform 1 from public.exceptions where id in(pair_row.bo_case_id,pair_row.stm_case_id) order by id for update;
 end if;
 select * into d from public.damages where exception_id=e.id and voided_at is null for update;
 if exists(
  select 1 from public.damage_receipts r join public.damages x on x.id=r.damage_id
  where r.voided_at is null and x.voided_at is null
    and x.exception_id in(e.id,pair_row.bo_case_id,pair_row.stm_case_id)
 ) then raise exception 'มีรายการรับโอนคืนที่ยังไม่ยกเลิก ต้องตรวจและยกเลิกรายการรับคืนก่อนย้อนเคส'; end if;
 insert into public.damage_closure_reversals(id,exception_id,damage_id,closure_request_id,company,action,reason,
  previous_case,previous_damage,reversed_by,manual_pair_id,previous_pair)
 values(p_id,e.id,d.id,e.case_closure_request_id,e.company,p_action,btrim(p_reason),to_jsonb(e),
  case when d.id is null then null else to_jsonb(d) end,auth.uid(),pair_row.id,
  case when pair_row.id is null then null else to_jsonb(pair_row) end) returning * into saved;
 update public.damages set voided_at=now(),voided_by=auth.uid(),void_reason=btrim(p_reason)
 where voided_at is null and exception_id in(e.id,pair_row.bo_case_id,pair_row.stm_case_id);
 target_status:=case when p_action='return_clarification' then 'clarifying' else 'answered' end;
 perform set_config('audit.damage_reversal','on',true);
 if pair_row.id is not null then
  perform set_config('audit.manual_pair_reversal','on',true);
  update public.manual_case_pairs set reversed_at=now(),reversed_by=auth.uid(),reversal_reason=btrim(p_reason)
  where id=pair_row.id and reversed_at is null;
  update public.manual_pair_members set released_at=coalesce(released_at,now()) where pair_id=pair_row.id;
  update public.exceptions set
   status=case when id=e.id then target_status else
    case when id=pair_row.bo_case_id then coalesce(pair_row.snapshot->'bo'->>'status','open')
         else coalesce(pair_row.snapshot->'stm'->>'status','open') end end,
   manual_pair_id=null,case_closure_request_id=null,auto_closed=false,
   approved_by=null,approved_at=null,resolved_by=null,resolved_at=null,
   resolution_note='ยกเลิกผลปิดคู่โดยหัวหน้า/ผู้ดูแลระบบ: '||btrim(p_reason),updated_at=now()
  where id in(pair_row.bo_case_id,pair_row.stm_case_id);
  select * into e from public.exceptions where id=p_case;
 else
  update public.exceptions set status=target_status,case_closure_request_id=null,auto_closed=false,
   approved_by=null,approved_at=null,resolved_by=null,resolved_at=null,
   resolution_note='ยกเลิกผลปิดโดยหัวหน้า/ผู้ดูแลระบบ: '||btrim(p_reason),updated_at=now()
  where id=e.id returning * into e;
 end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta)
 values(auth.uid()::text,auth.uid(),case when p_action='return_clarification' then 'case_closure_return' else 'case_closure_reopen' end,
  'exception',e.id::text,btrim(p_reason),jsonb_build_object('reversal_id',p_id,'previous_status',p_previous_status,
   'target_status',target_status,'damage_id',d.id,'closure_request_id',saved.closure_request_id,
   'manual_pair_id',pair_row.id,'paired_case_reopened',pair_row.id is not null));
 return e;
end $$;

revoke all on function public.reverse_wrong_case_closure(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.reverse_wrong_case_closure(uuid,uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
