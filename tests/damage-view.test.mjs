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
  $:s=>({addEventListener:(event,fn)=>listeners[s+':'+event]=fn}), Charts:{draw:()=>{}},bindStoredFileLinks:()=>{},
  go:()=>{},exportSheets:(name,sheets)=>{context.exported=sheets;},toast:()=>{},
});
vm.runInContext(fs.readFileSync(new URL('../damage-summary.js',import.meta.url),'utf8')+'\n'+app.slice(start,end),context);
const root={innerHTML:'',querySelectorAll:()=>[]};
context.root=root;
vm.runInContext('renderLiveDamage(root)',context);
assert.match(root.innerHTML,/สรุปตามประเภทความเสียหาย/);
assert.match(root.innerHTML,/Export Excel/);
assert.match(root.innerHTML,/34\.15/);
listeners['#damageExportLive:click']();
assert.equal(context.exported.length,2);
assert.equal(context.exported[1].rows[0][4],'ระบบ');
assert.equal(context.exported[1].rows[0][6],34.15);
if(process.env.DAMAGE_PREVIEW) fs.writeFileSync(process.env.DAMAGE_PREVIEW,`<!doctype html><html lang="th"><meta charset="utf-8"><title>ทดสอบหน้าความเสียหาย ไม่ใช่ข้อมูลจริง</title><link rel="stylesheet" href="http://127.0.0.1:8765/styles.css"><body><main style="padding:28px"><p>ทดสอบหน้าจอด้วยข้อมูลสมมติ ไม่ใช่ทะเบียนจริง</p>${root.innerHTML}</main></body></html>`);
listeners['#damageCategoryFilter:change']({target:{value:'employee'}});
assert.doesNotMatch(root.innerHTML,/TEST-ONLY-1/);
console.log('Damage view: rendered category summary, filter and Excel export verified with synthetic records');
