-- Keep the all-company Audit Sheet aligned with v_current_exceptions.
-- The original checklist function predates exception lifecycle carry rows and
-- therefore counted audit-history copies as current exceptions.
do $migration$
declare
  definition text;
  old_fragment constant text := 'from public.exceptions where run_id=j.last_run_id';
  new_fragment constant text := E'from public.exceptions\n    where run_id=j.last_run_id\n      and superseded_by_exception_id is null\n      and code not like ''%-C%''';
begin
  select pg_get_functiondef(
    'public.audit_daily_checklist(date,date,text,integer)'::regprocedure
  ) into definition;

  if position(new_fragment in definition) > 0 then
    return;
  end if;

  if position(old_fragment in definition) = 0 then
    raise exception 'audit_daily_checklist definition is not the expected version';
  end if;

  execute replace(definition, old_fragment, new_fragment);
end
$migration$;

notify pgrst, 'reload schema';
