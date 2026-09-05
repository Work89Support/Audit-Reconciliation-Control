-- Read-only preflight. No files, runs, evidence, or case statuses are changed.
-- Deploy n8n/audit-headless-worker.json (worker 1.4.5) before retrying jobs.
-- This explicit historical window excludes the unfinished current day.
select j.business_date, j.company, j.id as job_id,
       j.status, j.file_count, j.parsed_count, j.error_count,
       j.attempt_count, j.last_error, j.last_run_id,
       j.claimed_at, j.claimed_by, j.rerun_requested_at
from public.daily_recon_jobs j
where j.business_date between date '2026-08-30' and date '2026-09-03'
  and not coalesce(j.is_archived, false)
  and j.company in ('3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9')
order by j.business_date, j.company;

-- After inspecting each job and confirming the deployed worker, use the
-- existing retry_daily_recon_job(job_id) operation for the reviewed targets.
-- Do not reset a running claim, delete an old run, or mark a case closed.
