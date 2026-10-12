const assert=require('node:assert/strict'),fs=require('node:fs');
const ui=require('../account-recheck.js');
for(const role of ['monitor','audit_assistant','shift_lead','exec','',null])assert.equal(ui.canConfirm(role),false);
for(const role of ['lead','admin'])assert.equal(ui.canConfirm(role),true);
const scope={company:'SK8',date:'2026-10-11',account:'6517249394',direction:'deposit'};
assert.ok(ui.validScope(scope));assert.ok(!ui.validScope({...scope,direction:'unknown'}));assert.ok(!ui.validScope({...scope,account:''}));
const sql=fs.readFileSync('supabase/20261012_account_recheck.sql','utf8');
assert.match(fs.readFileSync('account-recheck.js','utf8'),/getItem\(key\)===q.request_key/,'an older terminal job must not clear a newer uncertain request nonce');
assert.match(sql,/current_app_role\(\),''\) not in \('lead','admin'\)/);
assert.match(sql,/effective_audit_source_files\(q.company,q.business_date\)\)\) is distinct from q.snapshot/);
assert.match(sql,/q.revision<>p_expected_revision/);
assert.match(sql,/enable row level security/);
assert.match(sql,/revoke insert,update,delete/);
assert.match(sql,/create unique index account_recheck_busy/);
assert.doesNotMatch(sql,/update public\.(exceptions|recon_runs|source_files)|delete from public\.(exceptions|case_evidence)|insert into public.exceptions/i);
const workflow=JSON.parse(fs.readFileSync('n8n/audit-account-recheck.json'));
assert.equal(workflow.active,false);
for(const n of workflow.nodes){
 assert.ok(!/ปิดเคส|บันทึก Exception|สร้างผลการรัน|บันทึกผลอ่านไฟล์/.test(n.name));
 if(n.parameters.url)assert.ok(!/\/exceptions|finish_daily_recon_job|create_recon_run/.test(n.parameters.url));
}
const calc=workflow.nodes.find(n=>n.name==='กระทบยอดและสร้าง Exception').parameters.jsCode;
assert.match(calc,/const scopeRow=r=>String\(r.subco\|\|r.company/,'statement bank code must not replace the business company');
assert.match(calc,/scopedStm=stm.filter\(scopeRow\),scopedBo=bo.filter\(scopeRow\)/);
assert.match(calc,/records:f.format.source==='bo'\?\(f.records\|\|\[\]\).filter\(scopeRow\):\[\]/);
assert.match(workflow.nodes.find(n=>n.type==='n8n-nodes-base.webhook').parameters.authentication,/headerAuth/);
const names=new Set(workflow.nodes.map(n=>n.name));
const finishExpression=workflow.nodes.find(n=>n.name==='Supabase: เก็บผลรอทบทวน').parameters.jsonBody;
assert.doesNotMatch(finishExpression.slice(3,-2),/\}\}/,'nested closers must not terminate the n8n expression early');
new Function('$json','return '+finishExpression.slice(3,-2));
for(const [name,c] of Object.entries(workflow.connections)){
 assert.ok(names.has(name));for(const branch of c.main)for(const edge of branch)assert.ok(names.has(edge.node));
}
console.log('account-recheck policy, scope, staged-only writes and workflow structure: PASS');
