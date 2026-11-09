-- A new reconciliation result must not invalidate a pending head-review request.
-- Keep the requested case and its evidence unchanged. When exactly one new
-- physical case represents it, hide that duplicate until the request is decided.
begin;

do $migration$
declare
  definition text := pg_get_functiondef('public.finish_daily_recon_job(uuid,uuid)'::regprocedure);
  old_key_clause constant text :=
    'where not public.worker_primary_scope_protected(e.company,e.business_date) and e.run_id=v_old_run_id and e.lifecycle_key is null and e.status in (''open'',''clarifying'',''answered'');';
  old_candidates_clause constant text :=
    'where not public.worker_primary_scope_protected(e.company,e.business_date) and e.run_id=v_old_run_id and e.status in (''open'',''clarifying'',''answered'') and e.superseded_by_exception_id is null;';
  patched_key_clause constant text :=
    'where not public.worker_primary_scope_protected(e.company,e.business_date) and e.run_id=v_old_run_id and e.case_closure_request_id is null and e.lifecycle_key is null and e.status in (''open'',''clarifying'',''answered'');';
  patched_candidates_clause constant text :=
    'where not public.worker_primary_scope_protected(e.company,e.business_date) and e.run_id=v_old_run_id and e.case_closure_request_id is null and e.status in (''open'',''clarifying'',''answered'') and e.superseded_by_exception_id is null;';
  before_preserve constant text := 'perform public.preserve_approved_case_closures(p_run_id,true);';
  preserve_pending constant text := $sql$
    -- The pending request still points to the original exception and its
    -- signed snapshot (including run_id). Do not modify either one.
    update public.exceptions n
       set previous_exception_id=o.id,
           superseded_by_exception_id=o.id,
           updated_at=now()
      from public.exceptions o
      join public.case_closure_requests q
        on q.id=o.case_closure_request_id and q.status='pending'
     where o.run_id=v_old_run_id
       and n.run_id=p_run_id
       and n.status='open'
       and n.case_closure_request_id is null
       and n.superseded_by_exception_id is null
       and n.lifecycle_key=o.lifecycle_key
       and (select count(*) from public.exceptions x
             where x.run_id=p_run_id and x.lifecycle_key=o.lifecycle_key)=1
       and (select count(*) from public.exceptions x
             join public.case_closure_requests cq on cq.id=x.case_closure_request_id
             where x.run_id=v_old_run_id and x.lifecycle_key=o.lifecycle_key
               and cq.status='pending')=1;
  $sql$;
begin
  -- This migration was already applied to Production during 3XB recovery.
  -- A later migration replay must leave the same function unchanged.
  if strpos(definition, patched_key_clause)>0
     and strpos(definition, patched_candidates_clause)>0
     and strpos(definition, preserve_pending)>0 then
    return;
  end if;
  if strpos(definition, old_key_clause)=0
     or strpos(definition, old_candidates_clause)=0
     or strpos(definition, before_preserve)=0 then
    raise exception 'Unexpected finish_daily_recon_job version; inspect before applying';
  end if;
  definition := replace(definition, old_key_clause, patched_key_clause);
  definition := replace(definition, old_candidates_clause, patched_candidates_clause);
  definition := replace(definition, before_preserve,
    preserve_pending || before_preserve);
  execute definition;
end
$migration$;

comment on function public.finish_daily_recon_job(uuid,uuid) is
  'Promotes a reconciliation run while preserving approved closures and pending head-review requests.';

notify pgrst, 'reload schema';
commit;
