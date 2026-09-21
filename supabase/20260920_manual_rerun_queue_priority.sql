-- Give explicit manual reruns priority over background parse retries.
-- This prevents an old unread attachment from monopolising the single worker.

begin;

create or replace function public.claim_daily_recon_jobs(
  p_worker text default 'n8n-cloud-worker',
  p_limit integer default 5
)
returns setof public.daily_recon_jobs
language plpgsql
security definer
set search_path=public
as $$
declare v_worker text:=coalesce(nullif(p_worker,''),'n8n-cloud-worker');
begin
  if not pg_try_advisory_xact_lock(hashtext('daily-recon-worker-claim')) then return; end if;

  update public.daily_recon_jobs j
  set status='queued',claimed_at=null,claimed_by=null,
      last_error='คืนคิวอัตโนมัติหลัง worker timeout',updated_at=now()
  where not j.is_archived
    and j.status='running'
    and j.claimed_by=v_worker
    and j.claimed_at<now()-interval '30 minutes'
    and not exists (
      select 1 from public.recon_runs r
      where r.summary->>'job_id'=j.id::text and r.created_at>=j.claimed_at
    );

  if exists(
    select 1 from public.daily_recon_jobs
    where not is_archived and status='running' and claimed_by=v_worker
  ) then return; end if;

  return query
  with picked as (
    select j.id
    from public.daily_recon_jobs j
    where not j.is_archived and j.status='queued' and j.attempt_count<3
    order by
      (j.rerun_requested_at is not null) desc,
      j.rerun_requested_at desc nulls last,
      j.business_date,
      j.company,
      j.updated_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,5),20))
  ), updated as (
    update public.daily_recon_jobs j
    set status='running',claimed_at=now(),claimed_by=v_worker,
        attempt_count=j.attempt_count+1,last_error=null,updated_at=now()
    from picked p where j.id=p.id returning j.*
  )
  select * from updated
  order by
    (updated.rerun_requested_at is not null) desc,
    updated.rerun_requested_at desc nulls last,
    updated.business_date,
    updated.company;
end;
$$;

revoke all on function public.claim_daily_recon_jobs(text,integer) from public;
grant execute on function public.claim_daily_recon_jobs(text,integer) to authenticated;

-- A parse-only run consumes the explicit rerun request too. Otherwise one
-- unread attachment keeps manual priority and monopolises every worker cycle.
create or replace function public.finish_daily_recon_parse_only(
  p_job_id uuid
)
returns public.daily_recon_jobs
language plpgsql
security definer
set search_path=public
as $$
declare
  v_job public.daily_recon_jobs%rowtype;
begin
  select * into v_job
  from public.daily_recon_jobs
  where id=p_job_id
  for update;
  if not found then
    raise exception 'daily reconciliation job not found: %',p_job_id;
  end if;

  select * into v_job
  from public.refresh_daily_recon_job(v_job.business_date,v_job.company);

  update public.daily_recon_jobs
  set status=case
        when error_count>0 then 'needs_review'
        when jsonb_array_length(missing_groups)>0 then 'waiting_files'
        else 'ready'
      end,
      claimed_at=null,
      claimed_by=null,
      rerun_requested_at=null,
      last_error=case
        when error_count>0 then last_error
        when jsonb_array_length(missing_groups)>0
          then 'อ่านไฟล์ที่ได้รับแล้ว · รอไฟล์อีกฝั่งก่อนกระทบยอด'
        else null
      end,
      updated_at=now()
  where id=p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.finish_daily_recon_parse_only(uuid) from public;
grant execute on function public.finish_daily_recon_parse_only(uuid) to authenticated;

commit;
