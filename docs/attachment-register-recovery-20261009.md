# Attachment registration recovery

Live read-only check: request 2d502668-8689-466b-bf4e-7ce7f6c8a895 has one Storage object and zero case_evidence records. The object was not re-uploaded and the actual case was not modified.

The existing client recovery retains the request UUID and retries metadata. General Storage SELECT policies run inside its INSERT policy; the new register_case_evidence RPC uses an exact bucket/path/owner lookup with explicit active-user, original role, company and case-state checks. This removes that general-policy traversal. It is a mitigation of a timeout path, not proof of the complete outage root cause.

It verifies Storage size, never replaces receipts, validates retries against all original metadata, and does not update cases or weaken their closure rules. Closed cases only permit retrieving a previously committed identical receipt; no new evidence can be added to them. Legacy POST fallback is allowed only when the RPC migration is missing, not on timeout or denial.

UI pending status is not counted as confirmed evidence; successful resume invalidates the evidence cache. Filenames do not determine company ownership (3XB-named evidence can legitimately belong to FR8).

Run npm run test:attachments and npm run test:ui-qa. Run tests/attachment-register-db.test.mjs with the pinned @electric-sql/pglite@0.5.8 dist/index.js path. These use synthetic data; they are not a full Supabase integration or concurrent-session test.

Deployment requires applying supabase/20261009_register_case_evidence.sql and releasing the client together after approval. Re-test with the original uploader in the same still-open tab, keeping its pending request in memory. Do not refresh that tab before confirming the request, do not fabricate a new receipt, and do not submit a new copy of the original bytes. No production deployment or actual receipt write is performed as part of preparing this fix.
