# Read and worker load budget

## Changes prepared
- New sessions start at Day-1 in Asia/Bangkok. Saved user ranges are preserved. Historical
  filters, exports, ingestion and adjacent-day matching are unchanged.
- Cloud and company-owned screens no longer start the unrelated global overview
  during authenticated entry.
- Current exception reads include date/company predicates, deterministic ordering
  and sequential pages. A failed page rejects the entire call, never returns an
  apparently complete partial success. Stop once a short page is reached.
- Matching evidence reads project only `summary->match_evidence`, ten runs per
  sequential request, rather than entire summaries for 100 runs.
- Dispatcher waits for its child, pauses five seconds between jobs, and limits
  idempotent queue reads/refreshes to two attempts ten seconds apart. Claim/save
  writes are not automatically retried after an ambiguous timeout.
- SQL claim patch preserves production newest-day/manual-rerun ordering and stale
  recovery; serializes claims globally even with different worker names; one job
  per claim. Existing running jobs are not canceled. A stale job owned by another
  worker intentionally needs operator review rather than unsafe takeover.
- A separate concurrent partial index is prepared for current-row ordering.

## Release gate (not yet deployed)
1. Review and approve frontend, SQL and n8n deployment separately from test results.
2. Recheck database function/index definitions; save rollback definition.
3. Build index outside transaction, verify indisvalid and authorized query plan.
4. Apply claim function; inspect definition and test two concurrent workers in a
   non-production database with synthetic jobs (never claim real jobs as a test).
5. Import only the focused dispatcher changes into the current live workflow,
   retaining live trigger settings, credentials, identifiers and notification paths.
   Do not overwrite live workflow with an old generated export wholesale.
6. Publish frontend, verify live asset hashes, fresh entry plus selected historical
   day. Run a synthetic upload/case workflow in staging, not real customer writes.

## Limitations
No claim that these changes alone cure all timeouts. RLS query cost, I/O, CPU,
locks and pool connections require measurement. Old saved broad date ranges stay
broad until the user selects a narrower range. Existing live SQL/n8n are unchanged
until release approval. Queue refresh retry depends on the existing idempotent
queue function, and is not used for claim or financial writes.
