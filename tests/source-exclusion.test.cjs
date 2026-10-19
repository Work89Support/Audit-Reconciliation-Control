const assert=require('node:assert/strict'),fs=require('node:fs'),ui=require('../file-exclusion.js');
for(const r of ['monitor','audit_assistant','exec',null])assert.equal(ui.canManage(r),false);
for(const r of ['lead','admin'])assert.equal(ui.canManage(r),true);
assert.throws(()=>ui.validate({id:'x',revision:2,blocked:true,message:'used primary'},'enough reason'),/used primary/);
assert.throws(()=>ui.validate({id:'x',revision:2},'short'),/10/);
ui.validate({id:'x',revision:2,blocked:false},'verified duplicate file');
const code=fs.readFileSync('file-exclusion.js','utf8'),app=fs.readFileSync('app.js','utf8'),sb=fs.readFileSync('supabase.js','utf8');
assert.match(code,/if\(!yes\|\|!sameActor\(\)\|\|!canManage\(opts.role\(\)\)\)return/);
assert.match(code,/expectedRevision:review.revision/);assert.match(code,/result\?\.excluded!==!review.excluded/);
assert.doesNotMatch(code,/opts\.save\([\s\S]*opts\.confirm\(/);
assert.match(app,/!f.excluded &&/);assert.match(app,/if\(files.some\(file=>file.excluded\)\)throw/);
assert.match(sb,/โหลดสถานะยกเว้นไฟล์ไม่ครบ/);
assert.doesNotMatch(code,/markParsed|confirmAccountRecheck|setAuditRunHold|acceptManualPrimary|delete|upload|fetch\(/);
console.log('PASS exclusion UI: role guard, reason, confirm/cancel boundary, exact revision, saved receipt, no financial/run/hold actions, fail-closed cloud state.');
// Exercise actual handlers using synthetic DOM and mocked transport only.
let dialog,saves=0,confirmations=0,allow=true,currentActor='a',blocked=false;
global.document={activeElement:{isConnected:true,focus(){}},body:{appendChild(){}},createElement(){
 const nodes={};dialog={setAttribute(){},querySelector(key){return nodes[key]||(nodes[key]={});},addEventListener(){},showModal(){},remove(){this.removed=true;}};return dialog;
}};
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
const options={fileId:'x',role:()=> 'admin',actor:()=>currentActor,preview:async()=>({id:'x',name:'PM.xlsx',company:'SK8',date:'2026-10-18',revision:2,excluded:false,blocked,message:blocked?'used primary':'unchanged originals'}),confirm:async()=>{confirmations++;return allow;},save:async b=>{saves++;return {excluded:b.excluded};}};
(async()=>{
 let p=ui.open(options);await flush();dialog.querySelector('[data-close]').onclick();assert.equal(await p,false);assert.equal(saves,0);
 p=ui.open(options);await flush();dialog.querySelector('[data-reason]').oninput({target:{value:'short'}});await dialog.querySelector('[data-review]').onclick();assert.equal(confirmations,0);assert.equal(saves,0);dialog.querySelector('[data-close]').onclick();await p;
 allow=false;p=ui.open(options);await flush();dialog.querySelector('[data-reason]').oninput({target:{value:'verified duplicate file'}});await dialog.querySelector('[data-review]').onclick();assert.equal(saves,0,'Cancel confirmation never saves');dialog.querySelector('[data-close]').onclick();await p;
 allow=true;p=ui.open(options);await flush();currentActor='other';await dialog.querySelector('[data-review]').onclick();assert.equal(saves,0,'Actor change blocks saving');dialog.querySelector('[data-close]').onclick();await p;currentActor='a';
 blocked=true;p=ui.open(options);await flush();dialog.querySelector('[data-reason]').oninput({target:{value:'verified duplicate file'}});await dialog.querySelector('[data-review]').onclick();assert.equal(saves,0,'Primary use blocks even forced handler invocation');dialog.querySelector('[data-close]').onclick();await p;blocked=false;
 p=ui.open(options);await flush();dialog.querySelector('[data-reason]').oninput({target:{value:'verified duplicate file'}});await dialog.querySelector('[data-review]').onclick();assert.equal(await p,true);assert.equal(saves,1);
 console.log('PASS real exclusion handlers with fake data: close/cancel, short reason, blocked primary, actor switch, explicit confirm and receipt; zero production writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
