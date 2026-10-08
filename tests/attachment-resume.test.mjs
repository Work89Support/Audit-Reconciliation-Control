import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const code=fs.readFileSync(new URL('../supabase.js',import.meta.url),'utf8');
const start=code.indexOf('const pendingEvidenceUploads = new Map()');
const end=code.indexOf('async function submitClarification(',start);
let uuid=0,posts=0,uploads=0,readBroken=false,postBroken=false,commitBeforeTimeout=false,wrongReceipt=false,user='test-user';
const rows=new Map(),paths=[];
const ctx={Map,Uint8Array,crypto:{subtle:webcrypto.subtle,randomUUID:()=>`upload-${++uuid}`},signedIn:()=>true,authUser:()=>({id:user}),cfg:()=>({bucket:'audit-files'}),
 req:async(path,options)=>{uploads++;paths.push(path);assert.equal(options.headers['x-upsert'],'false');},
 json:async path=>{if(path.startsWith('/rest/v1/exceptions?'))return [{id:decodeURIComponent(path.match(/\?id=eq\.([^&]+)/)[1])}];assert.ok(path.includes('id=eq.upload-'));assert.ok(path.includes('&limit=1'));if(readBroken)throw Error('database timed out');const id=decodeURIComponent(path.match(/\?id=eq\.([^&]+)/)[1]);const row=rows.get(id);return row?[wrongReceipt?{...row,exception_id:'wrong-case'}:row]:[];},
 post:async(table,body,prefer)=>{posts++;assert.equal(table,'case_evidence?on_conflict=id');assert.match(prefer,/resolution=ignore-duplicates/);const meta=body[0];if(!postBroken||commitBeforeTimeout)rows.set(meta.id,meta);if(postBroken)throw Error('database timed out');return [meta];},
 signedUrl:async()=>{throw Error('not used in this fixture');}
};
vm.createContext(ctx);vm.runInContext(code.slice(start,end),ctx);
const file=(bytes='data')=>({name:'test.docx',size:bytes.length,type:'test/type',arrayBuffer:async()=>new TextEncoder().encode(bytes).buffer});
postBroken=true;readBroken=true;
await assert.rejects(ctx.uploadCaseEvidence('case-a',file()),/ยังยืนยันการผูกเคสไม่ได้/);
assert.equal(uploads,1);assert.equal(uuid,1);assert.equal(ctx.pendingCaseEvidence('case-a')[0].uploaded,true);
const pendingId=ctx.pendingCaseEvidence('case-a')[0].id;
// Re-selecting identical content reuses the same request, even as a new File object.
await assert.rejects(ctx.uploadCaseEvidence('case-a',file()),/ยังยืนยันการผูกเคสไม่ได้/);
assert.equal(uploads,1);assert.equal(uuid,1);
user='other';assert.equal(ctx.pendingCaseEvidence('case-a').length,0);
await assert.rejects(ctx.resumeCaseEvidence(pendingId),/บัญชีนี้/);user='test-user';
readBroken=false;postBroken=false;
const saved=await ctx.resumeCaseEvidence(pendingId);assert.equal(saved.id,pendingId);assert.equal(uploads,1);assert.equal(ctx.pendingCaseEvidence('case-a').length,0);
// Database committed but POST response was lost: recover exact receipt without another upload.
postBroken=true;commitBeforeTimeout=true;
assert.equal((await ctx.uploadCaseEvidence('case-b',file('new!'))).exception_id,'case-b');assert.equal(uploads,2);
// Same filename/size but different bytes must not attach to the wrong pending file.
commitBeforeTimeout=false;readBroken=true;
await assert.rejects(ctx.uploadCaseEvidence('case-c',file('aaaa')));await assert.rejects(ctx.uploadCaseEvidence('case-c',file('bbbb')));
assert.equal(ctx.pendingCaseEvidence('case-c').length,2);assert.equal(uploads,4);
readBroken=false;postBroken=false;
const id=ctx.pendingCaseEvidence('case-c')[0].id;rows.set(id,{id,exception_id:'wrong-case'});wrongReceipt=true;
await assert.rejects(ctx.resumeCaseEvidence(id),/ทะเบียนหลักฐานไม่ตรง|ยังยืนยัน/);assert.ok(ctx.pendingCaseEvidence('case-c').some(r=>r.id===id));
assert.ok(!paths.some(p=>p.includes('delete')));
console.log('Attachment resume: same UUID/path after timeout, content identity, actor isolation, exact read-back, committed-response recovery, no overwrite/delete passed (mock transport).');
