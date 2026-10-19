import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const saved=new Map([['audit-sb-session',JSON.stringify({access_token:'test',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:'actor-A'}})]]);
const calls=[];let delay=true;const releases=[];
const ctx={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'test-only'}},persist(){}},
 localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
 fetch:async(url,opts)=>{calls.push({url,opts});if(delay)await new Promise(r=>releases.push(r));
 const body=JSON.parse(opts.body||'{}');
 return new Response(JSON.stringify(url.endsWith('/read_manual_primary')?{id:'accepted-'+body.p_company,company:body.p_company,report:{matched:617}}:url.endsWith('/read_manual_primary_case_set')?{open_count:0,closed_count:4}:[]));
 },AbortController,setTimeout,clearTimeout,Date,console,navigator:{}};
vm.runInNewContext(fs.readFileSync('supabase.js','utf8'),ctx);const api=ctx.window.Sb;await api.restore();
const tick=()=>new Promise(r=>setTimeout(r,0));
const pending=Array.from({length:12},()=>api.readManualPrimary('SK8','2026-10-17'));
await tick();assert.equal(calls.length,1,'parallel daily readers share one current primary RPC');
releases.splice(0).forEach(r=>r());await tick();assert.equal(calls.length,2,'parallel readers share one exact primary case-set RPC');
releases.splice(0).forEach(r=>r());const values=await Promise.all(pending);
assert(values.every(v=>v.id==='accepted-SK8'&&v.case_set.closed_count===4));
delay=false;await api.readManualPrimary('SK8','2026-10-17');assert.equal(calls.length,4,'no completed-result cache or stale primary reuse');
await Promise.all([api.readManualPrimary('FR8','2026-10-17'),api.readManualPrimary('SK8','2026-10-18')]);
assert.equal(calls.length,8,'different companies/dates stay isolated');
assert(calls.every(c=>/read_manual_primary/.test(c.url)),'no run, acceptance or case mutation requests');
console.log('PASS summary primary reads: 12 simultaneous readers use two RPCs, fresh subsequent read, company/date isolation and no business writes. Mock transport only.');
