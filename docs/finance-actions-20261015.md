# Action ledger

Additive follow-up register for remediation, finance notification and reported recovery. It never updates original cases, amounts, financial receipts, or approval/closure status. A recovery Action is a documented follow-up claim, not an accounting receipt or a money transfer. Notification does not imply finance acknowledgment.

Lead/Admin can write only for explicitly permitted active companies (Admin all active). Executive is read-only. Assignment is limited to active company-scoped users/Admin. The case can be closed or historical; its original status is unchanged. Date must be between incident date and today (Thailand).

Each save appends an event. Latest step is done or reopened; prior records and proofs remain. Required: owner, action date, note, confirmation and 1–10 actual uploaded proof files for done. Reopening requires a reason and never erases prior evidence. Client retries use the same request UUID/payload. Server also locks case-step and rejects stale expected event IDs.

Files are in the private `finance-action-evidence` bucket, never the recon source registry. SHA-256 source deduplication per case, no upsert, exact object size checks, scoped read and uploader-only insert. Restrictive bucket guards deny modification/deletion even if older permissive policies exist. No automatic importing of old case documents as proof of a new Action.

Executive report shows latest current Action state for incidents up to selected end date, including closed/historical cases. The Action table counts steps, not financial totals. PNG/SVG include same company scope, dates, responsible IDs, proof counts; no signed URLs. Details expose temporary scoped proof URLs only on explicit request. Report refresh never runs inside an open Action draft; manual refresh/tab changes are blocked until saved or the user explicitly leaves the draft. Permission revocation always removes protected data even when a draft exists.

Tests: `node tests/finance-actions.test.cjs`; `node tests/finance-actions-db.test.mjs <PGlite module>`. DB tests use isolated synthetic records, verify RLS despite a legacy broad storage policy, idempotency, version conflict, proof dedupe, history and byte-for-byte unchanged old tables. Live verification must not save Actions, upload sample evidence or modify real cases.
