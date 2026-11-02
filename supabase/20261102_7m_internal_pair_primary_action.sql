-- 7M internal case pairing must use the BO action column before the note.
-- A BO row can legitimately contain "โยกเงินออก" as its action and
-- "โยกเข้า ..." in its note for the other leg of the same transfer.
-- This migration changes no cases, amounts, primary results, or existing pairs.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.validate_7m_internal_transfer_pair(p_bo uuid,p_stm uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
 a public.exceptions%rowtype;
 b public.exceptions%rowtype;
 seconds_apart integer;
 action_text text;
 movement_direction text;
begin
 select * into a from public.exceptions where id=p_bo;
 select * into b from public.exceptions where id=p_stm;
 if a.id is null or b.id is null or a.id=b.id
   or not public.has_company_access(a.company) or not public.has_company_access(b.company)
 then raise exception 'ไม่พบคู่เคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;

 action_text:=nullif(btrim(split_part(coalesce(a.bo_raw,''),'|',2)),'');
 if action_text is null or action_text !~* '(ปรับ(ยอด|เงิน)?(เข้า|ออก)|โยก(เงิน)?(เข้า|ออก)|โอน(เงิน)?(เข้า|ออก)|ถอนภายใน|รับยอด)'
 then action_text:=coalesce(a.bo_raw,''); end if;
 if action_text ~* '(ปรับ(ยอด|เงิน)?ออก|โยก(เงิน)?ออก|โอน(เงิน)?ออก|ถอนภายใน)'
 then movement_direction:='ถอน';
 elsif action_text ~* '(ปรับ(ยอด|เงิน)?เข้า|โยก(เงิน)?เข้า|โอน(เงิน)?เข้า|(^|[[:space:]:=-])รับยอด($|[[:space:]:=-]))'
 then movement_direction:='ฝาก';
 end if;

 if upper(a.company) not in ('7M','UFABET7M') or upper(a.company)<>upper(b.company)
   or a.ex_type<>'missing_stm' or b.ex_type<>'missing_bo'
   or a.business_date is distinct from b.business_date
   or nullif(btrim(a.account),'') is null or a.account is distinct from b.account
   or b.direction not in ('ฝาก','ถอน') or movement_direction is distinct from b.direction
   or a.currency is distinct from 'THB' or b.currency is distinct from 'THB'
   or a.system_amount is null or a.system_amount<=0 or a.system_amount is distinct from b.bank_amount
   or a.occurred_at is null or b.occurred_at is null
   or coalesce(length(btrim(a.bo_raw)),0)<2 or coalesce(length(btrim(b.stm_raw)),0)<2
 then raise exception 'คู่ภายใน 7M ต้องเป็นบัญชีเดียวกัน และประเภทดำเนินการจริงใน BO ต้องตรงกับ STM'; end if;
 seconds_apart:=abs(extract(epoch from (a.occurred_at-b.occurred_at)))::integer;
 if seconds_apart>300 then raise exception 'เวลา BO กับ STM/PM ของคู่ภายในต้องห่างไม่เกิน 5 นาที'; end if;
 if a.superseded_by_exception_id is not null or b.superseded_by_exception_id is not null
   or exists(select 1 from public.damages d where d.exception_id in(a.id,b.id))
   or not public.manual_pair_source_ready(a.id,'bo') or not public.manual_pair_source_ready(b.id,'stm')
 then raise exception 'ต้องใช้เคสเปิดจากผลหลักล่าสุด ต้นทาง BO/STM ต้องอ่านสำเร็จ ไม่ถูกจอง และไม่มีทะเบียนความเสียหาย'; end if;
 return jsonb_build_object('bo',to_jsonb(a),'stm',to_jsonb(b),'difference',0,
   'review_type','seven_m_internal_transfer','seconds_apart',seconds_apart,
   'same_account',true,'method','manual-seven-m-internal-transfer-primary-bo-action');
end $$;
revoke all on function public.validate_7m_internal_transfer_pair(uuid,uuid) from public,anon,authenticated;

insert into public.audit_log(actor,action,entity,target,detail)
values('authorized policy migration','update','approval_policy','UFABET7M internal pair primary BO action',
 'Use BO action column before the opposite-leg note. No existing cases changed.');
notify pgrst,'reload schema';
commit;
