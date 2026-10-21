const assert=require('node:assert/strict');
const fs=require('node:fs');

const sql=fs.readFileSync('supabase/20261021_mail_intake_control.sql','utf8');
const ui=fs.readFileSync('mail-intake-control.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const api=fs.readFileSync('supabase.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const poller=JSON.parse(fs.readFileSync('n8n/audit-mail-registry-poller.json','utf8'));
const queue=JSON.parse(fs.readFileSync('n8n/audit-mail-pull-queue.json','utf8'));

function validateGraph(workflow){
  const names=new Set(workflow.nodes.map(node=>node.name));
  assert.equal(names.size,workflow.nodes.length);
  for(const [source,outputs] of Object.entries(workflow.connections)){
    assert.ok(names.has(source),`missing source ${source}`);
    for(const lane of outputs.main||[])for(const edge of lane)assert.ok(names.has(edge.node),`missing target ${edge.node}`);
  }
}

assert.match(sql,/create table if not exists public\.mail_pull_requests/);
assert.match(sql,/current_app_role\(\) not in \('lead','admin'\)/);
assert.match(sql,/date_to - date_from <= 31/);
assert.match(sql,/status in \('queued','processing','completed','partial','error','cancelled'\)/);
assert.match(sql,/มีคำขอดึงอีเมลและช่วงวันที่นี้อยู่แล้ว/);
assert.match(sql,/ไม่ใช่คำสั่งรันหรือยืนยันผลกระทบยอด/);
assert.doesNotMatch(sql,/\b(update|delete\s+from|insert\s+into)\s+public\.(daily_recon_jobs|recon_runs|exceptions|manual_primary_results|audit_run_holds)\b/i);

assert.match(app,/id: "mail-intake"/);
assert.match(app,/ROUTE_ROLES\.lead\.push\('mail-intake'\)/);
assert.match(app,/MailIntakeControl\.mount/);
assert.match(api,/rpc\('register_mail_source'/);
assert.match(api,/rpc\('request_mail_pull'/);
assert.match(ui,/การเพิ่มผู้ส่งและกดดึงเมลไม่ใช่การยืนยันผล/);
assert.match(ui,/ไม่แก้ยอด ไม่เปลี่ยนสถานะเคส และไม่ปิดเคส/);
assert.match(index,/mail-intake-control\.js/);

for(const workflow of [poller,queue]){
  validateGraph(workflow);
  const text=JSON.stringify(workflow);
  assert.doesNotMatch(text,/allhead2564@gmail\.com/i,'real sender addresses must stay in the database registry');
  assert.doesNotMatch(text,/daily_recon_jobs|recon_runs|exceptions|close.*case|approve/i,'mail intake workflows must not mutate reconciliation or cases');
  assert.doesNotMatch(text,/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/,'workflow must not embed credentials');
}
assert.match(JSON.stringify(poller),/mail_sources\?active=eq\.true/);
assert.match(JSON.stringify(poller),/newer_than:30m/,'automatic polling must only inspect newly arrived mail');
assert.match(JSON.stringify(poller),/ส่งเข้า Workflow Live/);
assert.match(JSON.stringify(queue),/claim_mail_pull_request/);
assert.match(JSON.stringify(queue),/finish_mail_pull_request/);
assert.equal(queue.nodes.find(node=>node.name==='ค้นเมลย้อนหลังสูงสุด 20 ฉบับ').parameters.limit,20);
console.log('PASS mail intake registry, separate UI, auditable pull queue and non-case-mutating workflows');

