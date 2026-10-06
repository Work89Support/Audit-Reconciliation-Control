const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function review(role,proof=true,outcome='no_loss'){
 const q={id:'request',exception_id:'case',requested_by:'head',status:'pending',review_origin:'audit_submission',outcome,loss_amount:outcome==='no_loss'?0:852,audit_reason:'Reviewed document',snapshot:{stored_document_at_submit:proof,system_amount:852,bank_amount:null}};
 const host={isConnected:true,innerHTML:''},nodes={'#closureHeadChecked':{checked:false},'#closureHeadNote':{value:''},'#closureApprove':{},'#closureReject':{}};
 let writes=0,finished=0;
 const ctx={window:{},state:{role},Sb:{signedIn:()=>true,authUser:()=>({id:'head'}),caseClosureRequest:async()=>q,pendingCaseClosures:async()=>[],approveOwnDocumentClosure:async p=>{assert.equal(p.p_id,'request');assert.ok(!p.p_note);writes++;return {...q,status:'approved'};}},can:()=>['lead','admin','audit_assistant'].includes(role),$:s=>nodes[s],h:String,money:String,toast:()=>{},renderNav:()=>{},finishApprovalReview:async()=>{finished++;}};
 vm.runInNewContext(fs.readFileSync('case-closure.js','utf8')+'\nwindow.testClosure=CaseClosure;',ctx);
 await ctx.window.testClosure.mountReview({closureRequestId:'request'},host);
 const blocked=/id="closureApprove" disabled/.test(host.innerHTML);
 await nodes['#closureApprove'].onclick({target:{}});assert.equal(writes,0,'Must require review checkbox');
 nodes['#closureHeadChecked'].checked=true;
 if(!blocked){await nodes['#closureApprove'].onclick({target:{}});assert.equal(writes,1);assert.equal(finished,1,'Must stay in approval queue');}
 return blocked;
}
(async()=>{
 assert.equal(await review('lead'),false);assert.equal(await review('admin'),false);
 assert.equal(await review('lead',false),true);assert.equal(await review('lead',true,'damage'),true);
 assert.equal(await review('monitor'),true);assert.equal(await review('audit_assistant'),true);
 console.log('Legacy document UI: head enabled; proof/role/loss guards; required checkbox; optional reason; queue continuation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
