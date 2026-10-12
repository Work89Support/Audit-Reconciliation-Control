-- Execute after the migration body inside a transaction, then ROLLBACK.
-- Uses read-only variants of existing case JSON. No approvals/closures.
do $test$
declare row_json jsonb; run uuid; target uuid; variant jsonb; checked integer:=0; n integer;
begin
 for row_json,run in select to_jsonb(e),j.last_run_id from public.daily_recon_jobs j
   join public.exceptions e on e.run_id=j.last_run_id
   where j.company in ('AT4','SK8') and j.business_date='2026-10-11' and not j.is_archived
     and e.status='open' and e.superseded_by_exception_id is null and e.customer_details->>'waiting_source'='true'
 loop
   target:=public.bo_waiting_cross_day_target(row_json,run);
   if target is null then raise exception 'Expected unique exact-source target for %',row_json->>'id';end if;
   if public.bo_waiting_cross_day_target(row_json||jsonb_build_object('run_id',gen_random_uuid()),run)<>target
   then raise exception 'Previous-run case should reuse unique current target';end if;
   for variant in select value from jsonb_array_elements(jsonb_build_array(
     row_json||jsonb_build_object('status','closed'),
     row_json||jsonb_build_object('status','answered'),
     row_json||jsonb_build_object('case_closure_request_id',gen_random_uuid()),
     row_json||jsonb_build_object('manual_pair_id',gen_random_uuid()),
     row_json||jsonb_build_object('company','FR8'),
     row_json||jsonb_build_object('bo_time','00:00:01'),
     row_json||jsonb_build_object('system_amount',999999),
     jsonb_set(row_json,'{customer_details,source_rows,bo,row}','999999'::jsonb),
     jsonb_set(row_json,'{customer_details,source_rows,bo,fileId}',to_jsonb(gen_random_uuid()::text)),
     jsonb_set(row_json,'{customer_details,bo,reference}','"OTHER"'::jsonb),
     jsonb_set(row_json,'{customer_details,bo,user}','"OTHER"'::jsonb),
     row_json#-'{customer_details,bo,reference}'
   )) loop
     if public.bo_waiting_cross_day_target(variant,run) is not null then raise exception 'Unsafe identity/protected variant accepted';end if;
   end loop;
   checked:=checked+1;
 end loop;
 if checked<>10 then raise exception 'Expected ten pairs, got %',checked;end if;
 -- The lifecycle's new join reuses the canonical case, not a new carry clone.
 select count(*) into n from public.daily_recon_jobs j join public.exceptions o on o.run_id=j.last_run_id
 join public.exceptions c on c.run_id=j.last_run_id and
   (c.lifecycle_key=o.lifecycle_key or c.id=public.bo_waiting_cross_day_target(to_jsonb(o),j.last_run_id))
 where j.company in ('AT4','SK8') and j.business_date='2026-10-11' and not j.is_archived
   and o.status='open' and o.superseded_by_exception_id is null and o.customer_details->>'waiting_source'='true'
   and c.ex_type='cross_day';
 if n<>10 then raise exception 'Lifecycle did not reuse exactly ten existing canonical cases';end if;
end $test$;
