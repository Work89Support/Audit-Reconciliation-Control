-- Closed cases with an approved head-review request are immutable evidence.
-- They are not candidates for carry-forward, so the worker must not backfill
-- lifecycle_key on them while promoting a newer reconciliation run.
begin;

do $migration$
declare
  definition text;
  old_clause constant text :=
    'where not public.worker_primary_scope_protected(e.company,e.business_date) and e.run_id=v_old_run_id and e.lifecycle_key is null;';
  new_clause constant text :=
    'where not public.worker_primary_scope_protected(e.company,e.business_date) and e.run_id=v_old_run_id and e.lifecycle_key is null and e.status in (''open'',''clarifying'',''answered'');';
begin
  definition := pg_get_functiondef('public.finish_daily_recon_job(uuid,uuid)'::regprocedure);
  if strpos(definition, old_clause) = 0 then
    raise exception 'finish_daily_recon_job definition is not the expected production version';
  end if;
  if strpos(replace(definition, old_clause, ''), old_clause) > 0 then
    raise exception 'finish_daily_recon_job contains more than one old lifecycle clause';
  end if;
  execute replace(definition, old_clause, new_clause);
end
$migration$;

comment on function public.finish_daily_recon_job(uuid,uuid) is
  'Promotes a verified reconciliation run while preserving immutable closed/head-reviewed case history.';

notify pgrst, 'reload schema';
commit;
