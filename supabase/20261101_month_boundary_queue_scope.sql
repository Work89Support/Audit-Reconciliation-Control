-- Keep the automatic reconciliation queue on the latest Bangkok business day
-- even when that day belongs to the previous calendar month.  The previous
-- month-start clamp excluded 31 October when the dispatcher ran on 1 November.

begin;

do $block$
declare
  definition text;
  patched text;
  old_scope constant text :=
    'v_from:=greatest(v_from,date_trunc(''month'',current_date)::date,(now() at time zone ''Asia/Bangkok'')::date-1);';
  new_scope constant text :=
    'v_from:=greatest(v_from,(now() at time zone ''Asia/Bangkok'')::date-1); /* previous_bangkok_business_day_across_month_v1 */';
begin
  definition := pg_get_functiondef(
    'public.queue_due_daily_recon_jobs_with_late_bbl_full_queue(date,date)'::regprocedure
  );

  if position(new_scope in definition) > 0 then
    return;
  end if;

  if position(old_scope in definition) = 0 then
    raise exception 'queue date-scope anchor not found; refusing an unsafe patch';
  end if;

  patched := replace(definition, old_scope, new_scope);

  if patched = definition
     or position(old_scope in patched) > 0
     or position(new_scope in patched) = 0 then
    raise exception 'queue date-scope patch did not apply exactly';
  end if;

  execute patched;
end
$block$;

comment on function public.queue_due_daily_recon_jobs_with_late_bbl_full_queue(date,date) is
  'Queues only the current operating business day; includes the previous Bangkok day across a month boundary.';

commit;
