import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../supabase.js', import.meta.url), 'utf8');
const session = {access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:'test-user'}};
const calls = [];
const context = {
  window:{APP_CONFIG:{}},
  Store:{data:{supabase:{url:'https://test.invalid',anonKey:'public-test-key'}},persist(){}},
  localStorage:{getItem:key=>key==='audit-sb-session'?JSON.stringify(session):null,setItem(){},removeItem(){}},
  AbortController,setTimeout,clearTimeout,Date,console,
  fetch:async (url,opts)=>{
    calls.push({url,...opts});
    // PostgREST must receive named JSON arguments, not an unnamed text body.
    assert.equal(opts.headers['Content-Type'],'application/json');
    assert.equal(opts.headers.Authorization,'Bearer test-token');
    assert.equal(opts.headers.apikey,'public-test-key');
    assert.equal(opts.method,'POST');
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
assert.deepEqual(JSON.parse(calls[0].body),submission);
assert.deepEqual(JSON.parse(calls[1].body),submission);
assert.deepEqual(JSON.parse(calls[2].body),decision);
assert.ok(calls[0].url.endsWith('/rpc/submit_manual_case_pair'));
assert.ok(calls[2].url.endsWith('/rpc/decide_manual_case_pair'));
console.log('Manual pairing RPC JSON transport: passed');
