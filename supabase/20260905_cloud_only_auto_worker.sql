-- Retire only the legacy browser claim endpoint. Stale open browser tabs
-- receive no job, rather than claiming and failing it under user-scoped RLS.
-- The n8n atomic batch endpoint claim_daily_recon_jobs remains unchanged.
begin;
create or replace function public.claim_daily_recon_job(p_worker text default 'web-worker')
returns public.daily_recon_jobs
language sql security definer set search_path=public
as $$ select null::public.daily_recon_jobs; $$;
comment on function public.claim_daily_recon_job(text) is
  'Deprecated browser executor: automatic jobs are owned by n8n claim_daily_recon_jobs.';
commit;
