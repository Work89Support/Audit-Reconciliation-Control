const assert=require('node:assert/strict'),fs=require('node:fs'),ui=require('../account-recheck.js');
for(const [key,text] of ui.confirmationReasons){assert.equal(ui.confirmationReason(key),text);assert.ok(text.length>=10);}
assert.equal(ui.confirmationReason('unknown'),'');assert.equal(ui.confirmationReason(''),'');
assert.equal(ui.confirmationReason('other','  เหตุผลอื่นสำหรับข้อมูลจำลอง  '),'เหตุผลอื่นสำหรับข้อมูลจำลอง');
const q={company:'TEST',business_date:'2026-10-12',account:'ALL',result:{stm_count:10,bo_count:12,matched:10,exceptions:[{},{}]}};
const html=ui.confirmationHtml(q,'<script>bad</script>');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('ไม่เปิดหรือปิดเคส'));assert.ok(html.includes('ทุกบัญชี'));
let last;global.document={body:{appendChild(){}},createElement(tag){assert.equal(tag,'dialog');const buttons={};last={listeners:{},open:false,setAttribute(){},querySelector(s){return buttons[s]||(buttons[s]={});},addEventListener(name,fn){this.listeners[name]=fn;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},remove(){this.removed=true;}};return last;}};
(async()=>{
 let p=ui.finalConfirmation(q,'ข้อมูลจำลองเท่านั้น');assert.ok(last.open);last.querySelector('[data-final-cancel]').onclick();assert.equal(await p,false);assert.ok(last.removed);
 p=ui.finalConfirmation(q,'ข้อมูลจำลองเท่านั้น');let prevented=false;last.listeners.cancel({preventDefault(){prevented=true;}});assert.equal(await p,false);assert.ok(prevented);
 p=ui.finalConfirmation(q,'ข้อมูลจำลองเท่านั้น',()=>false);last.querySelector('[data-final-accept]').onclick();assert.equal(await p,false);
 p=ui.finalConfirmation(q,'ข้อมูลจำลองเท่านั้น',()=>true);last.querySelector('[data-final-accept]').onclick();assert.equal(await p,true);
 delete global.document;
 const source=fs.readFileSync('account-recheck.js','utf8');assert.ok(source.includes("latest.status!=='ready'||latest.revision!==q.revision"));assert.ok(source.includes('confirmationPending=true'));assert.ok(source.includes('p_expected_revision:latest.revision'));
 assert.ok(fs.readFileSync('app.js','utf8').includes('finalConfirmation:AccountRecheck.finalConfirmation'));console.log('PASS reason dropdown, safe custom text, escaped modal, cancel/Escape, current-role guard, double-click lock and unchanged server revision guard; dummy data only');
})().catch(e=>{console.error(e);process.exitCode=1;});
