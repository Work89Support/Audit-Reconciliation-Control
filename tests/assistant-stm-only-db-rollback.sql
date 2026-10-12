-- Synthetic clones only. Never close real cases. Always ROLLBACK.
begin;
set local statement_timeout='30s';
do $test$
declare sample public.exceptions%rowtype; original jsonb; payload jsonb; clone_id uuid;
 request_id uuid; q public.case_closure_requests%rowtype; actual public.exceptions%rowtype;
 variant integer; accepted boolean; expected boolean;
 reason text:='ทดสอบ TEST ข้อมูลจำลองเท่านั้น ไม่ปิดเคสจริง และย้อนกลับทั้งหมด';
begin
 select * into strict sample from public.exceptions where id='1e7fdd10-d0ea-41dc-b8ca-44cfcef54ba6';
 original:=to_jsonb(sample);
 if not public.case_has_stored_document(sample.id) then raise exception 'TEST_FAILED: sample proof missing'; end if;
 perform set_config('request.jwt.claim.sub','292f1df9-4bcb-4115-b390-5bbc89e748fd',true);
 if not public.current_audit_assistant() then raise exception 'TEST_FAILED: assistant role changed'; end if;
 if public.assistant_document_amount_eligible(jsonb_build_object('currency','THB','system_amount',null,'bank_amount',250,'review_flags',jsonb_build_object('uncertain',true)))
 then raise exception 'TEST_FAILED: uncertainty bypass'; end if;
 for variant in 1..15 loop
  clone_id:=gen_random_uuid();request_id:=gen_random_uuid();
  payload:=to_jsonb(sample)||jsonb_build_object('id',clone_id,'code','TEST-STM-ONLY-'||variant,
    'status','open','manual_pair_id',null,'case_closure_request_id',null,
    'previous_exception_id',null,'superseded_by_exception_id',null,'approved_by',null,
    'approved_at',null,'resolved_at',null,'resolved_by',null,'resolution_note',null,
    'currency','THB','system_amount',null,'bank_amount',250);
  if variant=2 then payload:=payload||jsonb_build_object('bank_amount',30000); end if;
  if variant=3 then payload:=payload||jsonb_build_object('system_amount',110,'bank_amount',null); end if;
  if variant=4 then payload:=payload||jsonb_build_object('system_amount',30000,'bank_amount',null); end if;
  if variant=5 then payload:=payload||jsonb_build_object('bank_amount',30000.01); end if;
  if variant=6 then payload:=payload||jsonb_build_object('system_amount',30000.01,'bank_amount',null); end if;
  if variant=7 then payload:=payload||jsonb_build_object('clarification_file_id',null); end if;
  if variant=8 then payload:=payload||jsonb_build_object('currency','USD'); end if;
  if variant=9 then payload:=payload||jsonb_build_object('bank_amount',null); end if;
  if variant=10 then payload:=payload||jsonb_build_object('bank_amount',0); end if;
  if variant=11 then payload:=payload||jsonb_build_object('bank_amount',-1); end if;
  if variant=12 then payload:=payload||jsonb_build_object('system_amount',244); end if;
  if variant=14 then payload:=payload||jsonb_build_object('status','closed'); end if;
  if variant=15 then payload:=payload||jsonb_build_object('system_amount',245); end if;
  expected:=variant in (1,2,3,4,15);
  insert into public.exceptions select (jsonb_populate_record(null::public.exceptions,payload)).*;
  accepted:=false;
  begin
   q:=public.close_document_case(request_id,clone_id,case when variant=13 then 'damage' else 'no_loss' end,
      case when variant=13 then 250 else 0 end,reason,case when variant=13 then 'external' else null end);
   accepted:=true;
  exception when others then if expected then raise; end if;
  end;
  if accepted is distinct from expected then raise exception 'TEST_FAILED: variant % accepted %',variant,accepted; end if;
  select * into strict actual from public.exceptions where id=clone_id;
  if actual.system_amount is distinct from (payload->>'system_amount')::numeric
    or actual.bank_amount is distinct from (payload->>'bank_amount')::numeric then raise exception 'TEST_FAILED: source amount changed'; end if;
  if accepted and (actual.status<>'closed' or q.status<>'approved' or actual.approved_by<>auth.uid()
    or exists(select 1 from public.case_closure_requests where exception_id=clone_id and status='pending'))
    then raise exception 'TEST_FAILED: direct close not atomic'; end if;
 end loop;
 if (select to_jsonb(e) from public.exceptions e where id=sample.id) is distinct from original
 then raise exception 'TEST_FAILED: real case changed'; end if;
end $test$;
select 'PASS: 15 synthetic variants; STM-only 250/30000, BO-only 110/30000 and known difference 5 accepted. Over-limit/no-proof/USD/missing/zero/negative/difference6/damage/closed rejected. Source amounts and real case unchanged. ROLLBACK follows.' as test_result;
rollback;
select count(*) as test_rows_remaining from public.exceptions where code like 'TEST-STM-ONLY-%';
