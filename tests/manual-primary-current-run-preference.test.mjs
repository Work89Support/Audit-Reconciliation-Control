import fs from 'node:fs';
import assert from 'node:assert/strict';

const sql=fs.readFileSync('supabase/20261026_manual_primary_current_run_preference.sql','utf8');
assert.match(sql,/e\.run_id is not distinct from v\.base_run_id/);
assert.match(sql,/manual-primary-current-base-run-preference-v1/);
assert.match(sql,/manual-primary-exact-case-reuse-v2/);
assert.match(sql,/if coalesce\(cardinality\(candidates\),0\)=0 then[\s\S]*base_run_id[\s\S]*if coalesce\(cardinality\(candidates\),0\)=0 then[\s\S]*manual_case_source_identity/);
assert.doesNotMatch(sql,/^\s*(update|delete from)\s+public\.exceptions/im);
assert.doesNotMatch(sql,/status\s*=|system_amount\s*=|bank_amount\s*=/i);
console.log('PASS manual primary current-run preference: current base-run case wins; older duplicate remains immutable history');
