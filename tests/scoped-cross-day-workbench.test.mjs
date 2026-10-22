import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync('cross-day-workbench.js','utf8');
const client=fs.readFileSync('supabase.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const sql=fs.readFileSync('supabase/20261022_scoped_cross_day_workbench.sql','utf8');

assert.match(ui,/Sb\.crossDayWorkbench\(\{p_case:e\.dbId\}\)/);
assert.doesNotMatch(ui,/Sb\.crossDayWorkbench\(\{p_company:e\.company,p_from:/);
assert.match(client,/rpc\('cross_day_workbench_for_case',\{p_case:body\.p_case\}\)/);
assert.match(sql,/create or replace function public\.cross_day_workbench_for_case\(p_case uuid\)/);
assert.match(sql,/candidate_ids as materialized/);
assert.match(sql,/e\.company=anchor\.company and e\.business_date=anchor\.business_date/);
assert.match(sql,/e\.account=anchor\.account/);
assert.match(sql,/between time '23:00:00' and time '23:59:59\.999999'/);
assert.match(sql,/b\.business_date between anchor\.business_date-3 and anchor\.business_date\+3/);
assert.match(sql,/n->>'account'=anchor\.account and n->>'date'=anchor\.business_date::text/);
assert.match(sql,/public\.cross_day_actionable_case\(e\) and public\.cross_day_case_source_ready\(e\)/);
assert.doesNotMatch(sql,/\b(update|delete|insert)\s+(public\.)?(exceptions|daily_recon_jobs|recon_runs|manual_primary_results)\b/i);
assert.ok((html.match(/scoped-crossday-20261022/g)||[]).length>=2);

console.log('PASS scoped cross-day workbench: exact case/account/day scope, adjacent STM files, source guards, and no business-row writes.');
