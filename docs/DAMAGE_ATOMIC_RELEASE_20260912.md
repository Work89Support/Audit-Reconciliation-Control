# Confirmed damage release gate — 2026-09-12

Database function/index installed and verified on production on 2026-09-12 after explicit user approval. The frontend and n8n changes have NOT been deployed as part of this migration; no historical processing is claimed.

## Approved production installation result

- User approved rollback testing and production installation after disclosure of possible temporary table locking.
- DDL compile and unauthenticated-call rejection test passed with rollback. A separate query confirmed both function and index absent afterward, with damage count 0.
- Installed `public.confirm_damage(uuid,text,numeric,text)` and `damages_one_per_exception_idx`; lock timeout 5 seconds and per-statement timeout 15 seconds during installation.
- Verified function uses SECURITY INVOKER; unique index is valid and ready.
- Supabase default privileges explicitly granted anon EXECUTE despite revoking PUBLIC. Revoked anon explicitly and updated the migration/test accordingly. Final verification: anon EXECUTE false; authenticated EXECUTE true. Runtime active lead/admin and company checks remain in the function.
- Damage count remains 0. No real or synthetic loss was inserted, no case was closed, and no notifications were sent.
- This is NOT an authenticated end-to-end write test, concurrent-request test, or frontend release. Those release checks remain outstanding; do not describe the entire workflow as verified.

## Live read-only preflight (2026-09-12)

- Production `damages`: 0 rows, 0 duplicate exception IDs.
- At preflight, `confirm_damage(uuid,text,numeric,text)` was not installed.
- Existing damage INSERT/UPDATE policies permit lead/admin with company access; SELECT requires an active user and company access.
- Inspected triggers on damage/exception tables: exception timestamp touch only.
- The first attempted rollback-only DDL test was blocked before execution. After explicit user approval, the retry and installation succeeded as recorded above.
- No production loss, case closure, or notification was created.

## Changes

- `confirm_damage` performs the damage insert and exception status update in one database transaction under caller RLS.
- Only active lead/admin users with company access may call it. Evidence must exist in the case registry or a linked clarification source file.
- Amount/category/reason are explicitly confirmed by Audit; no reconciliation difference becomes a loss automatically.
- Exception row lock plus one-per-exception unique index protects against concurrent duplicate inserts. The migration aborts if existing duplicates conflict; it does not delete or merge them.
- Repeating the same amount/cause for an already-confirmed damage returns its existing row; conflicting retries fail.
- The UI changes local status only after the RPC confirms success. No legacy two-write fallback exists. No HR/finance notification is sent.

## Required release sequence

1. Validate migration against a test database with the existing schema and RLS. Test unauthorized users, missing evidence, changed status, invalid amounts, identical/conflicting retries and simultaneous requests. Source-contract tests do not replace these database tests.
2. Check existing duplicate exception IDs in `damages`; never remove financial records to force migration success.
3. Apply `supabase/20260912_confirm_damage_atomic.sql` before releasing the new frontend. If the function is missing, the client fails closed rather than making a partial write.
4. Publish only reviewed changes, then verify with a designated Audit-approved case. Do not create a fake production loss for testing.

## Still outside this completed local change

- Live n8n publication and scoped historical reconciliation reruns.
- Evidence-linked withdrawal chains (partial payouts, refunds, retries, manual final payout) without duplicate counting.
- Annual workbook year discrepancy and definitions of X1/X3/X5; these require source-owner clarification, not inferred mappings.
- Recovered/net loss data are not synthesized from free-text notes or missing cells.
