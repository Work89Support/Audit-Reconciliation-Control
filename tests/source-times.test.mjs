import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sb = read('supabase.js');
const worker = read('scripts/build-n8n-worker.mjs');
const migration = read('supabase/20260906_exception_source_times.sql');
for (const field of ['bo_date', 'bo_time', 'stm_date', 'stm_time']) {
  assert.ok(sb.includes(field), 'browser write/read field ' + field);
  assert.ok(worker.includes(field + ':'), 'worker write field ' + field);
  assert.ok(migration.includes('add column if not exists ' + field));
}
assert.doesNotMatch(migration, /update\s+public\.exceptions/i, 'do not fabricate old source times');
const sql = read('supabase/20260906_scoped_daily_checklist.sql');
assert.match(sql, /security invoker/i);
assert.match(sql, /where j.business_date between p_from and p_to and not j.is_archived/);
assert.match(sql, /where b.business_date between p_from and p_to/);
assert.match(sql, /grant execute[^;]+to authenticated/);
assert.doesNotMatch(sql, /security definer/i);
console.log('Source-time persistence and scoped-checklist static contracts passed; database migration still requires live validation.');
