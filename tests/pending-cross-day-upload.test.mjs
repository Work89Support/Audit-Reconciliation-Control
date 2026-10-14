import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
const service=fs.readFileSync('supabase.js','utf8');
const start=service.indexOf('const pendingEvidenceUploads = new Map()'),end=service.indexOf('async function submitClarification(',start);
let allowed=false,status='pending_next_day',uploads=0,registrations=0,counter=0;
const ctx={Map,Uint8Array,crypto:{subtle:webcrypto.subtle,randomUUID:()=>`test-${++counter}`},signedIn:()=>true,authUser:()=>({id:'audit'}),cfg:()=>({bucket:'audit-files'}),setTimeout:r=>r(),
json:async path=>path.startsWith('/rest/v1/exceptions')?[{id:'case',status}]:[],
req:async()=>{uploads++;},rpc:async(name,p)=>name==='can_attach_waiting_cross_day_evidence'?allowed:(registrations++,p.p_metadata),post:()=>{throw Error('no fallback');},signedUrl:()=>{throw Error('not used');}};
vm.createContext(ctx);vm.runInContext(service.slice(start,end),ctx);
const file={name:'test.txt',size:4,type:'text/plain',arrayBuffer:async()=>new TextEncoder().encode('test').buffer};
await assert.rejects(ctx.uploadCaseEvidence('case',file),/ยังไม่ได้ส่งไฟล์/);assert.equal(uploads,0);
allowed=true;status='closed';await assert.rejects(ctx.uploadCaseEvidence('case',file),/สถานะเคส/);assert.equal(uploads,0);
status='pending_next_day';await ctx.uploadCaseEvidence('case',file);assert.equal(uploads,1);assert.equal(registrations,1);assert.equal(status,'pending_next_day');
console.log('Pending cross-day upload: server preflight before bytes, denial/stale status sends nothing, original status preserved (synthetic only).');
