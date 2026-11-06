// Local headless Chromium only. All application services are synthetic stubs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.resolve(process.argv[2]));
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{})});
 try{
  const page=await browser.newPage({viewport:{width:900,height:1000}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent('<!doctype html><html lang="th"><meta charset="utf-8"><body><div id="modal" class="modal on"></div></body></html>');
  await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')+'\n'+fs.readFileSync('manual-pairing.css','utf8')+'\nbody{margin:0;min-height:100vh}'});
  await page.evaluate(()=>{
   window.writes=[];crypto.randomUUID=()=> '00000000-0000-4000-8000-000000000099';window.state={dataset:'production',role:'lead'};window.DB={companies:['UFABET7M'],exceptions:[]};
   window.$=s=>document.querySelector(s);window.h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.money=n=>Number(n).toFixed(2);window.caseLabel=e=>e.code||e.id;window.companyMaster=()=>['UFABET7M'];window.canAccessCompany=()=>true;
   window.openModal=(title,body,footer)=>{$('#modal').innerHTML='<header class="modal-head"><h2>'+title+'</h2></header><div class="modal-body">'+body+'</div><footer class="modal-foot">'+footer+'</footer>';$('#modal').style.opacity='1';};window.closeModal=()=>{};window.refreshCaseView=async()=>{};window.toast=()=>{};
   window.stm={id:'synthetic-stm',code:'TEST-STM',company:'UFABET7M',business_date:'2099-01-01',occurred_at:'06:58:12',account:'TMN-TEST',direction:'ถอน',currency:'THB',ex_type:'missing_bo',status:'open',bank_amount:4000,stm_raw:'2099-01-01 เงินออก 4000'};
   window.bo={id:'synthetic-bo',code:'TEST-BO',company:'UFABET7M',business_date:'2099-01-01',occurred_at:'06:59:00',account:'BANK-NEW',direction:'ถอน',currency:'THB',ex_type:'missing_stm',status:'open',system_amount:4000,bo_raw:'2099-01-01 06:59 | โยกเงินเข้า | BANK-NEW | 4000'};
   window.Sb={signedIn:()=>true,authUser:()=>({id:'synthetic-lead'}),exceptionDetail:async id=>structuredClone(id===stm.id?stm:bo),pendingManualPairs:async()=>[],manualPairCandidates:async()=>[structuredClone(bo)],manualPairBoAccounts:async()=>[{account:'BANK-NEW',label:'บัญชี BO ทดสอบปลายทาง'},{account:'NO-CASE',label:'บัญชี BO ที่ไม่มีเคสเปิด'}],manualPair:async()=>null,
    submitManualPair:async p=>{writes.push(['submit',p]);return {id:p.p_id};},closeInternalTransferPair:async p=>{writes.push(['close',p]);return {id:p.p_id,status:'approved'};},uploadCaseEvidence:async()=>{throw Error('unexpected upload');}};
  });
  await page.addScriptTag({content:fs.readFileSync('manual-pairing.js','utf8')});
  await page.evaluate(()=>ManualPairing.open({dbId:stm.id,id:stm.code,company:stm.company,date:stm.business_date,direction:stm.direction,type:'missing_bo',status:'open'},'internal'));
  await page.getByRole('button',{name:'ค้นหาเคสคู่',exact:true}).click();
  await page.locator('#pairBoAccount option[value="BANK-NEW"]').waitFor({state:'attached'});
  assert.equal(await page.locator('#pairBoAccount option').count(),3);
  await page.locator('#pairBoAccount').selectOption('NO-CASE');await page.getByText(/ไม่มีเคสฝั่งตรงข้าม/).waitFor();assert.equal(await page.locator('#pairSubmit').isDisabled(),true);
  await page.locator('#pairBoAccount').selectOption('BANK-NEW');assert.equal(await page.locator('#pairCandidate').inputValue(),'synthetic-bo');assert.equal(await page.locator('#pairSubmit').isDisabled(),true);
  assert.equal(await page.evaluate(()=>writes.length),0,'open/search/select must never write');
  await page.locator('#pairReasonType').selectOption('internal_transfer');await page.locator('#pairChecked').check();
  assert.equal(await page.locator('#pairSubmit').isEnabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('.modal-body').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:'.test-tools/internal-cross-account-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'.test-tools/internal-cross-account-mobile.png',fullPage:true});
  await page.locator('#pairSubmit').click();assert.equal(await page.evaluate(()=>writes.length),1);assert.equal(await page.evaluate(()=>writes[0][0]),'close');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'browser never contacts any external service');
  console.log('PASS headless Chromium: complete BO dropdown, cross-account selection, read-only browsing, explicit synthetic close, desktop/mobile no horizontal overflow, no page errors, no network.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
