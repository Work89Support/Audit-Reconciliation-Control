# MR9 — MONOPAY (MNP), 20 November 2026

Verified source: the supplied `MNP ฝาก` and `MNP ถอน` comparison sheets. Only MR9 is enabled. Account headings retain the BO label `พร้อมเพย์-MNP(monopay)(P2P)`; MONOPAY/MNP is the internal alias used to identify this provider.

| Direction | PM field | BO field |
|---|---|---|
| Withdraw | amount | จำนวน |
| Withdraw | transactionId | รหัส |
| Withdraw | updateTime | เวลา |
| Deposit | customerId | ยูสเซอร์ |
| Deposit | realAmount | จำนวน |
| Deposit | paymentTime | เวลา |

All three fields must agree on the same company, provider, direction and calendar date. Compare the minute shown in BO; preserve original PM seconds. A valid match must have exactly one candidate on each side. Do not resolve ties by row order. A Sapan `_id` cannot override a conflicting required field. Do not substitute requestTime/expiredTime, requested deposit amount, or provider order id for the required fields. Missing or invalid critical data in a settled MONOPAY row fails parsing for review.

Preserve physical repeated rows. Only settled success/successed rows are eligible; pending/failed/unsupported partial rows do not become settled evidence. Other providers retain their existing rules.

Intake supports MR9_PM_MONOPAY_D/W and MR9_PM_MNP_D/W filenames. Keep the company and direction explicit. Raw BO labels govern account grouping; STM/PM, BO and Audit retain their existing column order.

Browser modules and embedded automatic, round and account-recheck modules contain the same MONOPAY rules. Build identifier: `1.9.100-mr9-monopay`. Changing repository workflow JSON does not publish n8n Production: export and back up the verified workflow IDs, apply only the MONOPAY delta to their current Code nodes, preserve custom live fixes/credentials/connections/write steps, then verify the published version. Do not import a whole generated graph over a differently configured live graph.

Validation: synthetic regressions cover exact fields, wrong user/code/time/date/amount/company/account, conflicting Sapan IDs, ambiguous candidates, duplicate source rows, missing critical fields, intake aliases and embedded runtime presence. The private supplied example produced one withdrawal match and one deposit match; two earlier BO deposit rows were not consumed. Private transaction rows are not repository fixtures. `npm test` passed locally on 20 November 2026.

This change does not rerun any company, promote a primary result, alter closed cases or edit existing results. Deployment and operational-run verification must be recorded separately.
