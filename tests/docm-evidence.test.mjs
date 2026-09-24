import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(
  new URL("../supabase/20260924_docm_evidence_and_retry_cleanup.sql", import.meta.url),
  "utf8",
);

assert.match(sql, /if new\.file_name ~\* '\\\.docm\$' then\s+new\.kind := 'doc_clarify'/s);
assert.match(sql, /storage_object_preserved', true/);
assert.doesNotMatch(sql, /delete\s+from\s+public\.source_files/i);
assert.match(sql, /refresh_daily_recon_jobs\(date '2026-09-15', current_date\)/);

console.log("DOCM evidence classification: preserved, audited, and excluded from reconciliation");
