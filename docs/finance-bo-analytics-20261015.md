# BO and customer-activity analytics

Read-only expansion of finance reporting. No reruns, ledger changes, approvals, case status edits, or matching. Existing active lead/exec/admin scope remains enforced server-side.

## BO totals and completeness

Source rows from committed reconciliation evidence are deduplicated by file/row. Conflicting source rows are excluded from observed subtotals and flagged, never guessed. Known but incomplete subtotals appear orange/dashed; missing days remain gaps. A partial company no longer blanks the entire network chart. Completeness still gates official percentage comparison. Reasons distinguish row coverage, parser/run quality, changed files/OCR and missing/wrong BO sources.

Daily/monthly tables cover every permitted company and selected day/month. Day growth compares prior day; company period compares equal-length prior period; full months compare full prior months and current MTD compares the same calendar-day span. Zero/missing/incomplete baselines produce unknown, not 0% or infinity. Net change uses absolute prior net as denominator and is unavailable for a zero baseline.

The optional three-month view ends at the selected month (current month to yesterday), makes bounded two-day reads with at most two concurrent requests, and does not prefetch on a timer. UI tables page 50 rows; full exports are independent of page state.

## Customer counts

Only explicit BO customer member identity is used: match customer.bo.user, exception customer_details.bo.user, and corresponding manual/waiting customer/member fields. Operator username, performedBy, employee and auth accounts are not customer fallbacks. Placeholder or conflicting identities remain unknown.

A private random salt pseudonymizes identity per company before returning scoped day aggregates. The private table and raw aggregation helper are inaccessible to authenticated/anonymous roles. The UI receives no plaintext customer ID, and no pseudonymous key is rendered or exported. These keys remain in report memory only.

Distinct sets are unioned for a month/period (daily distinct counts are never summed). The same code across companies counts separately: user-company accounts, not identified people network-wide. Identified transaction coverage is displayed. Depositors, withdrawers, both-direction and multiple-transaction activity are included. Period overlap/new-to-observed-period and return percentages require complete comparable identity coverage; they are not registration, first-ever customer, advertising acquisition, ROAS, or lifetime churn metrics.

## Exports and tests

Excel includes all rows across company, network/day, company/day, network/month, company/month, channel, user and definition sheets. CSV ZIP and paged SVG ZIP likewise include all rows. PNG/SVG overview embeds readable compact table previews (up to 50 rows per displayed table), explicitly labeling the preview limit and pointing to full table exports. Signed links, customer IDs and pseudonymous keys are excluded.

Run finance-report, finance-bo-analysis and isolated finance-report DB tests, UI QA, and full suite. Verify all-company partial graphs, negative net, daily/monthly counts, workbook row parity, role denial and scope revocation in synthetic harness. Production checks are read-only; never upload test evidence, save Actions, or change financial/case records.
