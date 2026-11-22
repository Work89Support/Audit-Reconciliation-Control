-- Run with a transaction-local audit.test_source_id pointing to an approved
-- TMN recovery. All fixture mutations are rolled back; no cases/jobs are changed.
begin;
do $test$
declare
 source_id uuid:=current_setting('audit.test_source_id')::uuid;
 recovery_id uuid;
 original jsonb;
 candidate jsonb;
 variant text;
begin
 select id,payload into strict recovery_id,original
 from public.reviewed_pdf_recoveries
 where source_file_id=source_id and superseded_at is null for update;
 if not public.audit_source_recovery_reviewed(source_id) then
  raise exception 'Approved recovery must pass';
 end if;
 foreach variant in array array['checksum','date','account','coverage','controls','reviewed','direction','fee','duplicate'] loop
  candidate:=case variant
   when 'checksum' then jsonb_set(original,'{sourceChecksum}',to_jsonb(repeat('0',64)))
   when 'date' then jsonb_set(original,'{businessDate}','"1900-01-01"')
   when 'account' then jsonb_set(original,'{account}','""')
   when 'coverage' then jsonb_set(original,'{pagesReviewed}','[1]')
   when 'controls' then jsonb_set(original,'{controls,deposit,amount}','-1')
   when 'reviewed' then jsonb_set(original,'{rows,0,reviewed}','false')
   when 'direction' then jsonb_set(original,'{rows,0,direction}','"fee"')
   when 'fee' then jsonb_set(original,'{rows,0,description}','"fee"')
   when 'duplicate' then jsonb_set(original,'{rows,1,id}',original#>'{rows,0,id}')
  end;
  update public.reviewed_pdf_recoveries set payload=candidate where id=recovery_id;
  update public.source_file_ocr set reviewed_recovery=jsonb_set(reviewed_recovery,'{payload}',candidate)
   where source_file_id=source_id;
  if public.audit_source_recovery_reviewed(source_id) then
   raise exception 'Invalid recovery accepted: %',variant;
  end if;
 end loop;
 update public.reviewed_pdf_recoveries set payload=original where id=recovery_id;
 update public.source_file_ocr set reviewed_recovery=jsonb_set(reviewed_recovery,'{payload}',original)
  where source_file_id=source_id;
 if not public.audit_source_recovery_reviewed(source_id) then
  raise exception 'Restored recovery must pass';
 end if;
 raise notice 'Approved recovery and nine rejection regressions passed';
end;
$test$;
rollback;
