import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const helper=app.slice(app.indexOf('async function refreshCaseView()'),app.indexOf('function closeDrawer()',app.indexOf('async function finishApprovalReview()')));
for(const route of ['approvals','mc8-sheets','daily-summary','exceptions'])for(const failedRefresh of [false,true]){
  const events=[];
  const context={state:{route},$:()=>null,window:{scrollX:0,scrollY:200,scrollTo(){}},closeModal:()=>events.push('modal closed'),closeDrawer:()=>events.push('drawer closed'),go:()=>assert.fail('must not leave current review page'),render:()=>events.push('queue rendered'),loadLiveOverview:async()=>{if(failedRefresh)throw Error('offline');events.push('overview refreshed');},toast:text=>events.push(text)};
  vm.runInNewContext(helper,context);await context.finishApprovalReview();
  assert.equal(context.state.route,route);
  assert.deepEqual(events.slice(0,3),['modal closed','drawer closed','queue rendered']);
  if(failedRefresh)assert.match(events.at(-1),/บันทึกอนุมัติแล้ว/);
}
for(const nested of [false,true])for(const failedRefresh of [false,true]){
  const events=[];
  const workspace={auditRefreshInPlace:async()=>{events.push('account table refreshed');if(failedRefresh)throw Error('offline');return true;}};
  const root=nested?{querySelector:selector=>{assert.equal(selector,'#auditViewBody');return workspace;}}:workspace;
  const context={state:{route:'mc8-sheets'},$:()=>root,window:{},closeModal(){},closeDrawer(){},render:()=>assert.fail('must not remount selected account'),loadLiveOverview:async()=>{},toast:text=>events.push(text)};
  vm.runInNewContext(helper,context);await context.finishApprovalReview();
  assert.equal(context.state.route,'mc8-sheets');assert.equal(events[0],'account table refreshed');
  if(failedRefresh)assert.match(events.at(-1),/บันทึกอนุมัติแล้ว/);
}
{
  const ctx={$:()=>({querySelector:()=>({auditRefreshInPlace:async()=>false})}),render:()=>assert.fail('stale workspace must not redraw current page')};
  vm.runInNewContext(helper,ctx);await ctx.refreshCaseView();
}
{
  const source=fs.readFileSync(new URL('../manual-pairing.js',import.meta.url),'utf8');
  const refresh=source.slice(source.indexOf('async function refresh(ids)'),source.indexOf('async function open(e,mode)'));
  const events=[];
  const ctx={Sb:{exceptionDetail:async id=>({id,status:'closed'})},DB:{exceptions:[{dbId:'a'},{dbId:'b'}]},mapLiveException:row=>row,loadPending:async()=>events.push('queue updated'),refreshCaseView:async()=>events.push('workspace updated'),render:()=>assert.fail('manual closure must not remount account table')};
  vm.runInNewContext(refresh,ctx);await ctx.refresh(['a','b']);
  assert.deepEqual(events,['queue updated','workspace updated']);
  assert.ok(ctx.DB.exceptions.every(row=>row.status==='closed'));
}
for(const name of ['case-closure.js','manual-pairing.js']){
  const source=fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
  assert.match(source,/await finishApprovalReview\(\)/);
  assert.doesNotMatch(source,/await Sb\.decide(?:ManualPair|CaseClosure)[^\n]*await open(?:Exception|EvidenceRelatedCase)/);
  assert.doesNotMatch(source,/id="(?:closureApprove|pairApprove)"[^>]*>อนุมัติและ/);
}
console.log('Approval persistence/navigation: stays in queue, refresh error not a failed decision, concise labels passed');
