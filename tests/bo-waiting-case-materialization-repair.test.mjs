import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../supabase/20261030_bo_waiting_case_materialization_repair.sql',import.meta.url),'utf8');

for(const guard of [
  'materialize_bo_waiting_cases_for_job',
  'repair_bo_waiting_cases_for_date',
  'register_bo_waiting_cases(v_job.last_run_id,v_rows)',
  "w->>'company'=v_job.company",
  "w->>'boDate'=v_job.business_date::text",
  "fid::text=w->'boSource'->>'fileId'",
  'after insert',
  'after update of bo_waiting_snapshot,last_run_id,is_archived',
  'not is_archived',
  'last_run_id is not null',
  'bo_waiting_snapshot is not null',
  'revoke all on function public.repair_bo_waiting_cases_for_date(date) from public,anon,authenticated',
  'grant execute on function public.repair_bo_waiting_cases_for_date(date) to service_role',
  'ไม่รันกระทบยอดซ้ำ',
])assert.ok(sql.includes(guard),guard);

// The repair may cover a newly discovered numeric borrowed-PM account without
// a per-company allowlist.  Scope is instead proven by current run, company,
// business date, verified BO file UUID and exact source row.
assert.doesNotMatch(sql,/0000000008/);
assert.doesNotMatch(sql,/insert\s+into\s+public\.recon_runs/i);
assert.doesNotMatch(sql,/update\s+public\.exceptions\s+set\s+status/i);
assert.doesNotMatch(sql,/risk_amount\s*=|system_amount\s*=|bank_amount\s*=/i);

console.log('bo waiting case materialization repair guards passed');
