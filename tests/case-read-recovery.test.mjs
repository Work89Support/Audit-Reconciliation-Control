import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('supabase.js','utf8');
let calls=0,mode='network-once';
const saved=new Map([['audit-sb-session',JSON.stringify({access_token:'test',refresh_token:'test',expires_at:Date.now()/1000+3600,user:{id:'A'}})]]);
const ctx={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://fixture.invalid',anonKey:'test'}},persist(){}},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},AbortController,setTimeout,clearTimeout,Date,console,navigator:{},
fetch:async(url,opts)=>{
 assert.equal(opts.recoverRead,undefined);assert.equal(opts.readOnly,undefined);calls++;
 if(mode==='network-once'&&calls===1||mode==='network-always')throw new TypeError('Failed to fetch');
 if(mode==='503-once'&&calls===1)return new Response('{}',{status:503});
 if(mode==='denied')return new Response('{}',{status:403});
 return new Response(url.includes('/exceptions?')?'[{"id":"case"}]':'[]');
}};
vm.runInNewContext(source,ctx);const api=ctx.window.Sb;await api.restore();
await Promise.all([api.exceptionDetail('case'),api.exceptionDetail('case')]);assert.equal(calls,2,'one shared recovery only');
mode='503-once';calls=0;await api.reviewHoldForCase('case');assert.equal(calls,2);
mode='network-always';calls=0;await assert.rejects(api.caseEvidence('case'),/Failed/);assert.equal(calls,2,'bounded retry');
calls=0;await assert.rejects(api.post('never-replay',[]),/Failed/);assert.equal(calls,1,'writes never replay');
mode='denied';calls=0;await assert.rejects(api.exceptionDetail('case'),/ไม่มีสิทธิ์/);assert.equal(calls,1,'RLS denial never retries');
console.log('PASS case read recovery: transient read only, single-flight, one retry, no writes/auth-denial replay. Mock transport.');
