-- Audited manual closure for verified UFABET7M transfers between company accounts.
-- This migration changes no existing case. It only adds a guarded action path.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $migration$
begin
 if exists(select 1 from pg_constraint where conrelid='public.manual_case_pairs'::regclass and conname='manual_case_pairs_mode_check') then
   alter table public.manual_case_pairs drop constraint manual_case_pairs_mode_check;
 end if;
end $migration$;
alter table public.manual_case_pairs add constraint manual_case_pairs_mode_check
 check(mode in ('same','cross','internal'));

alter table public.manual_case_pairs drop constraint if exists manual_pair_self_review_shape;
alter table public.manual_case_pairs add constraint manual_pair_self_review_shape
 check((not self_approved and (decided_by is null or decided_by<>submitted_by))
   or (self_approved and decided_by=submitted_by and status='approved'
     and mode in ('same','internal') and bo_company=stm_company and difference<=5));

create or replace function public.validate_7m_internal_transfer_pair(p_bo uuid,p_stm uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a public.exceptions%rowtype; b public.exceptions%rowtype; seconds_apart integer;
begin
 select * into a from public.exceptions where id=p_bo;
 select * into b from public.exceptions where id=p_stm;
 if a.id is null or b.id is null or a.id=b.id
   or not public.has_company_access(a.company) or not public.has_company_access(b.company)
 then raise exception 'ไม่พบคู่เคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;
 if upper(a.company) not in ('7M','UFABET7M') or upper(a.company)<>upper(b.company)
   or a.ex_type<>'missing_stm' or b.ex_type<>'missing_bo'
   or a.business_date is distinct from b.business_date
   or nullif(btrim(a.account),'') is null or nullif(btrim(b.account),'') is null or a.account=b.account
   or a.direction not in ('ฝาก','ถอน') or b.direction not in ('ฝาก','ถอน') or a.direction=b.direction
   or a.currency is distinct from 'THB' or b.currency is distinct from 'THB'
   or a.system_amount is null or a.system_amount<=0 or a.system_amount is distinct from b.bank_amount
   or a.occurred_at is null or b.occurred_at is null
   or coalesce(length(btrim(a.bo_raw)),0)<2 or coalesce(length(btrim(b.stm_raw)),0)<2
   or a.bo_raw !~* '(โยก(เงิน)?(เข้า|ออก)?|รับยอด|ย้ายเงิน|internal[[:space:]]*transfer)'
 then raise exception 'คู่โอนภายในต้องเป็น 7M คนละบัญชี ฝาก/ถอนสวนทาง ยอดตรง วันเดียวกัน และ BO ระบุโยกเงินหรือรับยอด'; end if;
 seconds_apart:=abs(extract(epoch from (a.occurred_at-b.occurred_at)))::integer;
 if seconds_apart>300 then raise exception 'เวลา BO กับ STM/PM ของคู่โอนภายในต้องห่างไม่เกิน 5 นาที'; end if;
 if a.superseded_by_exception_id is not null or b.superseded_by_exception_id is not null
   or exists(select 1 from public.damages d where d.exception_id in(a.id,b.id))
   or not public.manual_pair_source_ready(a.id,'bo') or not public.manual_pair_source_ready(b.id,'stm')
 then raise exception 'ต้องใช้เคสเปิดจากผลหลักล่าสุด ต้นทาง BO/STM ต้องอ่านสำเร็จ ไม่ถูกจอง และไม่มีทะเบียนความเสียหาย'; end if;
 return jsonb_build_object('bo',to_jsonb(a),'stm',to_jsonb(b),'difference',0,
   'review_type','seven_m_internal_transfer','seconds_apart',seconds_apart,
   'method','manual-seven-m-internal-transfer-cross-account');
end $$;
revoke all on function public.validate_7m_internal_transfer_pair(uuid,uuid) from public,anon,authenticated;

do $migration$
begin
 if to_regprocedure('public.validate_manual_pair_standard(uuid,uuid,text,uuid)') is null then
   alter function public.validate_manual_pair(uuid,uuid,text,uuid) rename to validate_manual_pair_standard;
 end if;
end $migration$;
create or replace function public.validate_manual_pair(p_bo uuid,p_stm uuid,p_mode text,p_evidence uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if p_mode='internal' then return public.validate_7m_internal_transfer_pair(p_bo,p_stm); end if;
 return public.validate_manual_pair_standard(p_bo,p_stm,p_mode,p_evidence);
end $$;
revoke all on function public.validate_manual_pair(uuid,uuid,text,uuid) from public,anon,authenticated;

create or replace function public.close_internal_transfer_pair(
 p_id uuid,p_bo uuid,p_stm uuid,p_mode text,p_reason text,p_evidence uuid default null)
returns public.manual_case_pairs language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.manual_case_pairs%rowtype; proof jsonb; a public.exceptions%rowtype; b public.exceptions%rowtype;
begin
 if auth.uid() is null or not public.current_user_active()
   or coalesce(public.current_app_role(),'') not in ('lead','admin') or p_mode is distinct from 'internal'
 then raise exception 'เฉพาะหัวหน้า/ผู้ดูแลปิดคู่โอนภายใน 7M ได้' using errcode='42501'; end if;
 p:=public.submit_manual_case_pair(p_id,p_bo,p_stm,p_mode,p_reason,p_evidence);
 if p.status='approved' and p.decided_by=auth.uid() then return p; end if;
 perform 1 from public.exceptions where id in(p_bo,p_stm) order by id for update;
 select * into p from public.manual_case_pairs where id=p_id for update;
 select * into a from public.exceptions where id=p_bo;
 select * into b from public.exceptions where id=p_stm;
 if p.status<>'pending' or p.submitted_by<>auth.uid() or a.status<>'pair_pending' or b.status<>'pair_pending'
   or a.manual_pair_id is distinct from p.id or b.manual_pair_id is distinct from p.id
 then raise exception 'สถานะคู่โอนภายในเปลี่ยน ต้องตรวจใหม่'; end if;
 proof:=public.validate_7m_internal_transfer_pair(a.id,b.id);
 if exists(select 1 from unnest(array['run_id','company','business_date','occurred_at','direction','account','currency','system_amount','bank_amount','bo_raw','stm_raw','ex_type']) k
   where proof->'bo'->k is distinct from p.snapshot->'bo'->k or proof->'stm'->k is distinct from p.snapshot->'stm'->k)
 then raise exception 'ต้นทาง ยอด บัญชี หรือเวลาเปลี่ยนหลังส่งคำขอ ต้องตรวจใหม่'; end if;
 update public.manual_case_pairs set status='approved',decided_by=auth.uid(),decided_at=now(),
   decision_note='หัวหน้าตรวจคู่โอนภายในข้ามบัญชีและต้นทางครบ',self_approved=true
   where id=p.id returning * into p;
 update public.exceptions set status='closed',auto_closed=false,approved_by=auth.uid(),approved_at=now(),
   resolved_by=auth.uid()::text,resolved_at=now(),
   resolution_note='ปิดคู่โอนภายใน 7M ข้ามบัญชี — ยอดตรง ทิศทางสวนทาง วันเดียวกัน เวลาไม่เกิน 5 นาที; คู่ '||p.id||': '||p.reason,
   updated_at=now() where id in(p.bo_case_id,p.stm_case_id);
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(auth.uid()::text,auth.uid(),'manual_7m_internal_transfer_close','manual_case_pair',p.id::text,
   jsonb_build_object('bo_case',p.bo_case_id,'stm_case',p.stm_case_id,'method','manual-seven-m-internal-transfer-cross-account','reason',p.reason)::text);
 return p;
end $$;
revoke all on function public.close_internal_transfer_pair(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.close_internal_transfer_pair(uuid,uuid,uuid,text,text,uuid) to authenticated;

insert into public.audit_log(actor,action,entity,target,detail)
values('authorized policy migration','update','approval_policy','UFABET7M internal transfer',
 'Added guarded manual cross-account internal-transfer closure. No existing cases changed.');
notify pgrst,'reload schema';
commit;
