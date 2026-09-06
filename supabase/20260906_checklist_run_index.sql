-- Performance only. No data deletion, RLS change, or financial-status update.
-- Run separately (not inside a transaction) to avoid blocking normal writes.
create index concurrently if not exists exceptions_run_status_lookup_idx
  on public.exceptions (run_id, status);
