import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('function renderLiveDamage(root) {');
const end=app.indexOf('\nVIEWS.damage =',start);
const listeners={};
const context=vm.createContext({
  state:{filters:{from:'2026-09-01',to:'2026-09-12',company:'ALL'}},
  liveDamageState:{key:'test',ready:true,rows:[{id:'TEST-ONLY-1',date:'2026-09-11',company:'MC8',employee:'ข้อมูลทดสอบ',amount:34.15,cause:'[damage:v1:system] ตัวอย่างทดสอบ ไม่ใช่ข้อมูลจริง',evidence:true,financeStatus:'รอปิดรอบ',exceptionId:'-'}],evidence:[],evidenceReady:true,updatedAt:null,category:'ALL'},
  damageQueryKey:()=> 'test', inRange:()=>true, canAccessCompany:()=>true,
  normalizeLiveCompanyCode:x=>x,companyMaster:()=>[{code:'MC8'}],rangeLabel:()=> 'ข้อมูลทดสอบเท่านั้น',
  h:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  num:x=>String(x),money:x=>Number(x).toFixed(2),money0:x=>String(x),
  $:s=>({value:'2026-10',addEventListener:(event,fn)=>listeners[s+':'+event]=fn}), Charts:{draw:()=>{}},bindStoredFileLinks:()=>{},
  render:()=>{context.rendered=true;},
  go:()=>{},exportSheets:(name,sheets)=>{context.exported=sheets;},toast:()=>{},
});
vm.runInContext(fs.readFileSync(new URL('../damage-summary.js',import.meta.url),'utf8')+'\n'+app.slice(start,end),context);
const root={innerHTML:'',querySelectorAll(selector){
  if(selector!=='[data-damage-drill]') return [];
  return [...this.innerHTML.matchAll(/data-damage-drill="([^"]+)" data-damage-value="([^"]+)"/g)].map(m=>({dataset:{damageDrill:m[1],damageValue:m[2]},addEventListener(event,fn){listeners['drill:'+m[1]+':'+m[2]]=fn;}}));
}};
context.root=root;
vm.runInContext('renderLiveDamage(root)',context);
assert.match(root.innerHTML,/สรุปตามประเภทความเสียหาย/);
assert.match(root.innerHTML,/Export Excel/);
assert.match(root.innerHTML,/34\.15/);
listeners['#damageExportLive:click']();
assert.equal(context.exported.length,4);
assert.equal(context.exported[1].rows[0][4],'ระบบ');
assert.equal(context.exported[1].rows[0][6],34.15);
assert.equal(context.exported[1].rows[0][10],'ไม่ระบุเวลา');
assert.equal(context.exported[1].rows[0][12],'รอยืนยันกะ');
assert.match(root.innerHTML,/สรุปความเสียหายรายเดือน/);
assert.match(root.innerHTML,/ยอดรวมแยกกะ/);
assert.match(root.innerHTML,/ยอดรวมแยกพนักงาน/);
listeners['#damageCategoryFilter:change']({target:{value:'employee'}});
assert.doesNotMatch(root.innerHTML,/TEST-ONLY-1/);
context.liveDamageState.category='ALL';
context.liveDamageState.rows=[
  {id:'A1',date:'2026-10-01',company:'MC8',shift:'X1',employee:'A',time:'23:59:00',amount:500,cause:'[damage:v2:employee] test',exceptionId:'-'},
  {id:'B1',date:'2026-10-02',company:'MC8',shift:'X1',employee:'B',amount:1000,cause:'[damage:v2:pm] test',exceptionId:'-'},
  {id:'C1',date:'2026-10-02',company:'MC8',shift:'X5',employee:'C',amount:100,cause:'[damage:v2:game] test',exceptionId:'-'},
];
vm.runInContext('renderLiveDamage(root)',context);
listeners['drill:shift:X1']();
assert.equal(context.liveDamageState.shift,'X1');
assert.doesNotMatch(root.innerHTML,/>C1</);
listeners['drill:employee:A']();
listeners['#damageExportLive:click']();
assert.equal(context.exported[1].rows.length,1);
assert.equal(context.exported[1].rows[0][6],500);
assert.equal(context.exported[1].rows[0][10],'23:59:00');
listeners['#damageDrillReset:click']();
assert.equal(context.liveDamageState.shift,'ALL');
assert.equal(context.liveDamageState.employee,'ALL');
listeners['#damageMonthApply:click']();
assert.equal(context.state.filters.from,'2026-10-01');
assert.equal(context.state.filters.to,'2026-10-31');
assert.equal(context.rendered,true);
vm.runInContext('renderLiveDamage(root)',context);
if(process.env.DAMAGE_PREVIEW) fs.writeFileSync(process.env.DAMAGE_PREVIEW,`<!doctype html><html lang="th"><meta charset="utf-8"><title>ทดสอบหน้าความเสียหาย ไม่ใช่ข้อมูลจริง</title><link rel="stylesheet" href="http://127.0.0.1:8765/styles.css"><body><main style="padding:28px"><p>ทดสอบหน้าจอด้วยข้อมูลสมมติ ไม่ใช่ทะเบียนจริง</p>${root.innerHTML}</main></body></html>`);
console.log('Damage view: rendered category summary, filter and Excel export verified with synthetic records');
