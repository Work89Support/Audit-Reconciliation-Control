const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'),sb=fs.readFileSync('supabase.js','utf8');
const helpers=app.slice(app.indexOf('const clarificationRequestFlights'),app.indexOf('function showCaseSubmissionReceipt('));
function fixture(company){
 const e={id:'anchor',dbId:'anchor',code:'ANCHOR',company,date:'2026-10-15',account:'COREPAY',status:'open'};
 const state={dataset:'production',route:'mc8-sheets',filters:{company:'OTHER',date:'2026-10-13'},exFilter:{status:'closed'}};
 const buttons={};let actor='audit',access=true,modal,renders=0,closes=0,captures=0,raw=[];const opened=[],reads=[];
 const map=r=>({...r,dbId:r.id,date:r.business_date,requestedAt:r.requested_at,respondedAt:r.responded_at,closureRequestId:r.case_closure_request_id,clarificationFileId:r.clarification_file_id});
 const ctx={state,DB:{exceptions:[e]},$:s=>s==='#viewRoot'?{querySelectorAll:()=>[],querySelector:()=>null}:buttons[s]??={value:'',disabled:false},window:{scrollX:17,scrollY:650,scrollTo:()=>{}},requestAnimationFrame:f=>f(),
  filteredExceptions:()=>{throw Error('must not use another view filters');},caseUiKey:r=>r.dbId||r.id,can:()=>access,canAccessCompany:c=>access&&c===company,deny:()=>{},h:v=>String(v??''),num:String,mapLiveException:map,
  captureCaseOpenDraft:()=>{captures++;},openModal:(title,body,footer)=>{modal={title,body,footer};},closeModal:()=>{},closeDrawer:()=>{closes++;},render:()=>{renders++;},openException:async id=>opened.push(id),toast:()=>{},
  AccountReviewHolds:{set:()=>{},match:r=>r.held},Sb:{signedIn:()=>true,authUser:()=>({id:actor}),currentExceptions:async scope=>{reads.push(scope);return raw;},reviewHoldScopes:async()=>[],caseEvidenceFlags:async ids=>{reads.push(ids);return {attached:true};},requestClarification:()=>{throw Error('must never submit');},post:()=>{throw Error('must never write');}}};
 vm.createContext(ctx);vm.runInContext(helpers,ctx);
 const row=(id,account='COREPAY',extra={})=>({id,code:id,company,business_date:e.date,account,status:'open',...extra});
 raw=[row('anchor'),row('other','AUTOPEER'),row('attached','COREPAY',{status:'pending_next_day'}),row('linked','COREPAY',{clarification_file_id:'registered'}),row('held','COREPAY',{held:true}),row('sent','COREPAY',{requested_at:'already'}),row('answered','COREPAY',{status:'answered'}),row('closed','COREPAY',{status:'closed'}),row('foreign','COREPAY',{company:'OTHER'}),row('old','COREPAY',{business_date:'2026-10-13'})];
 return {ctx,e,buttons,opened,reads,row,get modal(){return modal;},get renders(){return renders;},get closes(){return closes;},get captures(){return captures;},setRaw:r=>raw=r,setActor:a=>actor=a,setAccess:a=>access=a};
}
(async()=>{
 for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9']){
  const f=fixture(company),baseline=JSON.stringify(f.ctx.state);
  await f.ctx.showReadOnlyCaseQueue(f.e);
  assert.match(f.modal.title,/อ่านอย่างเดียว/);assert.doesNotMatch(f.modal.title,/สำเร็จ/);
  assert.match(f.modal.body,/ยังไม่ได้ส่งคำขอ/);
  const table=f.buttons['#readOnlyCaseQueue'].innerHTML;
  assert(table.indexOf('data-next-queue-case="attached"')<table.indexOf('data-next-queue-case="other"'));
  assert.match(table,/แนบแล้ว — ยังไม่ส่ง/,'register-only evidence remains in queue');
  assert(!table.includes('data-next-queue-case="held"'));
  assert(!table.includes('data-next-queue-case="sent"'));
  assert.equal(f.reads[0].company,company);assert.equal(f.reads[0].from,'2026-10-15');
  await f.buttons['#requestReceiptNext'].onclick();await f.buttons['#requestReceiptNext'].onclick();
  assert.deepEqual(f.opened,['attached'],'same account with attached evidence first, duplicate click ignored');
  assert.equal(f.renders,0);assert.equal(f.closes,0,'preview never remounts list or discards drawer drafts');
  assert(f.captures>=2,'capture current draft before preview and navigation');
  assert.equal(JSON.stringify(f.ctx.state),baseline);
  await f.ctx.showReadOnlyCaseQueue(f.e);f.buttons['#requestReceiptReturn'].onclick();assert.equal(f.renders,0);assert.equal(f.closes,0);
  await f.ctx.showReadOnlyCaseQueue({...f.e,id:null,dbId:null,account:''});assert.match(f.buttons['#requestReceiptStatus'].textContent,/เริ่มจากคิวของบริษัทนี้/,'toolbar has no previous account');
  f.setRaw([]);await f.ctx.showReadOnlyCaseQueue({...f.e,id:null,dbId:null,account:''});assert.equal(f.buttons['#requestReceiptNext'].disabled,true);assert.match(f.buttons['#readOnlyCaseQueue'].innerHTML,/คิวถัดไป 0/);
 }
 const failed=fixture('FR8');failed.ctx.Sb.caseEvidenceFlags=async()=>{throw Error('evidence read timeout');};await failed.ctx.showReadOnlyCaseQueue(failed.e);assert.equal(failed.buttons['#requestReceiptNext'].disabled,false);assert.match(failed.buttons['#requestReceiptStatus'].textContent,/ยังไม่ได้ส่งคำขอ/);assert.equal(failed.buttons['#readOnlyCaseQueue'].innerHTML,'');
 failed.ctx.Sb.caseEvidenceFlags=async()=>({attached:true});await failed.buttons['#requestReceiptNext'].onclick();assert.equal(failed.opened.length,0,'retry only loads, never opens or sends automatically');
 const denied=fixture('FR8');denied.setAccess(false);await denied.ctx.showReadOnlyCaseQueue(denied.e);assert.equal(denied.modal,undefined);assert.equal(denied.reads.length,0);
 const changed=fixture('FR8');changed.ctx.Sb.caseEvidenceFlags=async()=>{changed.setActor('other');return {};};await changed.ctx.showReadOnlyCaseQueue(changed.e);assert.equal(changed.opened.length,0);assert.equal(changed.buttons['#requestReceiptNext'].disabled,true);
 const start=sb.indexOf('  async function caseEvidenceFlags('),end=sb.indexOf('  // RLS on both tables',start);
 const paths=[];let page=0;const ids=Array.from({length:101},(_,i)=>'00000000-0000-0000-0000-'+String(i).padStart(12,'0'));
 const transport={json:async path=>{paths.push(path);return page++===0?Array.from({length:500},()=>({exception_id:ids[0]})):[{exception_id:page===2?ids[0]:ids[100]}];}};
 vm.createContext(transport);vm.runInContext(sb.slice(start,end),transport);
 const flags=await transport.caseEvidenceFlags([...ids,ids[0]]);assert(flags[ids[0]]);assert(flags[ids[100]]);assert.equal(paths.length,3,'all pages and ID batches read');assert(paths.every(p=>p.startsWith('/rest/v1/case_evidence?select=exception_id&')));assert(paths[1].includes('offset=500'));
 await assert.rejects(transport.caseEvidenceFlags(['bad-id']),/รหัสเคส/);assert.equal(paths.length,3);
 assert.match(app,/onNextCaseQueue: can\('request_clarify'\)/);assert.match(app,/'#caseNextQueue'\)\?\.addEventListener/);
 console.log('PASS read-only next queue all nine: authoritative company/day, same account first, register-only attachments retained, closed/held/sent excluded, no success/send/write, draft capture, no remount, duplicate click, empty queues, retry, role/identity guard, read-only attachment flags pagination. Mocks only.');
})().catch(e=>{console.error(e);process.exit(1);});
