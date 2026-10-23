const assert=require('node:assert/strict'),fs=require('node:fs');
const sql=fs.readFileSync('supabase/20261023_trusted_late_bbl_auto_rerun.sql','utf8');

for(const token of [
  "p_company in ('3XB','AT4','SK8')",
  "kind='stm_pdf'",
  'trusted_late_bbl',
  'effective_day=p_date',
  "nullif(error,'') is null",
  "kind in ('bo_main','stm_pdf','pm_statement')",
  'audit_run_holds',
  'audit_source_scope_managed',
  "'blocked',jsonb_array_length(warnings)>0"
]) assert.ok(sql.includes(token),token);

assert.match(sql,/files_after_run[\s\S]*and not\([\s\S]*trusted_late_bbl|files_after_run[\s\S]*and not\([\s\S]*p_company in/);
assert.doesNotMatch(sql,/update public\.(exceptions|recon_runs|daily_recon_jobs|source_files)/i);
assert.doesNotMatch(sql,/delete from/i);
console.log('Trusted late BBL: scoped companies, same-day STM, parse and hold safety contracts passed');
