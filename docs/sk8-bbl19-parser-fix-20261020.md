# SK8 BBL 19 October: local fix and evidence

## Verified originals (read-only)

- Gmail message `1a1574b82172e734`, attachment `SK8_STM_BBL_ดลยา_DW_2026-10-19.pdf`.
- Downloaded independently from the authenticated production file preview.
- Both SHA-256: `44be51012454c5b5b996f50aa1cb43228891caa3dee066208ee8a2e14e372ad8`.
- It is SK8 Dolaya, not AT4 Naraworn. Original is a one-page PDF displaying statement page 10/10; no claim that the attachment contains the preceding nine pages.
- 24 dated printed transaction rows: 12 for October 18 and 12 for October 19.
- October 19: 7 deposits / 370 THB; 5 withdrawals / 197 THB.

## Reproduced cause

The native parser already reads the 12 October 19 rows. Its quality gate fails because the first October 18 TRANSFER (39 THB) has neither an explicit FR/TO direction in extracted text nor a preceding balance. The native probe therefore sends the PDF to OCR. This reproduces an unnecessary OCR fallback; it does not prove the historical OCR execution's exact output.

## Local implementation

- Isolate only a BBL direction-only defect for a positively dated immediately preceding day, with a readable amount/balance/time sentinel. Keep the original row/page/line diagnostic and warning. Never manufacture its direction or put it into this day's matching records.
- The same ambiguous row still fails when October 18 itself is requested. Unread rows, current-day ambiguous directions, missing values, other banks and more distant ambiguous dates retain blocking behavior.
- Patch all six embedded PDF parsers (native probe and normalizer in headless, round and manual worker definitions), without changing selectors, RPCs, triggers or activation settings.
- File manager initially selects same-company, same-reference-day core files only. Adjacent candidates are visible, marked and unselected; explicit choices and an empty selection survive refresh. No physical file is excluded or relabelled.

## Verification / boundaries

- Original storage PDF parsed locally: 24 parsed, 12 current-day, 1 prior-day diagnostic; quality passes.
- Nine-company native probe/normalizer, unread/current-day negative tests and selection-default tests pass.
- PDF parser suite: 206 passed, 0 failed. BBL continuity and workflow graph tests pass. Full npm test passed before adding these new tests to posttest; rerun after final edits.
- No production run, re-confirmation, upload, source revision, exclusion, amount/case/hold/registry change.
- Not yet published or installed in production workers. Accepted-primary display invalidation from newly available adjacent candidates is a separate unresolved read-path issue; this patch does not change that database function or pretend those accepted reports were rerun.
- No private PDF or raw account identifier is committed to the repository.
