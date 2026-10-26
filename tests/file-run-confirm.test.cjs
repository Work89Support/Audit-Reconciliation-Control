const assert=require('node:assert/strict'),fs=require('node:fs');
const ui=require('../file-run-management.js');
let dialog,focused,opened=0,closed=0;
const previous={isConnected:true,focus(){focused='previous';}};
global.AuditUi={open(){opened++;},close(){closed++;}};
global.document={activeElement:previous,body:{appendChild(el){assert.equal(el,dialog);}},createElement(tag){
 assert.equal(tag,'dialog');const listeners={},buttons={};
 for(const key of ['[data-cancel]','[data-accept]'])buttons[key]={focus(){focused=key;}};
 dialog={listeners,buttons,setAttribute(k,v){this[k]=v;},querySelector(k){return buttons[k];},addEventListener(k,v){listeners[k]=v;},showModal(){this.open=true;},remove(){this.removed=true;}};
 return dialog;
}};
(async()=>{
 let settled=false;
 const p=ui.confirmAction({title:'ทบทวน <script>',message:'FR8\n2026-10-18 <img>',confirmLabel:'บันทึกเวอร์ชัน'}).then(v=>{settled=true;return v;});
 assert.equal(settled,false);assert.equal(focused,'[data-cancel]');
 assert.match(dialog.innerHTML,/&lt;script&gt;/);assert.match(dialog.innerHTML,/FR8\n2026-10-18 &lt;img&gt;/);
 dialog.buttons['[data-cancel]'].onclick();assert.equal(await p,false);assert.equal(focused,'previous');
 const yes=ui.confirmAction({title:'แก้วัน',message:'เก็บไฟล์เดิม'});dialog.buttons['[data-accept]'].onclick();assert.equal(await yes,true);
 let permission=true;const denied=ui.confirmAction({title:'แก้วัน',message:'x',allowed:()=>permission});permission=false;dialog.buttons['[data-accept]'].onclick();assert.equal(await denied,false);
 const escape=ui.confirmAction({title:'พักบอท',message:'x'});let prevented=false;dialog.listeners.cancel({preventDefault(){prevented=true;}});assert.equal(await escape,false);assert.ok(prevented);
 const close=ui.confirmAction({title:'ปิด',message:'x'});dialog.listeners.close();assert.equal(await close,false);
 assert.equal(opened,5);assert.equal(closed,5);
 const app=fs.readFileSync('app.js','utf8'),scope=app.slice(app.indexOf('function openFileRunManagement('),app.indexOf('function chooseFileRunManagement('));
 assert.doesNotMatch(scope,/window\.confirm/);assert.equal((scope.match(/FileRunManagement\.confirmAction/g)||[]).length,5);
 assert.match(scope,/ยังไม่รันจนกดยืนยันในขั้นถัดไป/);
 console.log('PASS file review confirmation: no automatic writes/run, cancel and Escape safe, permission rechecked, original editor retained, HTML escaped, browser confirm removed from file workflow');
})().catch(e=>{console.error(e);process.exitCode=1;});
