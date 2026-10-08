-- Upload metadata/read-back performance only. No RLS changes or case updates.
-- Standalone commands: do not wrap CONCURRENTLY in a transaction.
-- Inspect pg_indexes/pg_index first. An existing invalid index needs explicit
-- administrator repair; IF NOT EXISTS is not proof that an index is valid.
create index concurrently if not exists exceptions_evidence_id_text_idx
 on public.exceptions ((id::text));
create index concurrently if not exists case_evidence_exception_created_idx
 on public.case_evidence (exception_id,created_at);
-- Verify indisvalid and EXPLAIN under the actual role before claiming resolved.
