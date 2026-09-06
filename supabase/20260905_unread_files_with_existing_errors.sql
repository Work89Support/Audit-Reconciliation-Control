-- Let unread supported attachments be parsed even when another file in the
-- same job failed. Preserve the existing function, privileges and all gates
-- that prevent incomplete reconciliation results from being published.
begin;
do $migration$
declare
  original_definition text := pg_get_functiondef('public.queue_due_daily_recon_jobs(date,date)'::regprocedure);
  updated_definition text;
begin
  if original_definition not like '%and f.parse_error is null%'
     or original_definition not like '%and not coalesce(f.parsed,false)%' then
    raise exception 'Unexpected queue definition: unread-file safeguards missing';
  end if;
  updated_definition := regexp_replace(
    original_definition,
    'and j\.error_count=0[[:space:]]+and exists',
    'and exists'
  );
  if updated_definition = original_definition then
    if original_definition ~ 'j.status in \([^)]*needs_review[^)]*\)[[:space:]]+and exists' then
      return; -- Already installed; leave privileges and function untouched.
    end if;
    raise exception 'Expected unread-file gate not found; inspect before applying';
  end if;
  execute updated_definition;
end;
$migration$;
commit;
