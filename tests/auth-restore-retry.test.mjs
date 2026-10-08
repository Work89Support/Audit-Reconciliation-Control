import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const boot=source.slice(source.indexOf('async function boot()'),source.indexOf('document.addEventListener("DOMContentLoaded", boot)'));
const nodes=new Map();
const $=selector=>{
  if(!nodes.has(selector)) nodes.set(selector,{value:'unsaved note',addEventListener(){}});
  return nodes.get(selector);
};
let retry,message,entries=0,logins=0,fail=true;
const context={$,Store:{data:{}},DB:{companies:[]},applyStoredState(){},retagTracks(){},openExportDialog(){},
  window:{matchMedia:()=>({matches:true})},
  Sb:{consumeAuthHash:async()=>null,restore:async()=>{if(fail)throw Error('temporary outage');return true;},cfg:()=>({})},
  showConnectingGate:(text,action)=>{message=text;retry=action;},
  showLoginGate:()=>{logins++;},enterProductionApp:async()=>{entries++;}};
vm.runInNewContext(boot,context);
await context.boot();
assert.equal(logins,0,'Transient restore failure is not a logout');
assert.match(message,/ไม่ได้ล้างล็อกอิน/);
assert.equal(typeof retry,'function');
await retry();
assert.equal(logins,0);
assert.match($('#connectionMessage').textContent,/เก็บสถานะเดิม/);
fail=false;
await retry();
assert.equal(entries,1);
assert.equal($('#responseText').value,'unsaved note');
console.log('Boot restore outage: recoverable retry, no login redirect, and unchanged draft passed');
