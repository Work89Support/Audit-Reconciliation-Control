const assert=require('node:assert/strict'),fs=require('node:fs'),ui=require('../source-workspace.js');
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
for(const c of companies){
 const bo={id:'bo',file_name:c+'_BO_2026-10-18.xlsx',company:c,business_date:'2026-10-18',kind:'bo_main',source_origin:'upload',revision:2};
 const pm={...bo,id:'pm',file_name:c+'_PM_2026-10-18.xlsx',kind:'pm_statement',source_origin:'mail'};
 assert.deepEqual(ui.selectedFiles([bo,pm],new Set(['bo','pm']),c,'2026-10-18','mixed').map(f=>f.id),['bo','pm']);
 assert.deepEqual(ui.selectedFiles([bo,pm],new Set(['bo','pm']),c,'2026-10-18','upload').map(f=>f.id),['bo']);
 for(const patch of [{excluded:true},{business_date:'2026-10-19'},{company:'NONE'},{kind:'doc_clarify'}])assert.equal(ui.selectable({...pm,...patch},c,'2026-10-18'),false);
 assert.equal(ui.selectable({...pm,revision:1,file_name:c+'_PM_2026-10-17.xlsx'},c,'2026-10-18'),false);
 assert.equal(ui.selectable({...pm,file_name:'old_wrong_name.xlsx'},c,'2026-10-18'),true,'Reviewed version may retain immutable old filename');
}
const q={file:{name:'PM.csv',size:4},kind:'pm_statement',name:'FR8_PM.csv',reason:'verified input round content',reviewed:true};ui.validateQueued(q);
for(const patch of [{reviewed:false},{reason:'short'},{name:'bad/PM.csv'},{name:'PM.pdf'},{file:{name:'PM.csv',size:0}},{kind:'unsupported'}])assert.throws(()=>ui.validateQueued({...q,...patch}));
assert.equal(ui.canUpload('monitor'),false);assert.equal(ui.canRun('audit_assistant'),false);assert.equal(ui.canUpload('admin'),true);
function fakeHost(){let html='',nodes=[];return {set innerHTML(value){html=value;nodes=[];for(const match of value.matchAll(/<(button|input|select)\b([^>]*)>/g)){const attrs=Object.fromEntries([...match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m=>[m[1],m[2]??true]));const dataset={};for(const [k,v]of Object.entries(attrs))if(k.startsWith('data-'))dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;nodes.push({attrs,dataset,value:attrs.value||'',disabled:!!attrs.disabled,checked:!!attrs.checked,addEventListener(name,fn){this['on'+name]=fn;}});}},get innerHTML(){return html;},querySelectorAll(s){const a=s.match(/^\[([^\]]+)\]$/)?.[1];return a?nodes.filter(n=>Object.hasOwn(n.attrs,a)):[];},querySelector(s){return this.querySelectorAll(s)[0]||null;}};}
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
(async()=>{
 for(const c of companies){
  const host=fakeHost();let actor='actor-'+c,adds=0,run=null,confirm=false,changed=false;
  const files=[{id:'bo',file_name:c+'_BO_2026-10-18.xlsx',company:c,business_date:'2026-10-18',kind:'bo_main',source_origin:'upload',revision:2},{id:'pm',file_name:c+'_PM_2026-10-18.xlsx',company:c,business_date:'2026-10-18',kind:'pm_statement',source_origin:'mail',revision:2}];
  const opts={page:'run',company:c,date:'2026-10-18',companies,actor:()=>actor,role:()=> 'admin',active:()=>true,load:async()=>({files:files.map(f=>({...f,revision:changed?3:2}))}),confirm:async()=>confirm,add:async(b,f)=>{adds++;assert.equal(f.name,c+'_PM_2026-10-18.csv');assert.equal(b.name,c+'_new.csv');return {source_file_id:'stored'};},run:(company,date,ids)=>{run={company,date,ids};}};
  let mounted=ui.mount(host,opts);await flush();assert.equal(adds,0);assert.equal(run,null);
  host.querySelectorAll('[data-select]').forEach(b=>{b.checked=true;b.onchange();});
  await host.querySelector('[data-review]').onclick();changed=true;await host.querySelector('[data-run]').onclick();assert.equal(run,null,'Changed source revisions cannot reach request UI');changed=false;
  await host.querySelector('[data-review]').onclick();await host.querySelector('[data-run]').onclick();assert.deepEqual(run.ids,['bo','pm']);assert.equal(run.company,c);mounted.dispose();
  mounted=ui.mount(host,{...opts,page:'upload'});await flush();const input=host.querySelectorAll('[data-files]').find(x=>x.dataset.files==='pm_statement');input.files=[{name:c+'_PM_2026-10-18.csv',size:4}];input.onchange();
  host.querySelector('[data-q-name]').value=c+'_new.csv';host.querySelector('[data-q-name]').oninput();host.querySelector('[data-q-reason]').value='verified actual input content';host.querySelector('[data-q-reason]').oninput();host.querySelector('[data-q-reviewed]').checked=true;host.querySelector('[data-q-reviewed]').onchange();
  await host.querySelector('[data-upload]').onclick();assert.equal(adds,0,'Cancel confirmation sends no bytes');
  confirm=true;await host.querySelector('[data-upload]').onclick();assert.equal(adds,1,'Only explicit confirmed upload reaches transport');mounted.dispose();
 }
 const app=fs.readFileSync('app.js','utf8'),code=fs.readFileSync('source-workspace.js','utf8');assert.match(app,/load:Sb.sourceWorkspace,add:Sb.addAuditManualSource/);assert.doesNotMatch(code,/acceptManualPrimary|confirmAccountRecheck|setAuditRunHold|fetch\(/);
 console.log('PASS nine companies: source filters, exact selected IDs, upload cancel, confirmed mock upload, wrong scope/excluded/evidence rejection, latest-version handoff, original filename and staged-only run. No production uploads/runs.');
})().catch(e=>{console.error(e);process.exitCode=1;});
