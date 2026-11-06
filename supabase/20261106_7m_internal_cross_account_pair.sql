-- Authorized 2026-11-06: allow all 7M BO accounts for manual internal pairs.
-- DDL only. No existing cases, pairs, amounts, sources or histories are changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.manual_internal_movement_direction(p_raw text)
returns text language plpgsql immutable set search_path=public,pg_temp as $$
declare action_text text; movement text;
begin
 action_text:=split_part(coalesce(p_raw,''),'|',2);
 movement:=substring(action_text from '(ปรับ(ยอด|เงิน)?ออก|โยก(เงิน)?ออก|โอน(เงิน)?ออก|ถอนภายใน|ปรับ(ยอด|เงิน)?เข้า|โยก(เงิน)?เข้า|โอน(เงิน)?เข้า|(^|[[:space:]:=-])รับยอด($|[[:space:]:=-]))');
 if movement is null then
  movement:=substring(coalesce(p_raw,'') from '(ปรับ(ยอด|เงิน)?ออก|โยก(เงิน)?ออก|โอน(เงิน)?ออก|ถอนภายใน|ปรับ(ยอด|เงิน)?เข้า|โยก(เงิน)?เข้า|โอน(เงิน)?เข้า|(^|[[:space:]:=-])รับยอด($|[[:space:]:=-]))');
 end if;
 if movement ~ '(ออก|ถอนภายใน)' then return 'ถอน'; end if;
 if movement ~ '(เข้า|รับยอด)' then return 'ฝาก'; end if;
 return null;
end $$;
revoke all on function public.manual_internal_movement_direction(text) from public,anon,authenticated;

create or replace function public.validate_7m_internal_transfer_pair(p_bo uuid,p_stm uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a public.exceptions%rowtype; b public.exceptions%rowtype;
 seconds_apart integer; same_account boolean; movement_direction text;
begin
 select * into a from public.exceptions where id=p_bo;
 select * into b from public.exceptions where id=p_stm;
 if a.id is null or b.id is null or a.id=b.id
   or public.has_company_access(a.company) is distinct from true
   or public.has_company_access(b.company) is distinct from true
 then raise exception 'ไม่พบคู่เคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;
 same_account:=a.account=b.account;
 movement_direction:=public.manual_internal_movement_direction(a.bo_raw);
 if upper(a.company) not in ('7M','UFABET7M') or a.company is distinct from b.company
   or a.ex_type is distinct from 'missing_stm' or b.ex_type is distinct from 'missing_bo'
   or a.business_date is null or a.business_date is distinct from b.business_date
   or nullif(btrim(a.account),'') is null or nullif(btrim(b.account),'') is null
   or b.direction is null or b.direction not in ('ฝาก','ถอน')
   or movement_direction is distinct from (case when same_account then b.direction
      when b.direction='ถอน' then 'ฝาก' else 'ถอน' end)
   or a.currency is distinct from 'THB' or b.currency is distinct from 'THB'
   or a.system_amount is null or a.system_amount<=0
   or a.system_amount::text in ('NaN','Infinity','-Infinity')
   or a.system_amount is distinct from b.bank_amount
   or a.occurred_at is null or b.occurred_at is null
   or coalesce(length(btrim(a.bo_raw)),0)<2 or coalesce(length(btrim(b.stm_raw)),0)<2
   or btrim(a.bo_raw) ~ '^(—|–|-|ไม่พบ|รอข้อมูล)' or btrim(b.stm_raw) ~ '^(—|–|-|ไม่พบ|รอข้อมูล)'
 then raise exception 'คู่ภายใน 7M ต้องยอดตรง วันเดียวกัน มีต้นทางจริง; ข้ามบัญชีต้องโอนออกคู่รับเข้า บัญชีเดียวกันต้องปรับยอดทิศทางเดียวกัน'; end if;
 seconds_apart:=abs(extract(epoch from (a.occurred_at-b.occurred_at)))::integer;
 if seconds_apart>300 then raise exception 'เวลา BO กับ STM/PM ต้องห่างไม่เกิน 5 นาที'; end if;
 if a.superseded_by_exception_id is not null or b.superseded_by_exception_id is not null
   or a.case_closure_request_id is not null or b.case_closure_request_id is not null
   or a.status not in ('open','clarifying','answered','pair_pending')
   or b.status not in ('open','clarifying','answered','pair_pending')
   or a.status is null or b.status is null
   or ((a.manual_pair_id is not null or b.manual_pair_id is not null)
     and (a.status is distinct from 'pair_pending' or b.status is distinct from 'pair_pending'
       or a.manual_pair_id is null or a.manual_pair_id is distinct from b.manual_pair_id))
   or exists(select 1 from public.damages d where d.exception_id in(a.id,b.id))
   or public.manual_pair_scoped_source_ready(a.id,'BO') is distinct from true
   or public.manual_pair_scoped_source_ready(b.id,'STM') is distinct from true
 then raise exception 'ต้องใช้เคสที่ยังเปิดจากผลหลัก ต้นทางอ่านสำเร็จ ไม่ถูกจอง และไม่มีความเสียหาย'; end if;
 return jsonb_build_object('bo',to_jsonb(a),'stm',to_jsonb(b),'difference',0,
   'review_type','seven_m_internal_transfer','seconds_apart',seconds_apart,
   'same_account',same_account,'method',case when same_account
     then 'manual-seven-m-internal-transfer-primary-bo-action'
     else 'manual-seven-m-internal-transfer-cross-account-v2' end);
end $$;
revoke all on function public.validate_7m_internal_transfer_pair(uuid,uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
