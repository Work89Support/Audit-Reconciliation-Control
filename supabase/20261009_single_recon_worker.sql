-- Based on the production definition inspected 2026-10-09.
-- Keep manual rerun priority, newest-day order and existing stale recovery.
-- Limit ALL worker names to one running job; no source/case/history writes.
begin;
create or replace function public.claim_daily_recon_jobs(
 p_worker text default 'n8n-cloud-worker', p_limit integer default 5
) returns setof public.daily_recon_jobs
language plpgsql security definer set search_path=public as $$
declare v_worker text:=coalesce(nullif(p_worker,''),'n8n-cloud-worker');
begin
 if not pg_try_advisory_xact_lock(hashtext('daily-recon-worker-claim')) then return; end if;
 update public.daily_recon_jobs j
 set status='queued',claimed_at=null,claimed_by=null,
     last_error='คืนคิวอัตโนมัติหลัง worker timeout',updated_at=now()
 where not j.is_archived and j.status='running' and j.claimed_by=v_worker
   and j.claimed_at<now()-interval '30 minutes'
   and not exists(select 1 from public.recon_runs r
     where r.summary->>'job_id'=j.id::text and r.created_at>=j.claimed_at);
 if exists(select 1 from public.daily_recon_jobs
   where not is_archived and status='running') then return; end if;
 return query
 with picked as (
   select j.id from public.daily_recon_jobs j
   where not j.is_archived and j.status='queued' and j.attempt_count<3
   order by (j.rerun_requested_at is not null) desc,
     j.rerun_requested_at desc nulls last,j.business_date desc,j.company,j.updated_at
   for update skip locked limit 1
 ), updated as (
   update public.daily_recon_jobs j
   set status='running',claimed_at=now(),claimed_by=v_worker,
       attempt_count=j.attempt_count+1,last_error=null,updated_at=now()
   from picked p where j.id=p.id returning j.*
 ) select * from updated;
end; $$;
-- Existing owner, ACL, SECURITY DEFINER and RLS remain unchanged.
commit;
