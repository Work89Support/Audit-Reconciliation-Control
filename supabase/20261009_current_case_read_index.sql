-- Production index definitions inspected 2026-10-09: no equivalent current-row
-- ordering index found. Recheck equivalence and validity immediately before run.
-- Run standalone, outside BEGIN. Does not modify cases, RLS or approval policy.
create index concurrently if not exists exceptions_current_run_order_idx
 on public.exceptions (run_id,business_date desc,occurred_at desc,id desc)
 where superseded_by_exception_id is null;
-- Verify pg_index.indisvalid and EXPLAIN under the actual authorized role.
-- Do not retry blindly after timeout: an invalid build may still exist.
