-- Enable adjacent-day manual pairing and the cross-day workbench for immutable
-- late-night waiting rows materialized from an accepted manual-primary result.
-- Definitions only: no amount, case, status, run, hold or history rows change.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';

create or replace function public.cross_day_actionable_case(e public.exceptions)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select e.ex_type='cross_day' or (
  e.ex_type='missing_stm'
  and e.customer_details->>'waiting_source'='true'
  and coalesce(e.bo_time,e.occurred_at) between time '23:00:00' and time '23:59:59.999999'
  and e.system_amount>0 and e.bank_amount is null
  and e.customer_details#>>'{source_rows,bo,fileId}'~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and e.customer_details#>>'{source_rows,bo,row}'~'^[1-9][0-9]*$'
  and public.primary_case_is_current(e.id)
  and (e.customer_details->>'manual_primary_id' is null or public.cross_day_current_manual_case(e)))
$$;
revoke all on function public.cross_day_actionable_case(public.exceptions) from public,anon,authenticated;

do $patch$
declare definition text;old_anchor text;new_anchor text;signature text;
begin
 signature:='public.cross_day_workbench(text,date,date)';
 definition:=pg_get_functiondef(signature::regprocedure);
 old_anchor:='e.ex_type=''cross_day'' and public.cross_day_case_source_ready(e)';
 new_anchor:='public.cross_day_actionable_case(e) and public.cross_day_case_source_ready(e)';
 if position(new_anchor in definition)=0 then
  if (length(definition)-length(replace(definition,old_anchor,'')))/length(old_anchor)<>1 then
   raise exception 'Unexpected workbench case-scope definition';end if;
  execute replace(definition,old_anchor,new_anchor);
 end if;

 signature:='public.validate_cross_day_row(uuid,uuid,integer)';
 definition:=pg_get_functiondef(signature::regprocedure);
 old_anchor:='or e.ex_type<>''cross_day'' or e.currency';
 new_anchor:='or not public.cross_day_actionable_case(e) or e.currency';
 if position(new_anchor in definition)=0 then
  if (length(definition)-length(replace(definition,old_anchor,'')))/length(old_anchor)<>1
   or position('public.primary_case_is_current(e.id)' in definition)=0
   or position('public.cross_day_current_manual_case(e)' in definition)=0
   or position('public.cross_day_verified_rows(p_file)' in definition)=0
  then raise exception 'Unexpected native cross-day validation definition';end if;
  execute replace(definition,old_anchor,new_anchor);
 end if;

 signature:='public.submit_cross_day_image_review(uuid,uuid,uuid,integer,text)';
 definition:=pg_get_functiondef(signature::regprocedure);
 old_anchor:='if e.ex_type<>''cross_day'' or (e.status not in (''open'',''pending_next_day'')';
 new_anchor:='if not public.cross_day_actionable_case(e) or (e.status not in (''open'',''pending_next_day'')';
 if position(new_anchor in definition)=0 then
  if (length(definition)-length(replace(definition,old_anchor,'')))/length(old_anchor)<>1
   or position('public.cross_day_case_source_ready(e)' in definition)=0
   or position('storage.objects' in definition)=0
  then raise exception 'Unexpected cross-day image submission definition';end if;
  execute replace(definition,old_anchor,new_anchor);
 end if;

 signature:='public.validate_manual_pair(uuid,uuid,text,uuid)';
 definition:=pg_get_functiondef(signature::regprocedure);
 old_anchor:='a.ex_type<>''missing_stm'' or b.ex_type<>''missing_bo''';
 new_anchor:='a.ex_type not in (''missing_stm'',''cross_day'') or b.ex_type<>''missing_bo''';
 if position(new_anchor in definition)=0 then
  if (length(definition)-length(replace(definition,old_anchor,'')))/length(old_anchor)<>1
   or position('manual_pair_scoped_source_ready(a.id,''BO'')' in definition)=0
   or position('manual_pair_scoped_source_ready(b.id,''STM'')' in definition)=0
  then raise exception 'Unexpected manual pair validation definition';end if;
  execute replace(definition,old_anchor,new_anchor);
 end if;

 signature:='public.submit_manual_case_pair(uuid,uuid,uuid,text,text,uuid)';
 definition:=pg_get_functiondef(signature::regprocedure);
 old_anchor:='not (a.status=''open'' and b.status=''open'' or (a.id=b.id and a.ex_type=''amount_diff'' and a.status in (''clarifying'',''answered'')))';
 new_anchor:='not (((a.status=''open'' or (a.status=''pending_next_day'' and a.ex_type=''cross_day'')) and b.status=''open'') or (a.id=b.id and a.ex_type=''amount_diff'' and a.status in (''clarifying'',''answered'')))';
 if position(new_anchor in definition)=0 then
  if (length(definition)-length(replace(definition,old_anchor,'')))/length(old_anchor)<>1
   or position('proof:=public.validate_manual_pair' in definition)=0
   or position('for update' in definition)=0
  then raise exception 'Unexpected manual pair submission status definition';end if;
  execute replace(definition,old_anchor,new_anchor);
 end if;

 signature:='public.guard_manual_pair_case()';
 definition:=pg_get_functiondef(signature::regprocedure);
 old_anchor:='(old.status=''open'' or (p.bo_case_id=p.stm_case_id and old.ex_type=''amount_diff'' and old.status in (''clarifying'',''answered'')))';
 new_anchor:='(old.status=''open'' or (old.status=''pending_next_day'' and old.id=p.bo_case_id and old.ex_type=''cross_day'') or (p.bo_case_id=p.stm_case_id and old.ex_type=''amount_diff'' and old.status in (''clarifying'',''answered'')))';
 if position(new_anchor in definition)=0 then
  if (length(definition)-length(replace(definition,old_anchor,'')))/length(old_anchor)<>1
   or position('p.snapshot->''bo''->>''status''' in definition)=0
   or position('p.snapshot->''stm''->>''status''' in definition)=0
  then raise exception 'Unexpected manual pair trigger definition';end if;
  execute replace(definition,old_anchor,new_anchor);
 end if;
end $patch$;

notify pgrst,'reload schema';
commit;
