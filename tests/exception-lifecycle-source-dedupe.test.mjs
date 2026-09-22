import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../supabase/20260922_exception_lifecycle_source_dedupe.sql',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../supabase.js',import.meta.url),'utf8');

assert.match(sql,/create or replace function public\.recon_exception_lifecycle_key/);
assert.doesNotMatch(sql,/p_exception\.account/);
assert.match(sql,/p_exception\.occurred_at/);
assert.doesNotMatch(sql,/p_exception\.stm_raw/);
assert.doesNotMatch(sql,/p_exception\.bo_raw/);
assert.match(sql,/lifecycle_key is distinct from public\.recon_exception_lifecycle_key/);
assert.match(sql,/e\.run_id=j\.last_run_id/);
assert.match(sql,/duplicate_carry_superseded/);
assert.match(sql,/match_count=1/);
assert.match(sql,/n\.lifecycle_key=c\.lifecycle_key/);
assert.match(sql,/e\.superseded_by_exception_id is null/);
assert.doesNotMatch(sql,/delete\s+from\s+public\.exceptions/i);
assert.match(client,/superseded_by_exception_id=is\.null/);
assert.match(client,/run_id=eq\.\$\{encodeURIComponent\(run\.id\)\}&superseded_by_exception_id=is\.null&select=\*/);

console.log('exception lifecycle source dedupe: ผ่าน');
