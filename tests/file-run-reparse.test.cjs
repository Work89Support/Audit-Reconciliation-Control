const assert=require('node:assert/strict');
const fs=require('node:fs');
const ui=require('../file-run-management.js');

for(const file of [
  {file_name:'UFABET7M_STM_TMN_รุ้งฟ้า_DW_2026-10-25.pdf',kind:'stm_pdf'},
  {file_name:'FR8_BO_2026-10-25.xlsx',kind:'bo_main'},
  {file_name:'3X_PM_COREPAY_D_2026-10-25.csv',kind:'pm_statement'},
])assert.equal(ui.canReparse({...file,parsed:false,excluded:false}),true,file.file_name);
for(const file of [
  {file_name:'evidence.docx',kind:'stm_pdf'},
  {file_name:'statement.pdf',kind:'doc_clarify'},
  {file_name:'statement.pdf',kind:'stm_pdf',excluded:true},
])assert.equal(ui.canReparse({...file,parsed:false}),false,file.file_name);

const client=fs.readFileSync('file-run-management.js','utf8');
assert.match(client,/data-reparse/);
assert.match(client,/อ่านไฟล์ใหม่/);
assert.match(client,/opts\.reparse\(file\)/);
assert.match(client,/ยังไม่กระทบยอดหรือเปลี่ยนเคส/);

const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('async function reparseStoredAuditSource');
const end=app.indexOf('async function openFileExclusion',start);
const scope=app.slice(start,end);
assert.match(scope,/Sb\.download\(file\.storage_path\)/);
assert.match(scope,/recordAuditSourceReparse/);
assert.match(scope,/ImportState\.files=savedFiles/);
assert.doesNotMatch(scope,/saveRun|finishJob|closeException|confirmDamage|acceptManualPrimary|requestAccountRecheck/);

const sql=fs.readFileSync('supabase/20261026_ui_source_reparse.sql','utf8');
assert.match(sql,/record_audit_source_reparse/);
assert.match(sql,/replacement\.parsed else f\.parsed/);
assert.match(sql,/replacement\.parse_error else f\.parse_error/);
assert.match(sql,/reconciliation_started',false/);
assert.match(sql,/case_write',false/);
assert.doesNotMatch(sql,/insert into public\.(recon_runs|exceptions|case_evidence|damage_records)/i);
assert.doesNotMatch(sql,/update public\.(recon_runs|exceptions|daily_recon_jobs)/i);

console.log('PASS UI source reparse: effective physical revision state, role/version/checksum guards, and no reconciliation or case writes');
