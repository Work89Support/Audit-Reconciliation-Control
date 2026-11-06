const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('manual-pairing.js','utf8');
function setup({role='lead',boAccount='BANK-NEW',stmAccount='TMN-TEST',direction='ถอน',movement='โยกเงินเข้า',amount=4000,time='06:59:00',status='open'}={}){
 const nodes={},writes=[],notices=[];
 const node=id=>nodes[id]??={value:'',checked:false,files:[],disabled:false,textContent:'',innerHTML:'',closest:s=>node(s),querySelector:s=>node(s),addEventListener(event,fn){if(event==='change')this.onchange=fn;}};
 const stm={id:'stm',company:'UFABET7M',business_date:'2099-01-01',occurred_at:'06:58:12',account:stmAccount,direction,currency:'THB',ex_type:'missing_bo',status,bank_amount:4000,stm_raw:'2099-01-01 เงินออก 4000',response_text:'keep',clarification_file_id:'keep-file'};
 const bo={id:'bo',company:'UFABET7M',business_date:'2099-01-01',occurred_at:time,account:boAccount,direction:'ถอน',currency:'THB',ex_type:'missing_stm',status,system_amount:amount,bo_raw:`2099-01-01 06:59 | ${movement} | account | 4000 | note`,response_text:'keep-bo'};
 const accounts=[{account:boAccount,label:'BO '+boAccount},{account:'NO-OPEN-CASE',label:'บัญชี BO ที่จับคู่ครบแล้ว'}];
 let html='';const ctx={state:{dataset:'production',role},DB:{exceptions:[],companies:['UFABET7M']},crypto:{randomUUID:()=> 'test-request'},h:s=>String(s??''),money:n=>Number(n).toFixed(2),$:s=>node(s.slice(1)),caseLabel:e=>e.code||e.id,companyMaster:()=>['UFABET7M'],canAccessCompany:()=>true,toast:s=>notices.push(s),openModal:(_title,body)=>{html=body;node('pairCompany').value='UFABET7M';node('pairDate').value='2099-01-01';},closeModal(){},refreshCaseView:async()=>{},Sb:{signedIn:()=>true,authUser:()=>({id:'tester'}),exceptionDetail:async id=>structuredClone(id==='stm'?stm:bo),manualPairCandidates:async()=>[structuredClone(bo)],manualPairBoAccounts:async()=>structuredClone(accounts),pendingManualPairs:async()=>[],closeInternalTransferPair:async p=>{writes.push(['close',p]);return {id:p.p_id,status:'approved'};},submitManualPair:async p=>{writes.push(['submit',p]);return {id:p.p_id,status:'pending'};}}};
 vm.runInNewContext(code+';this.api=ManualPairing;',ctx);
 const open=async()=>{await ctx.api.open({dbId:'stm',id:'STM-TEST',company:stm.company,date:stm.business_date,direction,type:'missing_bo',status},'internal');await node('pairSearch').onclick({target:node('pairSearch')});};
 const choose=()=>{node('pairBoAccount').value=boAccount;node('pairBoAccount').onchange();};
 const submit=async()=>{node('pairReasonType').value='internal_transfer';node('pairChecked').checked=true;await node('pairSubmit').onclick({target:node('pairSubmit')});};
 return {ctx,node,stm,bo,accounts,writes,notices,open,choose,submit,html:()=>html};
}
(async()=>{
 // Any account name, bank or provider is supported; no production rows used.
 for(const stmAccount of ['TMN-TEST','SCB-TEST','KB-TEST','AUTOPEER','NEW-ACCOUNT-2099'])for(const direction of ['ฝาก','ถอน'])for(const status of ['open','clarifying','answered']){
  const t=setup({stmAccount,direction,movement:direction==='ถอน'?'โยกเงินเข้า':'โยกเงินออก',status});const before=JSON.stringify([t.stm,t.bo]);
  await t.open();assert.equal(t.writes.length,0,'opening/search must never write');
  assert.match(t.node('pairBoAccount').innerHTML,/NO-OPEN-CASE/,'BO accounts with no open cases must be visible');
  t.node('pairBoAccount').value='NO-OPEN-CASE';t.node('pairBoAccount').onchange();assert.match(t.node('pairSearchStatus').textContent,/ไม่มีเคส/);assert.equal(t.node('pairSubmit').disabled,true);
  t.choose();assert.equal(t.node('pairCandidate').value,'bo');assert.equal(t.node('pairSubmit').textContent,'ปิดทั้งสองเคส');
  await t.submit();assert.equal(t.writes.length,1);assert.equal(t.writes[0][0],'close');assert.equal(t.writes[0][1].p_mode,'internal');assert.equal(JSON.stringify([t.stm,t.bo]),before,'fixtures preserve original history and amounts');
 }
 for(const options of [{amount:4001},{time:'07:03:13'},{time:'invalid'},{time:'06:99:00'},{movement:'ลูกค้าฝากเงิน'},{movement:'โยกเงินออก'}]){
  const t=setup(options);await t.open();t.choose();assert.match(t.node('pairBoAccount').innerHTML,/BANK-NEW/);assert.match(t.node('pairSearchStatus').textContent,/จับคู่ไม่ได้/);assert.equal(t.node('pairSubmit').disabled,true);await t.submit();assert.equal(t.writes.length,0);
 }
 for(const [field,value] of [['company','OTHER'],['business_date','2099-01-02'],['currency','USDT'],['status','closed'],['manual_pair_id','reserved'],['case_closure_request_id','reserved'],['superseded_by_exception_id','new'],['bo_raw','— ไม่พบ BO —']]){
  const t=setup();t.bo[field]=value;await t.open();t.choose();await t.submit();assert.equal(t.writes.length,0,field+' must be blocked');
 }
 const monitor=setup({role:'monitor'});await monitor.open();monitor.choose();assert.equal(monitor.node('pairCandidate').value,'bo','selection independent of approval permission');await monitor.submit();assert.equal(monitor.writes[0][0],'submit','monitor cannot directly close');
 const race=setup();await race.open();race.choose();race.bo.account='TMN-TEST';race.bo.occurred_at='08:00:00';await race.submit();assert.equal(race.writes.length,0,'changed live source cannot close');
 const error=setup();error.ctx.Sb.manualPairBoAccounts=async()=>{throw Error('BO directory unavailable');};await error.open();assert.match(error.node('pairSearchStatus').textContent,/BO directory unavailable/);assert.equal(error.node('pairBoAccount').disabled,true);assert.equal(error.writes.length,0);
 console.log('PASS internal cross-account UI: all account types, both legs, three statuses, complete BO directory, guarded submission, role/race/error checks; no production writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
