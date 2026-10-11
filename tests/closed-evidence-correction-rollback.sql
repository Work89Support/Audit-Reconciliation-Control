-- Synthetic metadata only. No uploads or edits to real cases. Always ROLLBACK.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $test$
declare head uuid; helper uuid; c uuid:=gen_random_uuid(); original uuid:=gen_random_uuid(); replacement uuid:=gen_random_uuid();
 other_case uuid:=gen_random_uuid(); other_proof uuid:=gen_random_uuid(); saved public.case_evidence%rowtype; m jsonb; baseline jsonb; rejected boolean;
begin
 select user_id into head from public.app_profiles where active and role in ('lead','admin') limit 1;
 select user_id into helper from public.app_profiles where active and role in ('monitor','audit_assistant','shift_lead') limit 1;
 if head is null or helper is null then raise exception 'Missing roles for rollback test'; end if;
 perform set_config('request.jwt.claim.sub',head::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',head,'role','authenticated')::text,true);
 insert into public.exceptions(id,code,company,business_date,status,system_amount,bank_amount)
  values(c,'TEST-EVIDENCE-CORRECTION','3XB','2026-10-10','closed',110,null),
   (other_case,'TEST-EVIDENCE-OTHER','3XB','2026-10-10','closed',200,null);
 insert into public.case_evidence(id,exception_id,storage_path,file_name,size_bytes,mime_type,uploaded_by)
 values(original,c,'test-correction-original/'||original,'dummy-original.txt',4,'text/plain',head),
 (other_proof,other_case,'test-correction-original/'||other_proof,'dummy-other.txt',4,'text/plain',head);
 select to_jsonb(e) into baseline from public.exceptions e where id=c;
 m:=jsonb_build_object('id',replacement,'exception_id',c,'storage_path','case-evidence/'||c||'/'||head||'/'||replacement,
  'file_name','dummy-corrected.txt','size_bytes',4,'mime_type','text/plain','uploaded_by',head,
  'replaces_evidence_id',original,'correction_reason','TEST ONLY wrong attachment');
 insert into storage.objects(bucket_id,name,owner_id,metadata)
  values('audit-files',m->>'storage_path',head::text,'{"size":4}'::jsonb);
 rejected:=false;
 begin perform public.register_closed_case_evidence(m||'{"correction_reason":" "}'); exception when sqlstate '22023' then rejected:=true; end;
 if not rejected then raise exception 'Blank reason accepted'; end if;
 rejected:=false;
 begin perform public.register_closed_case_evidence(m||jsonb_build_object('replaces_evidence_id',other_proof)); exception when sqlstate '22023' then rejected:=true; end;
 if not rejected then raise exception 'Cross-case original accepted'; end if;
 perform set_config('request.jwt.claim.sub',helper::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',helper,'role','authenticated')::text,true);
 rejected:=false;
 begin perform public.register_closed_case_evidence(m); exception when sqlstate '42501' then rejected:=true; end;
 if not rejected then raise exception 'Helper accepted'; end if;
 perform set_config('request.jwt.claim.sub',head::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',head,'role','authenticated')::text,true);
 update public.exceptions set status='open' where id=c;
 rejected:=false;
 begin perform public.register_closed_case_evidence(m); exception when sqlstate '42501' then rejected:=true; end;
 if not rejected then raise exception 'Open case accepted'; end if;
 update public.exceptions set status='closed' where id=c;
 -- Only synthetic case timestamps may have changed in this test's setup.
 select to_jsonb(e) into baseline from public.exceptions e where id=c;
 saved:=public.register_closed_case_evidence(m);
 if saved.id<>replacement or saved.replaces_evidence_id<>original then raise exception 'Wrong revision receipt'; end if;
 saved:=public.register_closed_case_evidence(m);
 if (select count(*) from public.case_evidence where exception_id=c)<>2 then raise exception 'Retry duplicated evidence'; end if;
 if (select to_jsonb(e) from public.exceptions e where id=c) is distinct from baseline then raise exception 'Case or amount changed'; end if;
 if (select count(*) from public.audit_log where target=c::text and action='case_evidence_corrected')<>1 then raise exception 'History missing or duplicated'; end if;
 if not exists(select 1 from public.case_evidence where id=original and file_name='dummy-original.txt') then raise exception 'Original lost'; end if;
 raise notice 'PASS: head append-only correction, helper denied, reason/original/latest-status guards, same receipt on retry, original kept, case and amounts unchanged';
end $test$;
rollback;
select jsonb_build_object('test_rows_remaining',(select count(*) from public.exceptions where code in ('TEST-EVIDENCE-CORRECTION','TEST-EVIDENCE-OTHER')),
 'installed',to_regprocedure('public.register_closed_case_evidence(jsonb)') is not null) as verification;
