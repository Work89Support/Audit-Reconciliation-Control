-- Definitions only: never bypass primary_history_unchanged or replay a job.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- This is a data boundary, not an interactive-user permission check. Workers
-- must not touch ANY day governed by an explicitly confirmed manual case set.
create or replace function public.worker_primary_scope_protected(p_company text,p_date date)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.manual_primary_case_sets b
 where b.company=p_company and b.business_date=p_date)
$$;
revoke all on function public.worker_primary_scope_protected(text,date) from public,anon,authenticated;
grant execute on function public.worker_primary_scope_protected(text,date) to service_role;

do $patch$
declare d text; needle text; replacement text; signature text;
begin
 d:=pg_get_functiondef('public.finish_daily_recon_job(uuid,uuid)'::regprocedure);
 foreach needle in array array[
  'where e.run_id=p_run_id and e.lifecycle_key is null',
  'where e.run_id=v_old_run_id and e.lifecycle_key is null',
  'where e.run_id=v_old_run_id and e.status in'
 ] loop
  replacement:=replace(needle,'where e.run_id=',
   'where not public.worker_primary_scope_protected(e.company,e.business_date) and e.run_id=');
  if position(replacement in d)=0 then
   if (length(d)-length(replace(d,needle,'')))/length(needle)<>1 then
    raise exception 'Unreviewed finish definition: %',needle;
   end if;
   d:=replace(d,needle,replacement);
  end if;
 end loop;
 execute d;

 -- Approval/native-preservation hooks may also see a previous-day row in the
 -- new report. Do not copy a closure onto a historical manual-primary scope.
 foreach signature in array array[
  'public.preserve_approved_case_closures(uuid,boolean,uuid[])',
  'public.preserve_native_cross_day_closures(uuid,boolean,uuid[])'
 ] loop
  d:=pg_get_functiondef(signature::regprocedure);
  needle:='where e.run_id=p_run and e.';
  replacement:='where not public.worker_primary_scope_protected(e.company,e.business_date) and e.run_id=p_run and e.';
  if position(replacement in d)=0 then
   if (length(d)-length(replace(d,needle,'')))/length(needle)<>1 then
    raise exception 'Unreviewed preservation definition: %',signature;
   end if;
   execute replace(d,needle,replacement);
  end if;
 end loop;
end $patch$;
notify pgrst,'reload schema';
commit;
