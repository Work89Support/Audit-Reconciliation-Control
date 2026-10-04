-- Follow-up is case review, NEVER a retry of the original company/day.
-- Preserve accepted runs, source files, totals, case identities and permissions.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $guard$
declare definition text;
begin
  definition:=pg_get_functiondef('public.queue_previous_recon_day_followup()'::regprocedure);
  if position('retry_daily_recon_job' in definition)=0
    and position('cross_day_evidence_only' in definition)=0 then
    raise exception 'Unexpected follow-up definition; inspect before replacing';
  end if;
end $guard$;

create or replace function public.queue_previous_recon_day_followup()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_window jsonb:=public.recon_previous_day_followup_window();
  v_main date:=(v_window->>'main_day')::date;
  v_target date:=(v_window->>'followup_day')::date;
  v_ready integer; v_expected integer; v_review jsonb;
begin
  if not (v_window->>'enabled')::boolean then
    return v_window||jsonb_build_object('queued',0,'mode','cross_day_evidence_only',
      'reason','before_start_or_10am');
  end if;
  if not pg_try_advisory_xact_lock(hashtext('previous-recon-day-followup')) then
    return v_window||jsonb_build_object('queued',0,'mode','cross_day_evidence_only','reason','busy');
  end if;
  select count(*),count(*) filter(where j.status='completed' and j.error_count=0
    and rr.summary->>'source_parser_completion'='true')
    into v_expected,v_ready
  from public.daily_recon_jobs j left join public.recon_runs rr on rr.id=j.last_run_id
  where j.business_date=v_main and not j.is_archived;
  if v_expected=0 or v_ready<>v_expected then
    return v_window||jsonb_build_object('queued',0,'mode','cross_day_evidence_only',
      'reason','wait_main_day_complete','main_companies_completed',v_ready,
      'main_companies_expected',v_expected);
  end if;
  if exists(select 1 from public.daily_recon_jobs where not is_archived and status in('queued','running')) then
    return v_window||jsonb_build_object('queued',0,'mode','cross_day_evidence_only','reason','wait_existing_queue');
  end if;
  -- Reviewer only reads accepted evidence and updates existing cross_day cases.
  -- If proof is missing/ambiguous, retain the case; do not regenerate a run.
  v_review:=public.review_cross_day_backlog(v_target);
  return v_window||jsonb_build_object('queued',0,'mode','cross_day_evidence_only',
    'reason','review_existing_cross_day_cases','review',v_review);
end $$;
-- CREATE OR REPLACE retains existing service_role-only execution grants.
-- A new attachment for an already accepted older day is review evidence, not
-- permission to overwrite that day's result. Current main-day reruns still work.
do $protect$
declare definition text; patched text;
begin
  definition:=pg_get_functiondef('public.refresh_daily_recon_job(date,text)'::regprocedure);
  if position('historical_completed_evidence_only' in definition)=0 then
    patched:=regexp_replace(definition,
      'elsif\s+v_old.status=''completed''\s+and\s+v_files>0',
      E'-- historical_completed_evidence_only\n elsif v_old.status=''completed'' and p_business_date<(now() at time zone ''Asia/Bangkok'')::date-1 then\n  v_status:=''completed'';\n elsif v_old.status=''completed'' and v_files>0');
    if patched=definition then raise exception 'Unexpected refresh function; inspect before protecting historical result'; end if;
    execute patched;
  end if;
  definition:=pg_get_functiondef('public.queue_due_daily_recon_jobs(date,date)'::regprocedure);
  if position('historical_auto_queue_evidence_only' in definition)=0 then
    patched:=replace(definition,
      'v_from:=greatest(v_from,date_trunc(''month'',current_date)::date);',
      E'-- historical_auto_queue_evidence_only\n v_from:=greatest(v_from,date_trunc(''month'',current_date)::date,(now() at time zone ''Asia/Bangkok'')::date-1);');
    if patched=definition then raise exception 'Unexpected auto queue function; inspect before restricting historical auto retries'; end if;
    execute patched;
  end if;
end $protect$;
-- No one-shot review, bulk case repair, cancellation or result replacement here.
commit;
