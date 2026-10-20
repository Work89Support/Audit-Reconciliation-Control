# Context-first cross-day intake policy

This patch does not rerun jobs, release held drafts, confirm primary results,
backfill file classifications, edit amounts, close cases or change holds.

New receipts outside BO, bank STM and provider PM are classified as clarification
evidence. The original incoming kind is retained in `intake_original_kind`.
Original names and bytes remain unchanged. Explicit later source revisions still
allow a human-reviewed, incorrectly named file to be used in its intended role.

A new worker report with normal cross-day rows may proceed when the rows have a
cross-day type and a traceable file/row identity. Dates and timestamps are never
rewritten. Core parser errors, wrong-company sources, existing holds, unverified
cross-day context and protected historical manual-primary scopes still stop it.
The existing matching/bank rules and subsequent Quality Gate are not bypassed.

Persisted cross-day results are informational in preflight. Historical held
drafts remain blocking until a separate human decision; AT4/FR8 2026-10-19 must
not be auto-released or replayed as a side effect of this policy installation.

Installation uses exact guarded function patches and is idempotent. No broad
reclassification of historical files is part of this migration. Future receipt
classification applies centrally at the database insert boundary, irrespective
of the ingestion workflow version.

Verify with `tests/context-cross-day-policy-db.test.mjs` using a disposable PGlite
database and `tests/preflight-review-ui.test.cjs`. Synthetic cases cover all nine
companies. Do not invoke worker staging with real jobs as a production test.
