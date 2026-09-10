# PDF source approval UI

Implemented in the existing file-preview modal for signed-in production Audit roles (monitor/lead/admin) on `stm_pdf` files. Server-side role/company authorization remains authoritative.

Flow: select a prepared recovery JSON payload → compare its rows against the original PDF → individually check each row → confirm complete page coverage → write a review note → explicitly approve. Imported `reviewed` flags are never treated as user confirmation. Each page/row button navigates the existing original-PDF preview.

The browser downloads the original PDF through the existing authenticated client and checks SHA-256. It loads current source identity/checksum/company/date from the database and validates the payload using the same recovery runtime as the worker. Source metadata is reloaded before submission. Financial case state, parse flags, queue state and n8n feature flags are not changed. The approval RPC assigns reviewer identity and time, and returns the revision ID.

Input: version-1 recovery payload as specified by `reviewed-pdf-recovery.js`, including all physical rows, expected IDs, original checksum/hash, coverage evidence and daily controls. No private candidate data is bundled in the public application. This first UI accepts a prepared JSON dataset; it does not automatically convert OCR evidence into an approved dataset, nor edit missing row values.

Validated locally: new validator tests for per-row approval, PDF hash, source/company/date/checksum, identity suffix, balance, controls, direction, coverage, immutability and script wiring; full existing test suite passed. No production approval was submitted. Browser interaction and authenticated end-to-end submission remain to be tested after deployment.

Deployment is pending. This is an existing GitHub Pages application, not a registered Sites project; do not migrate hosting or publish the dirty workspace wholesale. Deploy only the reviewed frontend files and shared recovery runtime through the existing repository workflow, with no private bank files or unrelated n8n changes.
