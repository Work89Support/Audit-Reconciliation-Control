import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(
  new URL('../supabase/20261002_repeated_group_exception_lifecycle.sql',import.meta.url),
  'utf8',
);

assert.match(sql,/create or replace function public\.close_repeated_exact_evidence_for_run/);
assert.match(sql,/e\.previous_exception_id is not null/);
assert.match(sql,/e\.ex_type=ev\.ex_type/);
assert.match(sql,/floor\(extract\(epoch from e\.occurred_at\)\)::integer=ev\.source_sec/);
assert.match(sql,/ev->'stm'->>'sec'/);
assert.match(sql,/ev->'bo'->>'sec'/);
assert.match(sql,/closure_rule='exact-side-match-evidence'/);
assert.match(sql,/after update of last_run_id,status on public\.daily_recon_jobs/);
assert.match(sql,/business_date=date '2026-10-01'/);

console.log('exception lifecycle repeated-group migration tests passed');
