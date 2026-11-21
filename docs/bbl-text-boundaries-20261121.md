# BBL text row boundaries

This parser-only release handles BBL native PDF extraction and OCR that emit
several dated transactions on a single physical text line.

- Statement-period metadata no longer hides the bank identity printed below it.
- Explicit dated BBL row markers restore row boundaries without changing digits,
  page order, transaction order, missing times, or repeated real transactions.
- A date range followed only by known column headings is metadata. Monetary
  values or unexpected text cannot be hidden by the period rule.
- BBL transactions require one dated row and exactly two monetary columns;
  unknown collapsed or incomplete rows remain blocked by the quality gate.
- Summary count/amount footers are not transaction amounts.

The same module is embedded in the automatic and manual worker definitions.
Live installation must apply only these bounded parser changes to the current
PDF probe and normalizer. Retain all current live orchestration, credentials,
source selection, matching rules, and parser fixes outside the changed blocks.

Validation includes native and flattened OCR layouts, period/header ordering,
identical real amounts on distinct rows, page breaks, malformed input, other-bank
isolation, and private AT4/SK8 source-file checks performed outside the repository.
Private statements and transaction fixtures must not be committed.

Publishing this code does not itself reparse source files, rerun reconciliation,
promote a primary result, reopen cases, or change historical case approvals.
