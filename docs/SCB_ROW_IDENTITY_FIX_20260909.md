# SCB row identity correction — 2026-09-09

## Cause and scope

The SCB parser previously borrowed the preceding text line as the transaction
description. The inspected FR8 statement's native PDF extraction emits descriptions
after transaction rows. This assigned the previous transaction's customer identity
to the next transaction. Coordinate-based browser extraction emits inline descriptions.

The shared parser now accepts inline descriptions and strictly alternating
description/transaction segments in either order. It does not carry descriptions
across PDF pages or complete inline rows. Ambiguous SCB transfer segments fail the
quality gate and are excluded from matchable records. SCB X1/X2 codes explicitly
determine deposit/withdrawal rather than relying on balance ordering.

Both `audit-headless-worker.json` and `audit-round-worker.json` contain this same
tested parser in their native PDF quality probe and normalization nodes. Other
pending builder/document changes were not included in this update.

## Validation

- PDF parser regression tests: 94 passed, 0 failed.
- Full `npm test`: passed, including workflow graph, safety and embedded-parser parity.
- Original FR8 SCB statement: 6 pages, 224 parsed transactions across its dates.
- Business date 2026-09-08: 155 transactions; deposits 6,750; withdrawals 11,717.
- Coordinate extraction and native-text extraction agree on every retained row's
  date, time, direction, amount, balance and description (whitespace normalized).
- Source spot checks: 00:02 / 55 / x1631; 00:09 / 99 / x2621;
  00:11 / 80 / x0561; 00:14 / 70 / x2052.
- This validates parsing of this statement, not BO pairing or all banks/companies.

## Production rollout still required

This change alone does not update an already published n8n workflow or repair
persisted records. No production case was closed or Audit-confirmed in this test.

1. Publish the tested parser to the existing website and install the corresponding
   workflow on the existing active worker. Do not activate both worker variants.
2. Verify the live quality-probe and normalization nodes contain the new parser.
3. Reprocess the affected FR8 statement and reconciliation job once using the
   existing idempotent retry mechanism. Preserve source files and Audit history.
4. Compare counts, totals and the four source spot checks above before reviewing
   generated pairs. Do not auto-close historic wrong-customer exceptions solely
   because the parser code changed.
5. Identify other statements processed by the old SCB parser, then reprocess in
   bounded batches. Do not rerun unrelated banks or all history blindly.
