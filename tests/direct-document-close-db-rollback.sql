-- Run after the migration in the SAME transaction, ending in rollback.
-- Clone one source case into an uncommitted TEST record; never close the real case.
do $test$
declare sample public.exceptions%rowtype; payload jsonb; test_case uuid:=gen_random_uuid(); request_id uuid:=gen_random_uuid();
 q public.case_closure_requests%rowtype; retried public.case_closure_requests%rowtype; actual public.exceptions%rowtype;
 reason text:='ทดสอบกลไกปิดเคสเท่านั้น รายการ TEST และทุกการเปลี่ยนแปลงย้อนกลับทั้งหมด';
begin
 perform set_config('request.jwt.claim.sub','35752eec-b569-4d07-a7af-ed1b60c21678',true);
 if public.current_app_role() not in ('lead','admin') then raise exception 'TEST_FAILED: head baseline changed'; end if;
 select * into strict sample from public.exceptions where id='6e7a544d-314c-4400-86f5-0d35a2f4cc30';
 if not public.case_has_stored_document(sample.id) then raise exception 'TEST_FAILED: sample has no stored document'; end if;
 payload:=to_jsonb(sample)||jsonb_build_object('id',test_case,'code','TEST-DIRECT-CLOSE','status','open',
 'manual_pair_id',null,'case_closure_request_id',null,'superseded_by_exception_id',null,'approved_by',null,'approved_at',null,'resolved_at',null,'resolved_by',null);
 insert into public.exceptions select (jsonb_populate_record(null::public.exceptions,payload)).*;

 perform set_config('request.jwt.claim.sub','b31a4d98-1864-41cb-8831-eb99889b2339',true);
 if public.can_attach_pending_pair_evidence('5712fb76-5759-439d-bd8b-94458a820635') then raise exception 'TEST_FAILED: unrelated Audit can attach reserved proof'; end if;
 begin
  perform public.close_document_case(gen_random_uuid(),test_case,'no_loss',0,reason,null);
  raise exception 'TEST_FAILED: basic Audit closed';
 exception when insufficient_privilege then null;
 end;

 perform set_config('request.jwt.claim.sub','292f1df9-4bcb-4115-b390-5bbc89e748fd',true);
 begin
  perform public.close_document_case(gen_random_uuid(),test_case,'no_loss',0,reason,null);
  raise exception 'TEST_FAILED: assistant exceeded <=5 known-amount limit';
 exception when others then
  if sqlerrm not like 'คำขอตัวเองต้อง%' then raise; end if;
 end;

 perform set_config('request.jwt.claim.sub','35752eec-b569-4d07-a7af-ed1b60c21678',true);
 if not public.can_attach_pending_pair_evidence('5712fb76-5759-439d-bd8b-94458a820635') then raise exception 'TEST_FAILED: head cannot append proof'; end if;
 q:=public.close_document_case(request_id,test_case,'no_loss',0,reason,null);
 select * into strict actual from public.exceptions where id=test_case;
 if q.status<>'approved' or q.review_origin<>'head_direct' or actual.status<>'closed' or actual.approved_by<>auth.uid()
 or actual.system_amount is distinct from sample.system_amount or actual.bank_amount is distinct from sample.bank_amount
 then raise exception 'TEST_FAILED: direct close did not persist correctly'; end if;
 retried:=public.close_document_case(request_id,test_case,'no_loss',0,reason,null);
 if retried.id<>q.id or retried.status<>'approved' then raise exception 'TEST_FAILED: lost-response retry'; end if;
 if exists(select 1 from public.case_closure_requests where exception_id=test_case and status='pending') then raise exception 'TEST_FAILED: direct close left a pending queue'; end if;
end $test$;
select 'PASS: head closes TEST record atomically; no pending queue; retry safe; basic Audit denied; assistant limit and source amounts preserved. ALL CHANGES ROLLED BACK.' as test_result;
rollback;
