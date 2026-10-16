const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('function applyCaseOpenSnapshot(');
const block=source.slice(start,source.indexOf('async function openException(',start));
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
 assert.doesNotMatch(block,/\.post\(|\.patch\(|\.requestClarification\(|\.closeException\(/);
 console.log('PASS all-role checklist agrees with loaded attachment list; missing/unregistered evidence not invented; case status, notes and amounts unchanged. Mock read only.');
})().catch(e=>{console.error(e);process.exit(1);});
