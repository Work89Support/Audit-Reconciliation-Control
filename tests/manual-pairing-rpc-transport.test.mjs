import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../supabase.js', import.meta.url), 'utf8');
const session = {access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:'test-user'}};
const calls = [];
let readStatus='approved',readActor='test-user',loseResponse=false,closedStatus='closed';
const context = {
  window:{APP_CONFIG:{}},
  Store:{data:{supabase:{url:'https://test.invalid',anonKey:'public-test-key'}},persist(){}},
  localStorage:{getItem:key=>key==='audit-sb-session'?JSON.stringify(session):null,setItem(){},removeItem(){}},
  AbortController,setTimeout,clearTimeout,Date,console,
  fetch:async (url,opts)=>{
    calls.push({url,...opts});
    // PostgREST must receive named JSON arguments, not an unnamed text body.
    if(opts.method==='POST')assert.equal(opts.headers['Content-Type'],'application/json');
    assert.equal(opts.headers.Authorization,'Bearer test-token');
    assert.equal(opts.headers.apikey,'public-test-key');
    if(opts.method!=='POST'&&url.includes('/exceptions?'))return new Response(JSON.stringify([{id:'case-id',status:closedStatus,case_closure_request_id:'request-id',approved_by:readActor}]),{status:200});
    if(opts.method!=='POST')return new Response(JSON.stringify([{id:'request-id',status:readStatus,decided_by:readActor}]),{status:200});
    if(loseResponse)throw new Error('connection lost after commit');
    return new Response(JSON.stringify({id:'request-id',status:'pending'}),{status:200});
  },
};
vm.runInNewContext(source,context);
const client=context.window.Sb;
await client.restore();
const submission={p_id:'request-id',p_bo:'case-id',p_stm:'case-id',p_mode:'same',p_reason:'ยอดต่างเล็กน้อย / การปัดเศษ',p_evidence:null};
await client.submitManualPair(submission);
await client.submitManualPair(submission);
const decision={p_id:'request-id',p_action:'approve',p_note:'ตรวจหลักฐานแล้ว'};
await client.decideManualPair(decision);
assert.ok(calls[3].url.includes('/manual_case_pairs?'));
loseResponse=true;
assert.equal((await client.decideManualPair(decision)).status,'approved');
assert.equal((await client.decideCaseClosure(decision)).status,'approved');
loseResponse=false;readStatus='pending';
await assert.rejects(client.decideManualPair(decision),/สถานะที่บันทึก/);
readStatus='approved';readActor='other-user';
await assert.rejects(client.decideCaseClosure(decision),/สถานะที่บันทึก/);
readActor='test-user';readStatus='rejected';
assert.equal((await client.decideCaseClosure({...decision,p_action:'reject'})).status,'rejected');
readStatus='approved';
const direct={p_id:'request-id',p_case:'case-id',p_outcome:'no_loss',p_amount:0,p_reason:'ตรวจเอกสารแล้ว',p_category:null};
assert.equal((await client.closeDocumentCase(direct)).status,'approved');
loseResponse=true;assert.equal((await client.closeDocumentCase(direct)).status,'approved');loseResponse=false;
closedStatus='answered';await assert.rejects(client.closeDocumentCase(direct),/ยังยืนยันสถานะปิดเคสไม่ได้/);
assert.deepEqual(JSON.parse(calls[0].body),submission);
assert.deepEqual(JSON.parse(calls[1].body),submission);
assert.deepEqual(JSON.parse(calls[2].body),decision);
assert.ok(calls[0].url.endsWith('/rpc/submit_manual_case_pair'));
assert.ok(calls[2].url.endsWith('/rpc/decide_manual_case_pair'));
console.log('Manual pairing RPC JSON transport: passed');
