import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../supabase.js',import.meta.url),'utf8');
let status='needs_review',run='latest-run';const calls=[];
const session={access_token:'test-token',expires_at:Date.now()/1000+3600,user:{id:'test-user'}};
const context={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'test-key'}},persist(){}},
  localStorage:{getItem:k=>k==='audit-sb-session'?JSON.stringify(session):null,setItem(){},removeItem(){}},
  AbortController,setTimeout,clearTimeout,Date,console,
  fetch:async(url)=>{calls.push(url);return new Response(JSON.stringify(url.includes('daily_recon_jobs?')?[{last_run_id:run,status}]:[{id:'candidate'}]),{status:200});}};
vm.runInNewContext(source,context);const client=context.window.Sb;await client.restore();
assert.equal((await client.manualPairCandidates('3XB','2026-10-08','missing_bo'))[0].id,'candidate');
assert.match(calls.at(-1),/run_id=eq.latest-run.*status=eq.open.*manual_pair_id=is.null.*superseded_by_exception_id=is.null/);
assert.match(calls.at(-1),/limit=201/);
status='completed';await client.manualPairCandidates('3XB','2026-10-08','missing_stm');
for(const blocked of ['running','queued','failed']){status=blocked;await assert.rejects(client.manualPairCandidates('3XB','2026-10-08','missing_bo'),/กำลังรัน/);}
status='needs_review';run=null;await assert.rejects(client.manualPairCandidates('3XB','2026-10-08','missing_bo'));
await assert.rejects(client.manualPairCandidates('3XB','2026-10-08','amount_diff'));
const ui=fs.readFileSync(new URL('../manual-pairing.js',import.meta.url),'utf8');
assert.match(ui,/pairUploadEvidence/);assert.match(ui,/ยังไม่ส่งคำขอและไม่ปิดเคส/);
assert.match(ui,/uploadCaseEvidence\(e.dbId,file,message=>/);
assert.match(ui,/\.docx/);
console.log('Candidate current-run visibility and independent evidence upload: passed');
