# Manual recheck and immutable file management

## User authorization

Provide both comparison-only rechecks and account-specific reconciliation.
Only an active `lead` or `admin` with company access may confirm results.
Assistant closure authority does **not** imply confirmation authority.

## Current implementation boundary

The implementation creates isolated account jobs and records a separate confirmed
account report. Accepted reports appear as an additional section/sheet in the
workbook, daily summary and Excel. They do not replace the full company-day run,
transfer approvals by amount, or create/close cases. The UI states this boundary.

The source, case and existing run records are read-only. No source amounts are
changed. No case is created, closed, reopened or approved by the staged worker.
An accepted account result must not automatically close existing cases.

## Included

- Request controls on the real Audit workbook view with canonical account choices.
- Immediate authenticated Edge Function → private n8n webhook.
- Parser and reconciliation code reused from the checked-in headless workflow.
- Filter both Engine and Rules input by company/account/direction before matching.
- Worker output goes only to staged jobs, not `exceptions` or `recon_runs`.
- Request-key idempotency and conservative company-day busy index.
- RLS company-access reads and revoked direct authenticated mutations.
- Server-side confirmation restricted to `lead`/`admin`, independent of UI role.
- Mandatory review, reason, latest revision, complete result and source/case/base
  snapshot equality checked transactionally at confirmation time.
- Historical source/results retained and Audit Log appended on request/confirmation.
- Explicit file-id selection, including newly received files, with server scope and
  duplicate-checksum rejection. `ALL` supports reviewing all accounts in chosen files.
- Append-only file name/company/date/type corrections, quarantine, choosing an
  existing replacement and uploading a new immutable replacement receipt.
- Company-day holds, both old/new scopes held after corrections, stale draft
  invalidation, automatic-worker claim exclusion and per-write service guards.
- Managed-source RPC used by both automatic and staged workers, preserving the
  existing adjacent-day KTB/BBL evidence selector and replacement OCR identity.

## Verification on 2026-10-12

- New Node policy/scope/workflow checks pass.
- Real local-browser fixtures verified selecting three files, renaming into version
  two, retaining history and pausing the dummy job. Assistant edit/resume buttons
  remained disabled. No business record was submitted.
- Live database migrations ran inside a transaction ending in ROLLBACK. Tables,
  RLS mutation revocations, anon worker denial and the worker claim gate compiled
  and were inspected. A subsequent read confirmed all three new tables absent and
  the original claim function restored. This is not a production installation or
  authenticated end-to-end role/worker execution test.

## Deployment safeguards

1. PostgreSQL fixture tests run the actual migrations with synthetic role claims:
   inactive/wrong-company/Audit/shift-lead/executive denial, request/delivery
   idempotency, leases, stale Storage version, immutable upload retry and preserved
   closed-case JSON. This is not a real Audit/head-user login test.
2. Server schema and the Edge Function are installed. The private Header Auth
   credential and matching Edge secrets were created after explicit authorization.
   No secret value is stored in this repository or returned to the browser.
3. Production manual worker `bAhaQiTdEkuXF2bC` has a 1500-second timeout, no saved
   execution payloads and failure finalizer `a8n47yZqfwyBkPDo`. It has no financial
   write/closure nodes. Five-minute queue and thirty-minute execution leases reject
   late callbacks. Unknown delivery outcomes reuse the same request key.
4. Live automatic worker `dmQDrxLA7q2yAqCn` was backed up before changing exactly
   the file reader and physical-file identity selector. Connections and settings
   remained unchanged. Existing scoped October SCB adjacent-source exceptions are
   preserved in the live selector and effective-source reader.
5. Corrections append history and hold both affected company/day scopes. Original
   receipts remain immutable. Resume after a correction requires a current
   confirmed ALL/all report. A new source/case/evidence snapshot invalidates drafts.
6. QA must not confirm actual reports, change original files or close actual cases.
   Fixture UI screenshots must be labeled as synthetic, not real-user proof.

## Live read-only QA on 2026-10-12

- GitHub Pages and regression CI passed for the guided controls and nonce guard.
- The real administrator selected only 3XB BO plus AUTOPEER/ATP withdrawal PM,
  2026-10-10. The staged worker returned 529 STM/PM rows, 529 BO rows and 529
  matched pairs, with zero staged exceptions. The result remains `ready`.
- A first attempt failed at the n8n completion expression. The failure finalizer
  safely marked it failed; the expression was fixed, published and successfully
  retested. Historical failed attempts were retained, not deleted.
- The administrator's confirmation button enabled only after review/reason.
  The final browser confirmation was opened and cancelled. No real report was
  confirmed and no real case was closed.
- Before/after SQL checks: original run ID/status unchanged, all 100 case JSON
  records and all 17 original source-file JSON records had identical digests.
  There is one ready additional report and zero confirmed reports for this scope.
- File corrections/uploads/holds were tested on synthetic fixtures and real
  migration rollback, not by correcting live financial source files during QA.
- Manual rechecks require an existing company-day run for comparison. Incomplete
  or missing selected STM/PM/BO sources fail closed rather than become zero activity.

## Build and local checks

`node scripts/build-account-recheck-worker.mjs`

`node tests/account-recheck.test.cjs`

Generated JSON uses `active:false` for safe import. n8n import does not apply
workflow settings: configure them in the UI and export/verify before publishing.
Importing JSON into an existing canvas appends nodes; undo rather than publish a
duplicated canvas. For live updates, edit only reviewed nodes and compare exports.
The user's primary dirty worktree remains unchanged.
