# FR8 SCB evidence hold continuation

Authorization: user confirmed continuous hold from 2026-10-16 for account
4311918665 (SCB จิตติพัฒน์), until STM is available and Head/Admin explicitly
confirms release. No changes to financial amounts, primary results, case status,
closure, clarification requests, or prior ledger entries are authorized.

The additive migration introduces an open-ended continuation marker and one
new scope. Original 14 October 23:00–23:59 and 15 October scopes/items remain
unchanged. Reports project matching existing cases, including future manual and
system cases, without copying or creating cases. Historical ledger items are
not repurposed as current cases. A case's actual business date is retained.

Server closure/damage guards and the finance exclusion use the shared matcher.
Operational reads retain authenticated company scope. No authenticated role,
including Admin, receives direct table-write or release privileges from this
patch. Source-file ingestion and parsing do not release a hold.

## Release safety

This patch intentionally does not implement a release button or automatic
expiration. A future release requires a separate explicit Head/Admin instruction,
verification of the correct account's STM and business-date coverage, and an
audited, narrowly scoped release change. Receiving a file, changing date/company,
or rerunning reconciliation is not authorization to release. Do not delete the
old 14–15 October ledger or clear unresolved historical dates incidentally.

## Verification

- PGlite: old 156 ledger rows unchanged, one idempotent continuation, exact
  account/company/start date, future manual/system/pending cases covered.
- Synthetic closure, approval and damage attempts rejected; financial report
  excludes held risks, other accounts remain; cases and amounts unchanged.
- Parsed STM arrival alone does not release; six roles read only within existing
  company access, no direct release/write grant, inactive/foreign access denied.
- UI: continuous banner and actual-date report, read-only RPC recovery,
  deduplication and foreign/date/false-zero validation.
- Production test must remain read-only after the authorized migration: verify
  case FR8-R-7757303f-030 and the continuation registry, compare prior ledger and
  case amounts/statuses. Do not execute real closure/damage tests.
