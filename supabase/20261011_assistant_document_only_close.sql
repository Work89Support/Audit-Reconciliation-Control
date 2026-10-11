-- Authorized: BO <=30,000 THB, stored proof and no loss, even without STM/PM.
-- Installs policy only. Does not close or modify any existing case.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function public.assistant_document_amount_eligible(e jsonb) returns boolean
 language sql immutable set search_path=public,pg_temp as $$
 select coalesce(
   e->>'currency'='THB'
   and (e->>'system_amount')::numeric>0 and (e->>'system_amount')::numeric<=30000
   and ((e->>'bank_amount') is null or (
     (e->>'bank_amount')::numeric>0 and (e->>'bank_amount')::numeric<=30000
     and abs((e->>'system_amount')::numeric-(e->>'bank_amount')::numeric)<=5))
   and not (coalesce((e->'review_flags'->>'repeat')::boolean,false)
     or coalesce((e->'review_flags'->>'manual')::boolean,false)
     or coalesce((e->'review_flags'->>'uncertain')::boolean,false)),false)
$$;
revoke all on function public.assistant_document_amount_eligible(jsonb) from public,anon,authenticated;
do $patch$
declare def text; needle text;
begin
 def:=pg_get_functiondef('public.decide_case_closure(uuid,text,text)'::regprocedure);
 needle:='or e.system_amount is null or e.bank_amount is null or abs(e.system_amount-e.bank_amount)>5';
 if strpos(def,needle)=0 then raise exception 'Unrecognized document amount guard'; end if;
 def:=replace(def,needle,
   'or (case when public.current_audit_assistant() then not public.assistant_document_amount_eligible(to_jsonb(e)) else (e.system_amount is null or e.bank_amount is null or abs(e.system_amount-e.bank_amount)>5) end)');
 def:=replace(def,'คำขอตัวเองต้องมีเอกสาร ยอดต่างไม่เกิน 5 บาท และปิดแบบไม่เสียหาย',
   'ต้องมีหลักฐานและไม่มีความเสียหาย ผู้ช่วยปิดได้เมื่อ BO ไม่เกิน 30,000 บาท แม้ไม่มี STM/PM หากมีทั้งสองฝั่งต้องต่างไม่เกิน 5 บาท');
 execute def;
end $patch$;
notify pgrst,'reload schema';
commit;
