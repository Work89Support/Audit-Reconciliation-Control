const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'),css=fs.readFileSync('styles.css','utf8');
const start=app.indexOf('drawer.innerHTML = `',app.indexOf('const closed = ["closed", "approved"]'));
const template=app.slice(start+'drawer.innerHTML = '.length,app.indexOf('\n\n  drawer.hidden',start)-1);
const e={id:'EX-3002',company:'UFABET7M',date:'2026-10-01',time:'12:45',typeName:'BO มากกว่า STM',severity:'high',status:'open',account:'COREPAY',bank:'PM',direction:'ฝาก',systemAmount:300,bankAmount:null,riskAmount:300,ageHours:1,slaHours:24,notes:[],evidence:[],stmRaw:'ไม่พบรายการ',boRaw:'ยอด 300 บาท · เลขอ้างอิง SAMPLE-123',cause:'รอตรวจสอบสาเหตุ'};
const markup=vm.runInNewContext(template,{e,missingChecks:[{key:'evidence',label:'แนบหลักฐาน / ไฟล์ชี้แจง'}],uiResult:{message:'บันทึกผลตรวจสำเร็จ — รอตรวจหลักฐาน',actor:'ผู้ตรวจตัวอย่าง',at:'2026-10-03 10:00'},queueIndex:-1,queue:[],closed:false,sourceEvidence:false,quickCloseEligible:false,ready:false,checklist:[{ok:true,label:'โหลดข้อมูลรายการ STM / BO แล้ว'},{ok:false,label:'แนบหลักฐาน / ไฟล์ชี้แจง'}],h:x=>String(x??''),caseLabel:()=> 'UFABET7M 01-10-26 EX-3002',sevMeta:()=>({name:'High'}),statusMeta:()=>({name:'รอตรวจ',tone:'warn'}),exceptionTimeDiffLabel:()=> 'ไม่มีข้อมูล',money:x=>x.toFixed(2),diffLabel:()=> 'ไม่พบใน STM',trackMeta:()=>({short:'Audit'}),dueOf:()=>({short:'รอตรวจ',detail:'ตรวจหลักฐานก่อนปิดเคส'}),num:x=>String(x),can:()=>true,DB:{settings:{toleranceDeposit:60}}});
assert.equal((markup.match(/id="btnApprove"/g)||[]).length,1);
async function run(){
 const {chromium}=require(process.env.AUDIT_PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_PATH?{executablePath:process.env.AUDIT_BROWSER_PATH}:{})});
 try{const page=await browser.newPage();for(const width of [1280,768,390]){
  await page.setViewportSize({width,height:900});await page.setContent(`<style>${css}</style><aside id="drawer" class="drawer on">${markup}</aside>`);
  assert.equal(await page.locator('.drawer-body #caseActionSection').count(),1,'Actions must scroll with content');
  assert.equal(await page.locator('.drawer-primary-actions>button').count(),3);
  assert.equal(await page.locator('#responseText').count(),1);
  assert.equal(await page.locator('#btnRespond').isDisabled(),true,'Cannot answer an open case');
  assert.equal(await page.locator('.case-close-blockers').count(),1);
  assert.equal(await page.locator('.case-save-result').count(),1);
  assert.equal(await page.locator('#btnApprove').isDisabled(),true);
  const overflow=await page.evaluate(()=>document.querySelector('#drawer').scrollWidth>document.querySelector('#drawer').clientWidth);
  assert.ok(!overflow,`Drawer overflow ${width}`);
  await page.screenshot({path:`/private/tmp/audit-case-drawer-top-${width}.png`});
  await page.locator('#caseActionSection').scrollIntoViewIfNeeded();
  await page.screenshot({path:`/private/tmp/audit-case-drawer-actions-${width}.png`});
  await page.locator('.drawer-more-actions summary').click();assert.equal(await page.locator('#btnAttachQuick').isVisible(),true);
 }}finally{await browser.close();}console.log('Case drawer layout: real template, three screen sizes, scrolling actions and closure guard passed');
}run().catch(e=>{console.error(e);process.exitCode=1});
