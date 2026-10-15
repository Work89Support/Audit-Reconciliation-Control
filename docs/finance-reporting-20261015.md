# Read-only finance reporting

Menu: รายงาน → การเงิน & ผู้บริหาร (`#/finance`).

## Scope

The server accepts active `lead`, `exec`, `admin` profiles only. Lead and executive companies require explicit `user_company_access` entries (including an explicitly granted wildcard). Admin sees active `audit_companies`. This module does not use the old lead-wide `has_company_access` bypass as its company authorization. UI, data RPCs, focus revalidation and both pre/post image generation check authorization. No financial data is persisted in browser storage.

## Data boundaries

- BO is reconstructed from immutable file/row references in committed job runs or the accepted current manual primary report. Match evidence, exception BO sides and waiting BO sides are deduplicated by source pointer. It is not a fresh re-run or a sum of case amounts.
- Seven-day server windows and at most two concurrent requests bound read load. No polling. The user explicitly refreshes or applies filters. Only BO views read large run evidence.
- Complete BO requires parser/BO-first coverage, a current source set, expected BO row count, valid source pointers, consistent amounts/directions and the source transaction date. Missing or stale data is partial, not zero. Growth requires complete equal-length comparison periods and a positive prior base. Month-to-date uses equal calendar day ranges, not a complete prior month.
- Values are the BO rows included in the main reconciliation, not a separately verified marketing ledger of successful customers. Deposit minus withdrawal is not profit/revenue. BO row counts are not unique customer counts. Campaign attribution, customer acquisition, retention and ROAS require other sources and are not inferred.
- Confirmed losses come only from `damages`. Risks exclude linked confirmed damage and non-current cases. Receipts exclude voided rows and require an approved ledger with source evidence; absent or inconsistent receipt ledgers remain unknown.
- Loss reports select incidents by business date; collection/finance/case statuses are current at read time, not historical snapshots at period end. Risk view also includes earlier incidents through the selected end date.
- Employee attribution requires matching category/name/shift and an explicitly approved employee code in `damage_collections`. Free-text BO operator names or case owners do not establish responsibility. Unallocated or inconsistent identities remain unverified. Company-scoped codes are not merged across companies. Existing ledgers support one approved collection party per damage: there is no automatic multi-person allocation or payroll deduction.
- Current schema has no independently verified remediation or finance-acknowledgment ledger. The UI states this as pending and displays existing finance status verbatim; closing a case is not treated as proving remediation or acknowledgment. Employee positions are not fabricated.

## Export

PNG/SVG are constructed from the same filtered report data; staff names are excluded. The image includes scope, incident dates, current-read timestamp, completeness warnings and detail page number. Tables paginate at 20; the button says “this page” rather than claiming the image contains every record. No external image/chart/export service or CDN is used. Permission is checked before and after image generation.

## Verification

Run `node tests/finance-report.test.cjs`, `node tests/finance-report-db.test.mjs <PGlite module>`, `npm test`, `npm run test:ui-qa`, `npm run test:damage`. The browser fixture is `tests/finance-executive-harness.html` and must never be presented as live production data. Test filtering, monthly scope, role denial, scope revocation and masked PNG download there; production verification is read-only and must not approve, submit, match or close any real case.

Install `supabase/20261015_finance_reporting.sql` before frontend publication. The migration defines SELECT-only report functions; it does not alter financial records, classifications, cases, employee assignments, existing permissions or worker schedules.
