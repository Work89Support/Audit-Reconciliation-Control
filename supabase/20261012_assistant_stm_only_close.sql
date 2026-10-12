-- Authorized policy extension only; no real cases or amounts are modified.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$
begin
 if strpos(pg_get_functiondef('public.decide_case_closure(uuid,text,text)'::regprocedure),'assistant_document_amount_eligible')=0 then
  raise exception 'Unrecognized assistant document closure baseline';
 end if;
end $guard$;
create or replace function public.assistant_document_amount_eligible(e jsonb) returns boolean
 language sql immutable set search_path=public,pg_temp as $$
 select coalesce(
  e->>'currency'='THB'
  and (e->>'system_amount' is not null or e->>'bank_amount' is not null)
  and (e->>'system_amount' is null or ((e->>'system_amount')::numeric>0 and (e->>'system_amount')::numeric<=30000))
  and (e->>'bank_amount' is null or ((e->>'bank_amount')::numeric>0 and (e->>'bank_amount')::numeric<=30000))
  and (e->>'system_amount' is null or e->>'bank_amount' is null or abs((e->>'system_amount')::numeric-(e->>'bank_amount')::numeric)<=5)
  and not (coalesce((e->'review_flags'->>'repeat')::boolean,false)
    or coalesce((e->'review_flags'->>'manual')::boolean,false)
    or coalesce((e->'review_flags'->>'uncertain')::boolean,false)),false)
$$;
revoke all on function public.assistant_document_amount_eligible(jsonb) from public,anon,authenticated;
do $message$
declare def text;
begin
 def:=pg_get_functiondef('public.decide_case_closure(uuid,text,text)'::regprocedure);
 execute replace(def,
  'ต้องมีหลักฐานและไม่มีความเสียหาย ผู้ช่วยปิดได้เมื่อ BO ไม่เกิน 30,000 บาท แม้ไม่มี STM/PM หากมีทั้งสองฝั่งต้องต่างไม่เกิน 5 บาท',
  'ต้องมีหลักฐานและไม่มีความเสียหาย ผู้ช่วยปิดได้เมื่อ BO หรือ STM/PM ไม่เกิน 30,000 บาท แม้ขาดอีกฝั่ง หากมีทั้งสองฝั่งต้องต่างไม่เกิน 5 บาท');
end $message$;
notify pgrst,'reload schema';
commit;
