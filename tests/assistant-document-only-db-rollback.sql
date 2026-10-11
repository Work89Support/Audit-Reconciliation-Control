-- Run policy migration without its final COMMIT, followed by this test.
-- Only synthetic clones are closed; original EX-3005 is never modified.
do $test$
declare sample public.exceptions%rowtype; before_real jsonb; payload jsonb; test_case uuid;
 request_id uuid; q public.case_closure_requests%rowtype; actual public.exceptions%rowtype;
 variant integer; accepted boolean;
 reason text:='ทดสอบ TEST เท่านั้น ไม่ปิดเคสจริง และย้อนกลับทุกข้อมูลเมื่อจบทดสอบ';
begin
 select * into strict sample from public.exceptions where id='9023ef55-01f7-40ae-b5ab-88862d73be42';
 before_real:=to_jsonb(sample);
 if not public.case_has_stored_document(sample.id) then raise exception 'TEST_FAILED: sample proof missing'; end if;
 perform set_config('request.jwt.claim.sub','292f1df9-4bcb-4115-b390-5bbc89e748fd',true);
 if not public.current_audit_assistant() then raise exception 'TEST_FAILED: assistant role changed'; end if;
 if public.assistant_document_amount_eligible(jsonb_build_object('currency','THB','system_amount',110,'bank_amount',null,'review_flags',jsonb_build_object('uncertain',true)))
 then raise exception 'TEST_FAILED: helper uncertainty guard'; end if;
 for variant in 1..9 loop
  test_case:=gen_random_uuid(); request_id:=gen_random_uuid();
  payload:=to_jsonb(sample)||jsonb_build_object('id',test_case,'code','TEST-ASSISTANT-'||variant,
   'status','open','manual_pair_id',null,'case_closure_request_id',null,
   'superseded_by_exception_id',null,'approved_by',null,'approved_at',null,'resolved_at',null,
   'resolved_by',null,'review_flags','{}'::jsonb,'currency','THB','system_amount',110,'bank_amount',null);
  if variant=2 then payload:=payload||jsonb_build_object('system_amount',30000); end if;
  if variant=3 then payload:=payload||jsonb_build_object('system_amount',30000.01); end if;
  if variant=4 then payload:=payload||jsonb_build_object('clarification_file_id',null); end if;
  if variant=5 then payload:=payload||jsonb_build_object('currency','USD'); end if;
  if variant=6 then payload:=payload||jsonb_build_object('system_amount',0); end if;
  if variant=7 then payload:=payload||jsonb_build_object('bank_amount',116); end if;
  if variant=8 then payload:=payload||jsonb_build_object('system_amount',null); end if;
  insert into public.exceptions select (jsonb_populate_record(null::public.exceptions,payload)).*;
  accepted:=false;
  begin
   q:=public.close_document_case(request_id,test_case,case when variant=9 then 'damage' else 'no_loss' end,case when variant=9 then 110 else 0 end,reason,case when variant=9 then 'external' else null end);
   accepted:=true;
  exception when others then
   if variant<=2 then raise; end if;
   if sqlerrm not like 'ต้องมีหลักฐานและไม่มีความเสียหาย%' and sqlerrm not like 'ปิดแบบไม่เสียหายต้องมีเอกสาร%' then raise; end if;
  end;
  if accepted is distinct from (variant<=2) then raise exception 'TEST_FAILED: variant % acceptance %',variant,accepted; end if;
  if accepted then
   select * into strict actual from public.exceptions where id=test_case;
   if actual.status<>'closed' or q.status<>'approved' or actual.bank_amount is not null
    or actual.system_amount is distinct from (payload->>'system_amount')::numeric
    or actual.approved_by<>auth.uid()
    or exists(select 1 from public.case_closure_requests where exception_id=test_case and status='pending')
    then raise exception 'TEST_FAILED: atomic close/source preservation'; end if;
  end if;
 end loop;
 if (select to_jsonb(e) from public.exceptions e where id=sample.id) is distinct from before_real
 then raise exception 'TEST_FAILED: real case changed'; end if;
end $test$;
select 'PASS: 110 and 30000 accepted on TEST clones; over-limit, no proof, USD, zero/missing BO, known difference >5 and damage rejected. Original case unchanged. ALL CHANGES ROLLED BACK.' as test_result;
rollback;
