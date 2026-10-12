# Emergency original-source download

Status: the independent read-only SQL and frontend module were released on
2026-10-12 (initial frontend commit `4e7471a`). No production amounts, source
files, evidence, approvals or cases were changed. This module is independent
of the unfinished staged manual-rerun worker, which remains unreleased.

## Workflow

Audit, Audit assistant, lead and admin can open “ดาวน์โหลดไฟล์จริง (ทำงานมือ)”
from the authenticated production app header. Select an authorized company and
business date; optionally include evidence and original version history.
Prepare the ZIP, review complete/partial status, then download and extract.

The ZIP contains company/date folders for STM/PM, BO, evidence, other files and
history, plus a JSON manifest, readable HTML inventory and manual-work guide.
Evidence and historical versions must not be counted as additional transactions.
Every receipt is preserved separately; identical hashes are flagged, not removed.
Protected PDFs remain protected. This is a source-copy facility, not a new
reconciliation result, automatic backup or offline application.

## Safety

- Server RPC checks current authenticated active role and company permission.
- Client checks current access and unchanged actor before/after downloads and
  before saving; source descriptors are checked against a fresh server catalog.
- No source edit, reconciliation, case creation, approval or closure calls.
- Raw bytes, size and SHA-256 are checked; catalog checksums are enforced when
  they are SHA-256. Download transport errors cannot leak signed URLs into ZIP.
- Storage object size is authoritative for downloaded bytes. The pre-existing
  registry size can differ from it; both are retained in the manifest with a
  warning, not silently rewritten. Object modification time and ETag are checked
  again before saving to reject same-path replacements during preparation.
- Missing or corrupt files remain explicit failed manifest entries. A partial
  filename is marked `_PARTIAL`; missing data is not treated as zero activity.
- 500 files and 200 MB cap. Names are sanitized against archive traversal.
- Catalog includes selected mail-day receipts and files referenced by the saved
  run; this can include adjacent-day STM sources. This does not prove the sender
  supplied all bank-account files. Inspect source dates and coverage manually.
- Archive itself is not encrypted. Keep downloaded financial documents in the
  company's restricted storage. Do not distribute outside authorized staff.

## Emergency limitations

Works when bot/parsing/reconciliation fails while login, database, Storage and
the main website remain reachable. It cannot download during a database/Storage
outage or if the main web app cannot start. Keep an authorized recent download
in advance. A separate lightweight emergency page and scheduled backup are not
implemented in this change.

## Verification on 2026-10-12

- `npm run test:source-archive`: scope/actor changes, source validation,
  cancellation, raw-byte identity, corrupt/missing files, path safety and partial
  archive behavior passed with dummy data.
- `npm test`: existing regression suite passed.
- Python `zipfile.testzip()` and extracted SHA-256 match manifest.
- Local browser dummy Audit fixture: prepare 3/3 files, download ZIP, and
  missing BO warning 2/3 files. This is not a real Audit-user production test.
- Supabase SQL function creation/grants were exercised inside a transaction
  ending ROLLBACK. No business function was invoked and no data was changed.

Release verification: GitHub CI and Pages deployment succeeded. Production
frontend module URLs were observed with their new version strings. Real ordinary
Audit-user downloads and unauthorized-company denial still need verification;
an administrator test is not evidence of the ordinary Audit role. Do not publish
the unrelated incomplete account-recheck/file-management work merely to release
this feature. Preserve and review existing dirty user changes.

Live administrator verification: 3XB / 2026-10-11, 10/10 original files downloaded
in a complete registry-snapshot ZIP. CRC and all ten extracted SHA-256 hashes
passed; total source bytes 6,465,521. All ten legacy registry sizes differed from
Storage sizes, so the new reader retains those registry values as warnings and
uses Storage sizes. No underlying receipt metadata or financial records changed.
CI's original macOS-only fixture directory failed on Ubuntu; the fixture now uses
a unique OS temporary directory. CI and Pages for `9dc5287` both passed.

Usability update: prominent download card on Cloud/Intake, a three-step flow,
company/date selection, optional evidence clearly marked as non-financial,
folder counts and a primary download action. Missing files are listed immediately;
technical registry-size warnings remain in expandable details and the manifest.
Changing selection invalidates prepared bytes. This changes presentation only,
not the server permission, object-version, amount or case gates.
