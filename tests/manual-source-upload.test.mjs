import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
const code=fs.readFileSync('supabase.js','utf8'),start=code.indexOf('const pendingManualSources=new Map()'),end=code.indexOf('async function uploadAuditSourceCorrection(',start);
let user='actor-1',uploads=0,registrations=0,fail=true,existing=[],readFail=false,switchActor=false;
const ids=[],paths=[];let serial=0;
const ctx={Map,authUser:()=>({id:user}),crypto:{randomUUID:()=>`nonce-${++serial}`},sha256Hex:async b=>Buffer.from(await webcrypto.subtle.digest('SHA-256',b)).toString('hex'),cfg:()=>({bucket:'audit-files'}),replacementSafeName:s=>s,
 effectiveAuditFiles:async()=>{if(readFail)throw Error('read unavailable');if(switchActor)user='actor-2';return existing;},
 req:async(path,opts)=>{uploads++;paths.push(path);assert.equal(opts.headers['x-upsert'],'false');},
 rpc:async(name,body)=>{registrations++;assert.equal(name,'add_audit_manual_source');ids.push(body.p_metadata.id);if(fail)throw Error('registration timeout');return {source_file_id:body.p_metadata.id,reused:false};}};
vm.createContext(ctx);vm.runInContext(code.slice(start,end),ctx);
const b={company:'FR8',date:'2026-10-18',kind:'pm_statement',reason:'verified actual transaction date'},file=bytes=>({name:'PM.xlsx',size:bytes.length,type:'test/type',arrayBuffer:async()=>new TextEncoder().encode(bytes).buffer});
await assert.rejects(ctx.addAuditManualSource(b,file('abcd')),/timeout/);await assert.rejects(ctx.addAuditManualSource(b,file('abcd')),/timeout/);
assert.equal(uploads,1);assert.equal(new Set(ids).size,1,'retry must use exact same immutable nonce');
fail=false;assert.equal((await ctx.addAuditManualSource(b,file('abcd'))).source_file_id,ids[0]);assert.equal(uploads,1);
existing=[{id:'existing',company:'FR8',business_date:b.date,kind:b.kind,excluded:false,checksum:await ctx.sha256Hex(new TextEncoder().encode('abcd'))}];
assert.equal((await ctx.addAuditManualSource(b,file('abcd'))).reused,true);assert.equal(uploads,1,'identical registered bytes must not upload again');
existing=[];readFail=true;await assert.rejects(ctx.addAuditManualSource(b,file('new!')),/unavailable/);assert.equal(uploads,1,'failed preflight must not upload');readFail=false;
switchActor=true;await assert.rejects(ctx.addAuditManualSource(b,file('new!')),/ผู้ใช้เปลี่ยน/);assert.equal(uploads,1);switchActor=false;
assert.ok(paths.every(p=>p.includes('manual-replacements/actor-1/')));assert.equal(registrations,3);
console.log('PASS manual source transport: immutable retry nonce, no upsert, duplicate content reuse, failed reads/account change send no bytes, no run/primary/case calls');
