const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('app.js','utf8');
const start=src.indexOf('async function openEvidenceRelatedCase('),end=src.indexOf('async function openClosedEvidenceCorrection(',start);
function fixture(){let actor='A',closed=0,opened=0,reads=0,resolve;const ctx={state:{role:'lead',route:'clarify'},DB:{exceptions:[]},Sb:{authUser:()=>({id:actor}),exceptionDetail:()=>{reads++;return new Promise(r=>resolve=r)}},canAccessCompany:c=>c==='UR9',mapLiveException:r=>({...r,dbId:r.id}),closeModal:()=>closed++,openException:async()=>opened++};vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);return {ctx,resolve:r=>resolve(r),actor:a=>actor=a,get opened(){return opened},get closed(){return closed},get reads(){return reads}};}
(async()=>{
 const f=fixture(),p=f.ctx.openEvidenceRelatedCase('manual');f.resolve({id:'manual',company:'UR9',status:'open'});await p;assert.equal(f.opened,1);assert.equal(f.ctx.DB.exceptions.length,1);assert.equal(f.reads,1);
 const changed=fixture(),q=changed.ctx.openEvidenceRelatedCase('manual');changed.actor('B');changed.resolve({id:'manual',company:'UR9'});await q;assert.equal(changed.opened,0);assert.equal(changed.ctx.DB.exceptions.length,0,'old actor read must not restore a case');
 const route=fixture(),rp=route.ctx.openEvidenceRelatedCase('manual');route.ctx.state.route='cloud';route.resolve({id:'manual',company:'UR9'});await rp;assert.equal(route.opened,0);assert.equal(route.closed,0,'late read cannot close a different modal');
 const denied=fixture(),dp=denied.ctx.openEvidenceRelatedCase('manual');denied.resolve({id:'manual',company:'OTHER'});await assert.rejects(dp,/ไม่มีสิทธิ์/);
 const marker=src.indexOf('    root.querySelectorAll("[data-open-ex]")',src.indexOf('VIEWS.clarify ='));
 const handler=src.slice(marker,src.indexOf('    const openCompanyCases',marker));let onClick,opened=0,hydrated=0;
 const c={root:{querySelectorAll:()=>[{dataset:{openEx:'manual'},addEventListener:(_,cb)=>onClick=cb}]},DB:{exceptions:[]},openException:async()=>opened++,openEvidenceRelatedCase:async()=>hydrated++,toast:()=>{throw Error('unexpected error')}};vm.createContext(c);vm.runInContext(handler,c);await onClick();assert.equal(hydrated,1);c.DB.exceptions.push({id:'manual'});await onClick();assert.equal(opened,1);assert.equal(hydrated,1,'normal path does not gain another detail fetch');
 assert.doesNotMatch(handler,/submit|requestClarification|approve|closeCase/);console.log('PASS clarify open during refresh: UUID fallback, no normal-path extra read, actor/role/route/company gates, no business writes. Mock reads only.');
})().catch(e=>{console.error(e);process.exit(1)});
