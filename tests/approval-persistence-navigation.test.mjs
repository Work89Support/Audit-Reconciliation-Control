import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const helper=app.slice(app.indexOf('async function finishApprovalReview()'),app.indexOf('function closeDrawer()',app.indexOf('async function finishApprovalReview()')));
for(const failedRefresh of [false,true]){
  const events=[];
  const context={state:{route:'approvals'},closeModal:()=>events.push('modal closed'),closeDrawer:()=>events.push('drawer closed'),go:()=>assert.fail('must not leave approval queue'),render:()=>events.push('queue rendered'),loadLiveOverview:async()=>{if(failedRefresh)throw Error('offline');events.push('overview refreshed');},toast:text=>events.push(text)};
  vm.runInNewContext(helper,context);await context.finishApprovalReview();
  assert.equal(context.state.route,'approvals');
  assert.deepEqual(events.slice(0,3),['modal closed','drawer closed','queue rendered']);
  if(failedRefresh)assert.match(events.at(-1),/บันทึกอนุมัติแล้ว/);
}
for(const name of ['case-closure.js','manual-pairing.js']){
  const source=fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
  assert.match(source,/await finishApprovalReview\(\)/);
  assert.doesNotMatch(source,/await Sb\.decide(?:ManualPair|CaseClosure)[^\n]*await open(?:Exception|EvidenceRelatedCase)/);
  assert.doesNotMatch(source,/id="(?:closureApprove|pairApprove)"[^>]*>อนุมัติและ/);
}
console.log('Approval persistence/navigation: stays in queue, refresh error not a failed decision, concise labels passed');
