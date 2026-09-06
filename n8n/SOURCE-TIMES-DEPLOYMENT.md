# Source times and scoped checklist — deployment order

Production DB updated 2026-09-06: four nullable columns added and scoped checklist function installed successfully. No historical cases updated.

SQL Editor validation: 3XB / 2026-09-05 returned 21 files, 1 BO, 418 open cases. Full-row symmetric EXCEPT ALL comparison with the existing view returned 0 differences. This was an administrative SQL session, not a substitute for signed-in application/RLS testing. Web publish and live worker update are still pending.

1. Apply `supabase/20260906_exception_source_times.sql` in the Audit project. It adds nullable columns only; no historical case is changed.
2. Apply `supabase/20260906_scoped_daily_checklist.sql`. This requires the existing registry-driven checklist view. It preserves invoker/RLS and existing checklist business rules while limiting aggregates to the requested date/company scope.
3. Validate as an authenticated Audit user: `audit_daily_checklist('2026-09-05','2026-09-05','3XB',5000)` and compare against the existing view for the same scope. Verify unauthorized companies remain inaccessible. Validate schema cache exposes all four new columns.
4. Only then deploy updated supabase.js/app.js and build/import the worker. Do not import a second node graph over an existing graph or re-enable the retired timer. Existing unrelated PDF and schedule edits must be reviewed separately.
5. On the next legitimate queued job, verify source times persisted from normalized BO and STM independently. Missing times remain NULL, not midnight. Rules-only exceptions without independent source times remain NULL.

Historical backfill is deliberately not automatic: re-reading source files needs stable transaction references and date-column validation. Do not derive timestamps by adding/subtracting time_diff_sec or overwrite closed cases.

Run `node tests/source-times.test.mjs` plus `npm test`. Static tests do not replace database execution or live worker verification.
