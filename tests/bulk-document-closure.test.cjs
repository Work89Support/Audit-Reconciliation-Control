const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const state={role:'lead'};let actor='head',access=true,calls=[],cases={},requests={},proofVersion=1,proofPresent=true;
const Sb={authUser:()=>({id:actor}),caseClosureRequest:async id=>requests[id],exceptionDetail:async id=>cases[id],
 decideCaseClosure:async body=>{calls.push(body);const q=requests[body.p_id];if(q.revokeProof)throw Error('หลักฐานไม่อยู่ในคลังแล้ว');q.status='approved';Object.assign(cases[q.exception_id],{status:'closed',approved_by:actor});return q;},
 approveOwnDocumentClosure:async body=>Sb.decideCaseClosure(body),caseEvidence:async id=>proofPresent?[{id:'proof-'+id+'-'+proofVersion,storage_path:'test-only/'+id,size_bytes:100}]:[],exceptionFiles:async()=>[]};
const storage=new Map(),sessionStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
const ctx={state,Sb,can:()=>state.role!=='monitor',canAccessCompany:()=>access,companyMaster:()=>['UFABET7M'],crypto:require('node:crypto').webcrypto,TextEncoder,sessionStorage};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('case-closure.js','utf8')+';this.C=CaseClosure;',ctx);
const fixture=id=>({id,exception_id:'case-'+id,company:'UFABET7M',business_date:'2026-10-10',status:'pending',outcome:'no_loss',loss_amount:0,requested_by:'audit',review_origin:'audit_submission',audit_reason:'ตรวจหลักฐานแล้ว',snapshot:{stored_document_at_submit:true,company:'UFABET7M',business_date:'2026-10-10',currency:'THB',system_amount:110,bank_amount:null}});
const seed=qs=>{calls=[];requests=Object.fromEntries(qs.map(q=>[q.id,structuredClone(q)]));cases=Object.fromEntries(qs.map(q=>[q.exception_id,{...structuredClone(q.snapshot),status:'answered',case_closure_request_id:q.id}]));};
(async()=>{
 const a=fixture('a'),b=fixture('b'),items=[a,b].map(q=>({q,read:true}));
 seed([a,b]);await assert.rejects(()=>ctx.C.approveBulkReviewed([{q:a,read:false}]));assert.equal(calls.length,0);
 seed([a,b]);const result=await ctx.C.approveBulkReviewed(items);assert.equal(result.filter(r=>r.ok).length,2);assert.equal(calls.length,2);assert.equal(cases[a.exception_id].system_amount,110);assert.equal(cases[a.exception_id].bank_amount,null);
 for(const patch of [{status:'approved'},{outcome:'damage',loss_amount:110},{snapshot:{...a.snapshot,stored_document_at_submit:false}},{audit_reason:'เปลี่ยนผลหลังอ่าน'}]){seed([a]);Object.assign(requests.a,patch);assert.equal((await ctx.C.approveBulkReviewed([{q:a,read:true}]))[0].ok,false);assert.equal(calls.length,0);}
 seed([a,b]);cases[a.exception_id].system_amount=200;const mixed=await ctx.C.approveBulkReviewed(items);assert.equal(mixed[0].ok,false);assert.equal(mixed[1].ok,true);assert.equal(calls.length,1);
 seed([a]);requests.a.revokeProof=true;assert.equal((await ctx.C.approveBulkReviewed([{q:a,read:true}]))[0].ok,false);assert.equal(cases[a.exception_id].status,'answered');
 seed([a]);access=false;assert.equal((await ctx.C.approveBulkReviewed([{q:a,read:true}]))[0].ok,false);assert.equal(calls.length,0);access=true;
 seed([a]);state.role='monitor';assert.equal((await ctx.C.approveBulkReviewed([{q:a,read:true}]))[0].ok,false);assert.equal(calls.length,0);
 state.role='audit_assistant';seed([a]);assert.equal(ctx.C.bulkEligible(a),true);assert.equal(ctx.C.bulkEligible({...a,snapshot:{...a.snapshot,system_amount:30001}}),false);
 state.role='lead';seed([a]);await assert.rejects(()=>ctx.C.approveBulkReviewed([{q:a,read:true},{q:a,read:true}]));assert.equal(calls.length,0);
 assert.equal(ctx.C.reviewFingerprint(a),ctx.C.reviewFingerprint({...a,snapshot:Object.fromEntries(Object.entries(a.snapshot).reverse())}));
 seed([a,b]);await ctx.C.rememberBulkReview(a);await ctx.C.rememberBulkReview(b);
 ctx.C.reviewedSelectionState.selected.add(a.id);ctx.C.reviewedSelectionState.selected.add(b.id);ctx.C.persistBulkSelection();
 let restored=await ctx.C.restoreBulkSelection([a,b]);assert.equal(restored.opened.size,2);assert.equal(restored.selected.size,2);
 const reload={...ctx};vm.createContext(reload);vm.runInContext(fs.readFileSync('case-closure.js','utf8')+';this.C=CaseClosure;',reload);
 restored=await reload.C.restoreBulkSelection([a,b]);assert.equal(restored.opened.size,2);assert.equal(restored.selected.size,2,'browser reload restores verified selections');
 assert.ok([...storage.values()].every(text=>!text.includes('system_amount')&&!text.includes('ตรวจหลักฐานแล้ว')&&!text.includes('test-only/')),'storage contains IDs and digests only');
 proofVersion++;const receipt=reload.C.reviewedSelectionState.reviewed.get(a.id);
 const rejected=await reload.C.approveBulkReviewed([{q:a,read:true,receipt}]);assert.equal(rejected[0].ok,false);assert.equal(calls.length,0,'proof changed after read never approves');
 restored=await reload.C.restoreBulkSelection([a,b]);assert.equal(restored.opened.size,0);assert.equal(restored.selected.size,0,'changed proof forces re-read');
 await reload.C.rememberBulkReview(a);reload.C.reviewedSelectionState.selected.add(a.id);reload.C.persistBulkSelection();
 cases[a.exception_id].status='closed';restored=await reload.C.restoreBulkSelection([a,b]);assert.equal(restored.opened.size,0);assert.equal(restored.selected.size,0);
 seed([a,b]);await reload.C.rememberBulkReview(a);reload.C.reviewedSelectionState.selected.add(a.id);reload.C.persistBulkSelection();
 actor='other-head';restored=await reload.C.restoreBulkSelection([a,b]);assert.equal(restored.opened.size,0);assert.equal(restored.selected.size,0,'another user cannot reuse review');
 actor='head';await reload.C.rememberBulkReview(a);state.role='monitor';restored=await reload.C.restoreBulkSelection([a,b]);assert.equal(restored.opened.size,0,'changed permission invalidates review');
 state.role='lead';await reload.C.rememberBulkReview(a);access=false;restored=await reload.C.restoreBulkSelection([a,b]);assert.equal(restored.opened.size,0,'company access changed invalidates review');access=true;
 seed([a,b]);await reload.C.rememberBulkReview(a);cases[a.exception_id].system_amount=999;restored=await reload.C.restoreBulkSelection([a,b]);assert.equal(restored.opened.size,0,'changed source amount invalidates review');
 seed([a,b]);await reload.C.rememberBulkReview(a);proofPresent=false;restored=await reload.C.restoreBulkSelection([a,b]);assert.equal(restored.opened.size,0,'removed proof forces re-read');proofPresent=true;
 assert.equal(calls.length,0,'persistence tests never approve cases');
 console.log('PASS persistence: queue/browser refresh, IDs and digests only, user/role/company/proof/status/source invalidation, latest proof before approval; no real cases');
 console.log('PASS bulk closure: per-case read confirmation, latest request/source/role/company guards, no-loss only, proof rejection, partial results, no amount edits or duplicate submission');
})().catch(err=>{console.error(err);process.exitCode=1;});
