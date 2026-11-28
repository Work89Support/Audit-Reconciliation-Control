# Duplicate files before the first reconciliation attempt

Both the Cloud inbox and file manager read effective source versions. Mail labels are retained as original metadata; the effective file company/date control filtering. Received-file counts include evidence; selected counts only include usable reconciliation inputs.

A lead/admin may classify one exact duplicate as evidence or exclude it before any attempt, claim, report, manual review or case exists. Storage ETag and actual object sizes must match a remaining active copy in the same company/day and input kind. Filename, time, sender or amount equality is insufficient. Original files and revision history remain intact. The normal queue is retained; this action does not start a run or accept a result.

Other corrections retain the existing hold/review process. Once work has begun, the exception cannot apply. Existing holds are never automatically released by installation. A historic duplicate hold requires a separately checked repair under the same job lock; results, cases, approvals and evidence must remain unchanged.

Apply `supabase/20261128_prerun_duplicate_file_selection.sql` before deploying the client. It creates metadata columns, guarded functions and a revision classifier only; it does not repair or run a real company. Rollback the client before removing the inbox RPC. Retain revision fields and original evidence.

Validation: `node tests/prerun-duplicate-selection-db.test.mjs <PGlite module>` plus `npm test`, `npm run test:file-run-management` and `node tests/file-snapshot.test.mjs`. Fixtures are synthetic and cover all nine companies, mismatched mail labels, exact bytes, final-copy protection, stale revisions, roles, previous work and closed cases.
