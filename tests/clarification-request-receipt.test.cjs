const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const helpers=app.slice(app.indexOf('const clarificationRequestFlights'),app.indexOf('function showCaseSubmissionReceipt('));
const start=app.indexOf('$("#btnClarify").addEventListener("click", async (event) => {');
const handler=app.slice(start,app.indexOf("  $('#responseText').addEventListener",start));
const buttons={};let modal,listener,resolveSend,sendCount=0,renders=0,opened=[],warnings=[],allowed=true;
const e={id:'EX-1',dbId:'one',company:'FR8',account:'SCB-A',status:'open',hasEvidence:false};
const rows=[e,{id:'EX-2',dbId:'two',company:'FR8',account:'SCB-B',status:'open'},{id:'EX-3',company:'MC8',status:'open'},{id:'EX-4',company:'FR8',status:'closed'},{id:'EX-5',company:'FR8',account:'SCB-B',status:'open',hasEvidence:true},{id:'EX-6',dbId:'six',company:'FR8',account:'SCB-A',status:'open',hasEvidence:true},{id:'EX-7',company:'FR8',account:'SCB-A',status:'open',requestedAt:'already-sent'},{id:'EX-8',company:'FR8',account:'SCB-A',status:'answered'}];
const scrolls=[];
const state={dataset:'production',route:'exceptions',reviewSheet:'normal',page:3,filters:{company:'FR8',date:'2026-10-13'},exFilter:{status:'open',q:'',type:'ALL'}};
const baseline=JSON.stringify(state);
const ctx={e,id:e.id,DB:{exceptions:rows},state,window:{scrollX:30,scrollY:650,scrollTo:p=>scrolls.push(p)},requestAnimationFrame:f=>f(),
 $:selector=>{if(selector==='#viewRoot')return {querySelectorAll:()=>[],querySelector:()=>null};return buttons[selector]??={value:'',disabled:false,addEventListener:(_,fn)=>listener=fn};},
 filteredExceptions:()=>rows,caseUiKey:r=>r.dbId||r.id,canAccessCompany:company=>company==='FR8',can:()=>allowed,deny:()=>warnings.push('denied'),
 h:s=>String(s??''),openModal:(title,body,footer)=>modal={title,body,footer},closeModal:()=>{},closeDrawer:()=>{},render:()=>renders++,openException:async id=>opened.push(id),toast:t=>warnings.push(t),recordCaseUiResult:()=>{},saveOverride:()=>{},logAction:()=>{},CaseClosure:{openSubmit:()=>{throw Error('must not close');}},
 Sb:{authUser:()=>({id:'actor'}),signedIn:()=>true,requestClarification:()=>{sendCount++;return new Promise(resolve=>resolveSend=resolve);}}
};
vm.createContext(ctx);vm.runInContext(helpers+handler,ctx);
(async()=>{
const click=()=>listener({currentTarget:ctx.$('#btnClarify')});
const first=click();const second=click();assert.equal(sendCount,1,'double click is single-flight');assert.equal(buttons['#btnClarify'].disabled,true);
resolveSend();await Promise.all([first,second]);assert.equal(renders,0,'no automatic list refresh');assert.deepEqual(opened,[],'no automatic case navigation');assert.equal(JSON.stringify(state),baseline,'filters/page/sheet untouched');assert.match(modal.title,/ส่งขอชี้แจงสำเร็จ/);assert.match(modal.footer,/กลับหน้ารายการ/);
assert.deepEqual(Array.from(ctx.captureClarificationRequestContext(e).nextKeys),['six','two','EX-5'],'same account with evidence first, other account later, already requested/answered excluded');
await buttons['#requestReceiptNext'].onclick();await buttons['#requestReceiptNext'].onclick();assert.deepEqual(opened,['EX-6']);assert.equal(renders,1);assert.equal(scrolls.at(-1).top,650);assert.equal(scrolls.at(-1).left,30);assert.equal(JSON.stringify(state),baseline);
await click();assert.equal(sendCount,1,'already sent case cannot submit again');
e.status='open';ctx.Sb.requestClarification=async()=>{sendCount++;throw Error('timeout');};await click();assert.equal(e.status,'open');assert.equal(buttons['#btnClarify'].disabled,false);assert.equal(JSON.stringify(state),baseline,'failure keeps all filters');assert.equal(renders,1,'failure stays on form');
e.hasEvidence=true;e.requestedAt=null;e.respondedAt=null;assert.equal(ctx.isUnsentClarificationCase(e),true);await click();assert.equal(sendCount,3,'attachment-only case still uses clarification request, never closure');
const context=ctx.captureClarificationRequestContext(e);rows.filter(r=>r!==e).forEach(r=>r.status='clarifying');ctx.showClarificationRequestReceipt(e,context);assert.match(modal.body,/ไม่มีเคส/);assert.match(modal.footer,/disabled/);await buttons['#requestReceiptNext'].onclick();assert.equal(opened.length,1,'skip case changed after capture');
ctx.showClarificationRequestReceipt(e,context);buttons['#requestReceiptReturn'].onclick();buttons['#requestReceiptReturn'].onclick();assert.equal(renders,2,'return button one action only');assert.equal(JSON.stringify(state),baseline);
console.log('PASS request popup: one-flight, no automatic render/navigation, preserved filters/page/scroll, same-company eligible next, stale next skipped, failure retry and no closure. Mock transport only.');
for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9']){
 Object.assign(e,{company,status:'pending_next_day',hasEvidence:true,requestedAt:null,respondedAt:null});
 ctx.canAccessCompany=()=>true;
 ctx.Sb.requestClarification=async()=>({id:e.dbId,status:'clarifying',requested_at:'2026-10-16T09:00:00Z',requested_by:'actor'});
 assert.equal(ctx.isUnsentClarificationCase(e),true);
 await click();assert.equal(e.status,'clarifying');assert.equal(e.requestedAt,'2026-10-16T09:00:00Z');
}
assert.equal(JSON.stringify(state),baseline,'waiting cross-day requests keep filters/page/scroll');
console.log('PASS mock UI: all nine companies waiting cross-day, evidence-only does not route to close, server request time retained. No production requests.');
})().catch(e=>{console.error(e);process.exit(1);});
