# Manual BO + original STM page review

Approved scope: permit sending a BO case with a stored original STM file and
page number when parsed STM rows are absent. Do not invent STM amounts, apply
automatic amount/date/customer matching gates, or automatically close cases.

Implemented in `cross-day-workbench.js`, `statement-preview.js`, `supabase.js`
and `supabase/20261009_cross_day_image_review.sql`:

- Optional request reason with a default; prepare several image references and
  send one at a time, preserving other drafts and stable UUIDs after timeout.
- Image requests appear in pending and approved history. Amount remains unknown.
- Head reviewer must be a different authorized user, open the original PDF,
  confirm visual checking and record a decision. An unreadable PDF cannot be
  approved from the UI. Rejection remains possible if the PDF cannot open.
- SQL reserves the BO case and freezes its source while pending, checks company
  permissions, current run and Storage eTag, and records actor/time/decision.
- A PDF page is not a transaction identity: two legitimate same-amount lines may
  share a page. STM transaction reuse across visual/native modes is not provable
  automatically; the head reviewer must check the existing approved evidence.

Verification: JS syntax, image preparation/retry mock tests, existing cross-day
unit tests, npm test, attachment mocks and UI QA suite passed. Browser harness
uses synthetic BO/PDF previews and mock receipts, not production writes.

Additional verification on 2026-10-09:

- Executed the actual migration in ephemeral PostgreSQL (PGlite 0.5.8), with
  synthetic fixtures and the existing native request guard. Permissions/RLS,
  no self-approval, idempotence, immutable BO amounts, rejection recovery, stable
  BO reservation across runs, identical-rerun preservation and changed-file/BO
  denials passed. This is not the full Supabase stack or multi-session testing.
- Read production exception triggers and relevant column types before install.
- Added a separate after-update job trigger to preserve an existing head image
  decision only for a single identical BO source and unchanged stored PDF eTag.
  No existing finish function is replaced and no native STM row is fabricated.

Release order and limitations:

1. Synthetic PostgreSQL tests passed. Full Supabase integration and real
   multi-session concurrency have not been tested; do not claim otherwise.
2. BO identity is reserved across image requests. STM row reuse is a human
   review check, because an unreadable page has no exact machine row identity.
3. Deploy database before client: the merged queue reads the new table and will
   report an error if it is absent. Do not silently turn that error into empty.
4. Production release was explicitly requested. Isolate these files from the
   unrelated pending BBL parser/migration work, then live smoke-test read-only.

No production case submission or closure is part of release verification.
