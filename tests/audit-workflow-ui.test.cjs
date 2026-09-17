const assert=require('node:assert/strict');
const fs=require('node:fs');
async function test(Window){
  const w=new Window({url:'http://localhost'});
  w.eval(fs.readFileSync('review-overview.js','utf8')+'\nwindow.ReviewOverview=ReviewOverview;');
  const root=w.document.createElement('main');w.document.body.append(root);
  const cases=Array.from({length:3},(_,i)=>({id:'c'+i,code:'EX-'+i,company:'AT4',business_date:'2026-09-15',run_id:'r',status:i===2?'closed':'open',ex_type:'missing_bo',direction:'ฝาก',account:'PM',system_amount:100,bank_amount:100}));
  let loaded=[],batch,opened=0,dates=[];
  const options={company:'AT4',date:'2026-09-17',load:async(c,d)=>{loaded.push(d);return {complete:true,run:{id:'r',matched:0,jobStatus:'completed',summary:{match_evidence:[]}},cases};},onCase:()=>opened++,onCompany:()=>{},onDateChange:d=>dates.push(d),onBatchStatus:(items,opts)=>batch={items,opts}};
  await w.ReviewOverview.mount(root,options);
  const input=root.querySelector('#overviewDate');input.value='2026-09-15';input.dispatchEvent(new w.Event('change'));await w.happyDOM.whenAsyncComplete();
  assert.equal(loaded.at(-1),'2026-09-15');assert.equal(dates.at(-1),'2026-09-15');
  const selects=root.querySelectorAll('[data-audit-action]');selects[0].value='clarify';selects[0].dispatchEvent(new w.Event('change'));
  const second=root.querySelector('[data-audit-action="c1"]');second.value='close';second.dispatchEvent(new w.Event('change'));
  assert.equal(opened,0);assert.equal(batch,undefined,'staging cannot write');
  assert(root.querySelector('#auditSaveStatuses').textContent.includes('(2)'));
  // Background remount must retain historical date and pending choices.
  await w.ReviewOverview.mount(root,options);
  assert.equal(root.querySelector('#overviewDate').value,'2026-09-15');
  assert(root.querySelector('#auditSaveStatuses').textContent.includes('(2)'));
  assert(root.querySelector('[aria-label="เลือกเปลี่ยนสถานะ EX-2"]').disabled);
  root.querySelector('#auditSaveStatuses').click();
  assert.deepEqual(Array.from(batch.items,x=>x.action),['clarify','close']);assert.equal(batch.opts.date,'2026-09-15');
  await batch.opts.onComplete();assert(root.querySelector('#auditSaveStatuses').disabled);
  assert.equal(root.querySelector('#overviewDate').value,'2026-09-15');assert.equal(opened,0);
  console.log('Audit workflow UI: historical date, remount, staged mixed batch, closed guard, no drawer passed');
  w.happyDOM.abort();
}
import(process.env.AUDIT_DOM_MODULE||'happy-dom').then(({Window})=>test(Window)).catch(e=>{console.error(e);process.exitCode=1;});
