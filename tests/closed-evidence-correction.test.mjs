import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const service=fs.readFileSync('supabase.js','utf8'),app=fs.readFileSync('app.js','utf8'),sql=fs.readFileSync('supabase/20261011_closed_case_evidence_correction.sql','utf8');
const start=service.indexOf('const pendingEvidenceUploads = new Map()'),end=service.indexOf('async function submitClarification(',start);
let status='closed',uuid=0,uploads=0,registrations=0,deny=false,missing=false,commitTimeout=false;
const rows=new Map();
const ctx={Map,Uint8Array,crypto:{subtle:webcrypto.subtle,randomUUID:()=>`revision-${++uuid}`},signedIn:()=>true,authUser:()=>({id:'head-user'}),cfg:()=>({bucket:'audit-files'}),setTimeout:r=>r(),
 json:async path=>path.startsWith('/rest/v1/exceptions')?[{id:'dummy-case',status}]:[rows.get(decodeURIComponent(path.match(/id=eq\.([^&]+)/)[1]))].filter(Boolean),
 req:async(_path,options)=>{assert.equal(options.method,'POST');assert.equal(options.headers['x-upsert'],'false');uploads++;},
 rpc:async(name,{p_metadata:m})=>{assert.equal(name,'register_closed_case_evidence');registrations++;if(deny)throw Error('permission denied');if(missing)throw Error('PGRST202 missing function');rows.set(m.id,m);if(commitTimeout)throw Error('database timed out');return m;},
 post:()=>{throw Error('corrections must never use legacy REST fallback');},signedUrl:()=>{throw Error('not used');}};
vm.createContext(ctx);vm.runInContext(service.slice(start,end),ctx);
const file={name:'dummy-proof.txt',size:4,type:'text/plain',arrayBuffer:async()=>new TextEncoder().encode('test').buffer};
const correction={reason:'แนบผิดเคส',evidenceId:'original-proof'};
await assert.rejects(ctx.uploadCaseEvidence('dummy-case',file,()=>{},{reason:' ',evidenceId:'original-proof'}));assert.equal(uploads,0);
status='open';await assert.rejects(ctx.uploadCaseEvidence('dummy-case',file,()=>{},correction),/สถานะเคส/);assert.equal(uploads,0);
status='closed';const saved=await ctx.uploadCaseEvidence('dummy-case',file,()=>{},correction);assert.equal(saved.replaces_evidence_id,'original-proof');assert.equal(saved.correction_reason,'แนบผิดเคส');assert.equal(uploads,1);
commitTimeout=true;await ctx.uploadCaseEvidence('dummy-case',{...file,name:'retry.txt'},()=>{},correction);assert.equal(uploads,2);assert.equal(rows.size,2,'lost response recovers same receipt');commitTimeout=false;
deny=true;await assert.rejects(ctx.uploadCaseEvidence('dummy-case',{...file,name:'denied.txt'},()=>{},correction),/permission denied/);deny=false;
missing=true;await assert.rejects(ctx.uploadCaseEvidence('dummy-case',{...file,name:'missing.txt'},()=>{},correction),/missing function/);missing=false;
assert.ok(sql.includes("coalesce(public.current_app_role(),'') not in ('lead','admin')"));
assert.match(sql,/for update/);assert.match(sql,/has_company_access/);assert.match(sql,/case_evidence_corrected/);
assert.doesNotMatch(sql,/update public\.exceptions|delete from|update public\.case_evidence/i);
assert.match(app,/id="correctionReason"/);assert.match(app,/id="correctionConfirm"/);assert.match(app,/id="btnCorrectClosedEvidence"/);
console.log('PASS closed evidence corrections: reason + confirmation, closed-only uploads, idempotent receipt, no fallback, role/company/latest-state guards, append-only history and no amount/case updates');
const elements=Object.fromEntries(['correctionOriginal','correctionReason','correctionFile','correctionConfirm','correctionProgress','correctionSave','correctionCancel'].map(id=>['#'+id,{value:'',checked:false,files:[],disabled:false,textContent:''}]));
let modal='',saves=0,companyAllowed=true;
const state={dataset:'production',role:'admin'},record={id:'dummy-case',dbId:'dummy-case',company:'3XB',code:'TEST',status:'closed',systemAmount:110};
const ui={state,canAccessCompany:()=>companyAllowed,Sb:{exceptionDetail:async()=>({status:'closed'}),caseEvidence:async()=>[{id:'original-proof',file_name:'dummy-original.txt'}],uploadCaseEvidence:async(_id,_file,_progress,c)=>{assert.equal(c.reason,'แนบผิด');assert.equal(c.evidenceId,'original-proof');saves++;}},openModal:(_title,body)=>{modal=body;},closeModal:()=>{},openException:async()=>{},toast:()=>{},h:String,$:id=>elements[id]};
vm.createContext(ui);vm.runInContext(app.slice(app.indexOf('async function openClosedEvidenceCorrection('),app.indexOf('async function openException(')),ui);
state.role='audit_assistant';await assert.rejects(ui.openClosedEvidenceCorrection(record));assert.equal(saves,0);
state.role='lead';companyAllowed=false;await assert.rejects(ui.openClosedEvidenceCorrection(record));companyAllowed=true;
await ui.openClosedEvidenceCorrection(record);assert.match(modal,/ไม่เปลี่ยนยอด/);
await elements['#correctionSave'].onclick();assert.equal(saves,0);
elements['#correctionOriginal'].value='evidence:original-proof';elements['#correctionReason'].value='แนบผิด';elements['#correctionFile'].files=[file];
await elements['#correctionSave'].onclick();assert.equal(saves,0,'confirmation is mandatory');
elements['#correctionConfirm'].checked=true;
await elements['#correctionSave'].onclick();assert.equal(saves,1);assert.equal(record.status,'closed');assert.equal(record.systemAmount,110);
console.log('PASS modal behavior: helper/company denial, missing fields + confirmation rejected, only valid confirmed correction saves, case remains closed and amount unchanged (dummy fixture)');
