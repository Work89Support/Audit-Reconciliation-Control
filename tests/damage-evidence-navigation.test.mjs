import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const supabase=fs.readFileSync(new URL('../supabase.js',import.meta.url),'utf8');
const slice=(source,from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
const observed=[];
const caseId='4600853a-6ad2-4136-a191-16b5cff093f5';
const source={id:caseId,code:'EX-3003',company:'FR8',business_date:'2026-11-06'};
const context=vm.createContext({
  Sb:{authUser:()=>({id:'auditor'}),exceptionDetail:async id=>{observed.push(['fetch',id]);return id===caseId?source:null;}},
  state:{role:'audit',route:'damage'},DB:{exceptions:[]},reviewQueueIds:['old'],
  canAccessCompany:company=>company==='FR8',mapLiveException:row=>({id:row.id,dbId:row.id,company:row.company}),
  closeModal:()=>observed.push(['closeModal']),openException:async(id,options)=>observed.push(['open',id,options]),
});
vm.runInContext(slice(app,'function damageDisplayCode(d) {','\nfunction openWrongClosureReversal'),context);
vm.runInContext(slice(app,'async function openEvidenceRelatedCase(id, options = {}) {','\nasync function openClosedEvidenceCorrection'),context);
assert.equal(context.damageDisplayCode({company:'FR8',date:'2026-11-06',dbId:caseId,linkedCaseCode:'FR8-06.11.2026-003'}),'FR8-06.11.2026-003');
assert.equal(context.damageDisplayCode({company:'FR8',date:'2026-11-06',dbId:caseId}),'FR8-06.11.2026-OBS-4600853a');
await context.openEvidenceRelatedCase(caseId,{focusFiles:true});
assert.deepEqual(observed.map(item=>item[0]),['fetch','closeModal','open']);
assert.equal(observed[2][1],caseId);
assert.equal(observed[2][2].focusFiles,true);
assert.equal(context.DB.exceptions.length,1,'case outside current overview is fetched into the drawer');
assert.equal(context.reviewQueueIds.length,0,'old queue is not reused');
await assert.rejects(context.openEvidenceRelatedCase('not-found'),/ไม่พบเคส/);
assert.equal(context.DB.exceptions.length,1,'failed lookup does not create a case');

const apiContext=vm.createContext({json:async path=>{observed.push(['query',path]);return [source];}});
vm.runInContext(slice(supabase,'  async function exceptionSummaries(ids) {','\n  // Follow the job'),apiContext);
const summaries=await apiContext.exceptionSummaries([caseId,caseId,'bad-id']);
assert.equal(summaries.length,1);
assert.match(observed.at(-1)[1],/select=id,code,company,business_date/);
assert.match(observed.at(-1)[1],new RegExp(caseId));
console.log('Damage register: company code display, persisted case and evidence lookup, missing case guard, deduplicated summary read');
