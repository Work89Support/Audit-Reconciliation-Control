import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../supabase.js',import.meta.url),'utf8');
const saved=new Map([['audit-sb-session',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:'test-user'}})]]);
let calls=0,writeCalls=0,fail=false,gated=false;
const releases=[];
const context={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'public-test-key'}},persist(){}},
  localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
  fetch:async(_url,opts)=>{
    if(opts.method==='POST'){writeCalls++;return new Response('[]');}
    calls++;
    if(gated)await new Promise(resolve=>releases.push(resolve));
    else await new Promise(resolve=>setTimeout(resolve,5));
    if(fail)throw new Error('test timeout');
    return new Response(JSON.stringify([{id:'test-case'}]));
  },AbortController,setTimeout,clearTimeout,Date,console,navigator:{}};
vm.runInNewContext(source,context);
const api=context.window.Sb;
await api.restore();
await Promise.all(Array.from({length:20},()=>api.exceptionDetail('test-case')));
assert.equal(calls,1,'identical in-flight reads share one response body');
await api.exceptionDetail('test-case');
assert.equal(calls,2,'completed reads are not a stale result cache');
fail=true;
await Promise.all(Array.from({length:5},()=>assert.rejects(()=>api.exceptionDetail('test-case'),/timeout/)));
assert.equal(calls,3);
fail=false;
await api.exceptionDetail('test-case');
assert.equal(calls,4,'failed reads can retry');

gated=true;
const before=api.exceptionDetail('test-case');
await new Promise(r=>setTimeout(r,0));
await Promise.all([api.post('test-only',[]),api.post('test-only',[])]);
assert.equal(writeCalls,2,'writes never coalesce');
const after=api.exceptionDetail('test-case');
await new Promise(r=>setTimeout(r,0));
assert.equal(calls,6,'a write prevents reuse of an earlier read');
releases.splice(0).forEach(release=>release());
await Promise.all([before,after]);

const pending=api.exceptionDetail('test-case');
const rejected=assert.rejects(()=>pending,/ผู้ใช้งานเปลี่ยน/);
await new Promise(r=>setTimeout(r,0));
api.signOut();
releases.splice(0).forEach(release=>release());
await rejected;
assert.equal(api.signedIn(),false);
const review=fs.readFileSync(new URL('../review-overview.js',import.meta.url),'utf8');
assert.match(review,/async function refreshInPlace\(\{afterSave=false\}=\{\}\)/);
assert.match(review,/afterSave\?'บันทึกแล้ว แต่':''/);
assert.match(review,/ยังไม่สรุปว่าไม่มีเคส/);
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.match(app,/if \(state.route !== 'exceptions'\) loadLiveOverview\(\)/);
console.log('JSON reads: single-flight, fresh retry, write invalidation and sign-out isolation passed (mock transport)');
