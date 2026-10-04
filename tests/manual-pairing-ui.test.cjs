const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../manual-pairing.js'),'utf8');
function setup(mode='same',amountDifference=false) {
  const nodes={},notices=[],requests=[];
  const node=id=>nodes[id]??=( {value:'',checked:false,files:[],disabled:false,textContent:'',innerHTML:'',closest:s=>node(s),querySelector:s=>node(s)} );
  const source={id:'stm',code:'EX-1',company:'FR8',business_date:'2026-10-03',occurred_at:'21:42',direction:'ฝาก',account:'SCB',ex_type:'missing_bo',bank_amount:200.02,bo_raw:'— ไม่พบ BO —',stm_raw:'STM real',status:'open'};
  const other={id:'bo',code:'EX-2',company:mode==='same'?'FR8':'3XB',direction:'ฝาก',ex_type:'missing_stm',system_amount:200,bo_raw:'BO real',status:'open'};
  const item={dbId:'stm',id:'EX-1',company:'FR8',date:'2026-10-03',direction:'ฝาก',type:'missing_bo',status:'open'};
  if(amountDifference){Object.assign(source,{ex_type:'amount_diff',system_amount:24,bank_amount:24.27,bo_raw:'BO real 24',stm_raw:'STM real 24.27'});item.type='amount_diff';}
  let html='';
  const context={state:{dataset:'production',role:'monitor'},DB:{companies:['FR8','3XB'],exceptions:[]},crypto:{randomUUID:()=> 'request-id'},h:s=>String(s??''),money:n=>Number(n).toFixed(2),$:s=>node(s.slice(1)),caseLabel:e=>e.id,canAccessCompany:()=>true,toast:m=>notices.push(m),openModal:(_title,body)=>{html=body;node('pairCompany').value=other.company;node('pairDate').value=item.date;},closeModal:()=>{},render:()=>{},openException:async()=>{},Sb:{signedIn:()=>true,exceptionDetail:async()=>source,manualPairCandidates:async()=>[other],submitManualPair:async p=>{requests.push(p);return {id:p.p_id};}}};
  vm.createContext(context);vm.runInContext(code+';this.pairing=ManualPairing;',context);
  return {context,source,other,node,notices,requests,open:()=>context.pairing.open(item,mode),html:()=>html};
}
(async()=>{
  const t=setup();await t.open();
  assert.match(t.html(),/manual-pair-form/);assert.equal((t.html().match(/class="pair-step"/g)||[]).length,3);
  assert.match(t.html(),/<details class="pair-raw">/);assert.doesNotMatch(t.html(),/<details[^>]* open/);
  assert.match(t.html(),/STM real/);assert.doesNotMatch(t.html(),/— ไม่พบ BO —/);
  assert.match(t.html(),/id="pairReasonType"/);assert.match(t.html(),/รายการข้ามวัน/);assert.doesNotMatch(t.html(),/value="wrong_company"/);
  await t.node('pairSearch').onclick({target:t.node('pairSearch')});
  t.node('pairCandidate').value='bo';t.node('pairCandidate').onchange();
  assert.match(t.node('pairCompare').innerHTML,/ยอด BO/);assert.match(t.node('pairCompare').innerHTML,/ยอด STM\/PM/);assert.match(t.node('pairCompare').innerHTML,/0.02 บาท/);
  t.node('pairChecked').checked=true;t.node('pairReasonType').value='small_difference';t.node('pairReason').value='อ้างอิงรายการเดียวกัน';
  t.node('pairDate').onchange();
  assert.equal(t.node('pairChecked').checked,false);assert.equal(t.node('pairCompare').textContent,'');
  await t.node('pairSubmit').onclick({target:t.node('pairSubmit')});assert.equal(t.requests.length,0);
  await t.node('pairSearch').onclick({target:t.node('pairSearch')});
  t.other.system_amount=206;t.node('pairCandidate').value='bo';t.node('pairCandidate').onchange();
  assert.match(t.node('pairCompare').innerHTML,/เกิน 5 บาท จับคู่ไม่ได้/);
  t.node('pairChecked').checked=true;await t.node('pairSubmit').onclick({target:t.node('pairSubmit')});assert.equal(t.requests.length,0);
  t.other.system_amount=200;t.node('pairCandidate').onchange();t.node('pairChecked').checked=true;
  t.node('pairReasonType').value='other';t.node('pairReasonType').onchange();assert.equal(t.node('pairChecked').checked,false);assert.equal(t.node('pairReason').required,true);
  t.node('pairChecked').checked=true;t.node('pairReason').value='สั้น';await t.node('pairSubmit').onclick({target:t.node('pairSubmit')});assert.equal(t.requests.length,0);
  t.node('pairReasonType').value='invalid';await t.node('pairSubmit').onclick({target:t.node('pairSubmit')});assert.equal(t.requests.length,0);
  t.node('pairReasonType').value='small_difference';t.node('pairReason').value='ก'.repeat(2000);await t.node('pairSubmit').onclick({target:t.node('pairSubmit')});assert.equal(t.requests.length,0);
  t.node('pairReason').value='';await t.node('pairSubmit').onclick({target:t.node('pairSubmit')});assert.equal(t.requests.length,1);assert.equal(t.requests[0].p_bo,'bo');assert.equal(t.requests[0].p_stm,'stm');assert.match(t.requests[0].p_reason,/ยอดต่างเล็กน้อย/);
  const cross=setup('cross');await cross.open();assert.match(cross.html(),/value="wrong_company"/);await cross.node('pairSearch').onclick({target:cross.node('pairSearch')});cross.node('pairCandidate').value='bo';cross.node('pairCandidate').onchange();cross.node('pairReasonType').value='wrong_company';cross.node('pairReason').value='หลักฐานยืนยันข้ามบริษัท';cross.node('pairChecked').checked=true;
  await cross.node('pairSubmit').onclick({target:cross.node('pairSubmit')});assert.equal(cross.requests.length,0);assert.match(cross.notices.at(-1),/ต้องแนบหลักฐาน/);
  const custom=setup();await custom.open();await custom.node('pairSearch').onclick({target:custom.node('pairSearch')});custom.node('pairCandidate').value='bo';custom.node('pairCandidate').onchange();custom.node('pairReasonType').value='other';custom.node('pairReason').value='อ้างอิงหลักฐานที่ตรวจสอบได้';custom.node('pairChecked').checked=true;await custom.node('pairSubmit').onclick({target:custom.node('pairSubmit')});assert.equal(custom.requests.length,1);assert.match(custom.requests[0].p_reason,/อื่น ๆ: อ้างอิงหลักฐาน/);
  const cents=setup('same',true);await cents.open();assert.match(cents.node('pairCompare').innerHTML,/0.27 บาท/);assert.equal(cents.node('.pair-search-grid').hidden,true);cents.node('pairReasonType').value='small_difference';cents.node('pairChecked').checked=true;await cents.node('pairSubmit').onclick({target:cents.node('pairSubmit')});assert.equal(cents.requests.length,1);assert.equal(cents.requests[0].p_bo,'stm');assert.equal(cents.requests[0].p_stm,'stm');
  const wrongMode=setup('cross',true);await wrongMode.open();assert.match(wrongMode.notices.at(-1),/ไม่ใช่จับคู่ข้ามบริษัท/);assert.equal(wrongMode.html(),'');
  const centsHigh=setup('same',true);centsHigh.source.bank_amount=29.01;await centsHigh.open();centsHigh.node('pairReasonType').value='small_difference';centsHigh.node('pairChecked').checked=true;await centsHigh.node('pairSubmit').onclick({target:centsHigh.node('pairSubmit')});assert.equal(centsHigh.requests.length,0);assert.match(centsHigh.notices.at(-1),/เกิน 5 บาท/);
  console.log('Pairing UI: three steps, collapsed source, amount comparison, reset, 5-baht cap and cross-company evidence guards passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
