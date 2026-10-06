const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const row={company:'UFABET7M',currency:'THB',direction:'ถอน',system_amount:88,bank_amount:87.93,bo_raw:'88 BO source',stm_raw:'87.93 STM source'};
const pair={id:'pair',status:'pending',submitted_by:'head',mode:'same',bo_company:'UFABET7M',stm_company:'UFABET7M',bo_case_id:'case',stm_case_id:'case',difference:.07,evidence_id:null,snapshot:{bo:row,stm:row}};
const host={isConnected:true,prepend(n){this.notice=n.textContent;}},nodes={'#pairOther':{},'#pairApprove':{},'#pairReject':{},'#pairDecision':{value:''},'#pairDecisionChecked':{checked:false,parentElement:{lastChild:{}}}};
let writes=0,finished=0;
const ctx={state:{dataset:'production',role:'lead'},Sb:{signedIn:()=>true,authUser:()=>({id:'head'}),manualPair:async()=>pair,caseEvidence:async()=>{throw Error('Extra evidence fetch must not block a valid source pair');},decideManualPair:async p=>{assert.equal(p.p_action,'approve');assert.equal(p.p_note,'');writes++;},pendingManualPairs:async()=>[]},can:()=>true,$:s=>nodes[s],h:String,money:String,toast:()=>{},document:{createElement:()=>({setAttribute(){}})},finishApprovalReview:async()=>{finished++;},renderNav:()=>{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('manual-pairing.js','utf8')+'\nthis.api=ManualPairing;',ctx);
(async()=>{
 await ctx.api.mountReview({dbId:'case',manualPairId:'pair'},host);
 assert.equal(nodes['#pairApprove'].disabled,false);assert.match(host.notice,/ไม่ต้องแนบไฟล์เพิ่ม/);
 await nodes['#pairApprove'].onclick();assert.equal(writes,0);
 nodes['#pairDecisionChecked'].checked=true;await nodes['#pairApprove'].onclick();assert.equal(writes,1);assert.equal(finished,1);
 console.log('Rounding UI: approve enabled without upload; review checkbox required; optional note; stays in queue');
})().catch(e=>{console.error(e);process.exitCode=1;});
