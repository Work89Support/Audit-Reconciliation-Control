-- Atomically claim distinct jobs in one RPC call.
-- This avoids nested-loop item-linking from reusing the first claimed job.

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
begin
  return query
  with picked as (
    select j.id
    from public.daily_recon_jobs j
    where j.status='queued' and j.attempt_count<3
    order by j.business_date,j.company,j.updated_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,5),20))
  ), updated as (
    update public.daily_recon_jobs j
       set status='running',claimed_at=now(),claimed_by=coalesce(nullif(p_worker,''),'n8n-cloud-worker'),
           attempt_count=j.attempt_count+1,last_error=null,updated_at=now()
      from picked p
     where j.id=p.id
    returning j.*
  )
  select * from updated order by business_date,company;
end $$;

revoke all on function public.claim_daily_recon_jobs(text,integer) from public;
grant execute on function public.claim_daily_recon_jobs(text,integer) to authenticated;

-- Recover only jobs claimed by the failed batch test; no completed result points to them.
update public.daily_recon_jobs j
set status='queued',claimed_at=null,claimed_by=null,last_error='กู้คิวหลังแก้การจองงานแบบ batch',updated_at=now()
where j.status='running' and j.claimed_by='n8n-cloud-worker'
  and not exists (
    select 1 from public.recon_runs r
    where r.summary->>'job_id'=j.id::text
      and r.created_at>=j.claimed_at
  );

commit;
