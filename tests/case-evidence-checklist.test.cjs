const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('function applyCaseOpenSnapshot(');
const block=source.slice(start,source.indexOf('async function openException(',start));
const outcomeStart=source.indexOf('function hasRecordedAmountOutcome(');
const outcomeBlock=source.slice(outcomeStart,source.indexOf('async function refreshQuickCloseEvidence(',outcomeStart));
async function read(role,loaded,files,linked=false){
 const e={id:'case-1',dbId:'case-1',company:'FR8',status:'answered',notes:['original note'],evidence:files,_caseEvidenceLoaded:loaded,bankAmount:81900,systemAmount:null};
 const fresh={id:'case-1',hasEvidence:linked,evidence:[],notes:[],bankAmount:81900,systemAmount:null,status:'answered'};
 const results=[fresh,null,['original note'],[],[]].map(value=>({status:'fulfilled',value}));
 const ctx={e,results,mapLiveException:x=>x};
 vm.createContext(ctx);vm.runInContext(block+'\napplyCaseOpenSnapshot(e,results);',ctx);
 assert.equal(e.bankAmount,81900);assert.equal(e.systemAmount,null);assert.equal(e.status,'answered');assert.deepEqual(e.notes,['original note']);assert.equal(e.evidence,files);
 return e.hasEvidence;
}
(async()=>{
 for(const role of ['monitor','audit_assistant','lead','admin','shift_lead']){
  assert.equal(await read(role,true,[{id:'file-1',storagePath:'case-evidence/case-1/u/file-1'}]),true,role+' sees registered evidence after fresh case read');
  assert.equal(await read(role,true,[]),false,'no attachment must not be invented');
  assert.equal(await read(role,true,[{name:'uncommitted.docx'}]),false,'filename alone is not proof');
  assert.equal(await read(role,false,[{storagePath:'unverified'}]),false,'unloaded register is not proof');
  assert.equal(await read(role,true,[],true),true,'linked source document remains evidence');
 }
 assert.match(source,/key: "evidence"[^\n]*ok: e.hasEvidence \|\| sourceEvidence/);
 assert.ok(outcomeStart>0,'amount outcome helper exists');
 const outcomeContext={};vm.createContext(outcomeContext);vm.runInContext(outcomeBlock+'\nthis.hasRecordedAmountOutcome=hasRecordedAmountOutcome;',outcomeContext);
 for(const status of ['open','clarifying','answered','pending_next_day'])assert.equal(outcomeContext.hasRecordedAmountOutcome({status,riskAmount:0}),false,status+' with zero risk is not a confirmed amount outcome');
 for(const status of ['damage','approved','closed'])assert.equal(outcomeContext.hasRecordedAmountOutcome({status}),true,status+' is an explicit recorded outcome');
 assert.equal(outcomeContext.hasRecordedAmountOutcome({status:'answered',closureRequestId:'request-1'}),true,'submitted closure result is recorded');
 assert.equal(outcomeContext.hasRecordedAmountOutcome({status:'pair_pending'}),true,'submitted pair result is recorded');
 assert.doesNotMatch(source,/key: "amount"[^\n]*Number\(e\.riskAmount \|\| 0\) === 0/,'zero risk alone must not mark amount review complete');
 assert.match(source,/reviewPrerequisites = checklist\.filter\(\(item\) => item\.key !== "amount"\)/,'outcome confirmation is collected in the next modal, not faked to unlock it');
 assert.match(source,/closureReviewReady[\s\S]{0,300}\(e\.hasEvidence \|\| sourceEvidence\)/,'stored or authoritative source evidence is required before opening outcome review');
 assert.match(source,/ยังไม่ได้ยืนยันผลตรวจยอด — เลือกผลและติ๊กยืนยันในขั้นตอนถัดไป/);
 assert.match(source,/ตรวจผลและปิดเคส/);
 assert.doesNotMatch(block,/\.post\(|\.patch\(|\.requestClarification\(|\.closeException\(/);
 console.log('PASS checklist uses registered evidence, keeps zero-risk unanswered cases unconfirmed, and opens explicit outcome review without inventing writes. Mock read only.');
})().catch(e=>{console.error(e);process.exit(1);});
