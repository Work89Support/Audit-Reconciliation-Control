const assert=require('node:assert/strict'),fs=require('node:fs');
const ui=require('../file-run-management.js');
for(const r of ['monitor','audit_assistant','shift_lead','exec','',null])assert.equal(ui.canManage(r),false);
for(const r of ['lead','admin'])assert.equal(ui.canManage(r),true);
const input={fileId:'original',expectedRevision:1,name:'SK8_BO_D_2026-10-11.xlsx',company:'SK8',date:'2026-10-11',kind:'bo_main',reason:'แก้บริษัทที่ผูกไฟล์ผิด',excluded:false};
assert.equal(ui.validateCorrection(input),input);
for(const patch of [{name:'../bad.xlsx'},{reason:'สั้น'},{kind:'pay'},{expectedRevision:0}])assert.throws(()=>ui.validateCorrection({...input,...patch}));
const sql=fs.readFileSync('supabase/20261012_file_run_management.sql','utf8');
assert.match(sql,/current_app_role\(\),''\) not in \('lead','admin'\)/);
assert.match(sql,/insert into public.audit_source_revisions/);
assert.match(sql,/to_jsonb\(f\)/);
assert.match(sql,/rev is distinct from p_expected_revision/);
assert.match(sql,/\(old_company,old_date\),\(p_company,p_date\)/);
assert.match(sql,/before insert or update on public.recon_runs/);
assert.match(sql,/before insert or update on public.exceptions/);
assert.match(sql,/not public.audit_run_blocked\(j.company,j.business_date\)/);
assert.doesNotMatch(sql,/update public\.(source_files|exceptions|recon_runs)|delete from public\.(source_files|exceptions|case_evidence)/i);
const worker=JSON.parse(fs.readFileSync('n8n/audit-account-recheck.json'));
const select=worker.nodes.find(n=>n.name==='เลือกไฟล์ของบริษัท').parameters.jsCode;
assert.match(select,/job.selected_file_ids\?\.includes\(f.id\)/);
assert.match(select,/file.physical_source_file_id\|\|file.id/);
const request=fs.readFileSync('supabase/20261012_account_recheck.sql','utf8');
assert.match(request,/กรุณาเลือกเพียงหนึ่งฉบับ/);
assert.match(request,/p_file_ids uuid\[\]/);
console.log('File revisions, holds, selected-file scope, duplicate-file and permission guards: PASS');
for(const company of ['3XB','AT4','FR8','SK8','MC8','MR9','PS8','UR9','UFABET7M']){
 const files=[{id:'same',company,business_date:'2026-10-18',kind:'stm_pdf'},
  {id:'next',company,business_date:'2026-10-19',kind:'stm_pdf'},
  {id:'wrong-company',company:'OTHER',business_date:'2026-10-18',kind:'bo_main'},
  {id:'held',company,business_date:'2026-10-18',kind:'stm_pdf',excluded:true},
  {id:'evidence',company,business_date:'2026-10-18',kind:'doc_clarify'}];
 assert.deepEqual([...ui.initialSelection(files,company,'2026-10-18')],['same']);
 assert.deepEqual([...ui.initialSelection(files,company,'2026-10-18',new Set(['next','wrong-company','held','evidence']))],['next']);
 assert.equal(ui.initialSelection(files,company,'2026-10-18',new Set()).size,0);
 assert.deepEqual([...ui.initialSelection(files,company,'2026-10-19')],['next']);
}
console.log('Nine-company same-day defaults, explicit adjacent choice and empty draft retention: PASS');
