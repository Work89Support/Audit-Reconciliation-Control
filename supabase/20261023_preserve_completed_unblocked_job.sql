-- Refreshing derived file requirements must not demote an accepted automatic
-- result when the live preflight says the current run is still safe. New
-- unparsed files can still move the job to queued in queue_due_daily_recon_jobs.
create or replace function public.preserve_completed_unblocked_job()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  review jsonb;
begin
  if old.status='completed'
     and new.status in ('ready','waiting_files','needs_review')
     and old.last_run_id is not null
     and new.last_run_id is not distinct from old.last_run_id then
    review:=public.audit_run_preflight_review(old.company,old.business_date);
    if not coalesce((review->>'blocked')::boolean,true) then
      new.status:='completed';
      new.completed_at:=coalesce(old.completed_at,new.completed_at);
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists preserve_completed_unblocked_job on public.daily_recon_jobs;
create trigger preserve_completed_unblocked_job
before update of status on public.daily_recon_jobs
for each row execute function public.preserve_completed_unblocked_job();

revoke all on function public.preserve_completed_unblocked_job() from public,anon,authenticated;
grant execute on function public.preserve_completed_unblocked_job() to service_role;

