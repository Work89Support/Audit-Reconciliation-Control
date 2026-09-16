const assert=require('node:assert/strict');
const fs=require('node:fs');
async function test(Window){
 const w=new Window({url:'http://localhost'});
 w.eval(fs.readFileSync('preliminary-review.js','utf8')+'\nwindow.PreliminaryReview=PreliminaryReview;');
 w.eval(fs.readFileSync('review-overview.js','utf8')+'\nwindow.ReviewOverview=ReviewOverview;');
 const root=w.document.createElement('main');w.document.body.append(root);
 const cases=Array.from({length:51},(_,i)=>({id:`c${i}`,code:`EX-${i}`,run_id:'r',company:'MC8',status:'open',direction:'ถอน',ex_type:'time_diff',business_date:'2026-09-15',bo_date:'2026-09-15',stm_date:'2026-09-15',time_diff_sec:300,account:'COREPAY',system_amount:100,bank_amount:100,bo_raw:`${2717119+i} | d | ถอน | ออโต้ | u | cp | 100 | 0 | 0 | d | sapan: ${i.toString(16).padStart(24,'0')}`,stm_raw:`uuid${i} | 100 | corepay | SUCCESSED | ${2717119+i} | ${i.toString(16).padStart(24,'0')}`}));
 let exported,opened,bulk;
 await w.ReviewOverview.mount(root,{company:'MC8',date:'2026-09-15',load:async()=>({complete:true,run:{id:'r',matched:0,jobStatus:'completed',summary:{match_evidence:[]}},cases}),onExport:(...a)=>exported=a,onCase:e=>opened=e,onBulkClose:(...a)=>bulk=a,onCompany:()=>{}});
 assert(root.querySelector('#preliminaryApprove').disabled);
 root.querySelector('#preliminaryFilter').click();
 assert.equal(root.querySelectorAll('input[aria-label^="เลือกเคส"]').length,50);
 root.querySelector('#preliminaryAll').click();
 root.querySelector('#preliminaryApprove').click();
 assert.equal(bulk[0].length,51);assert.equal(bulk[1].company,'MC8');assert.equal(bulk[1].date,'2026-09-15');
 assert(cases.every(e=>e.status==='open'),'selection and opening approval must not close cases');
 root.querySelector('#preliminaryExport').click();assert.equal(exported[1][0].rows.length,51);
 root.querySelector('#overviewNext').click();assert(root.querySelector('input[aria-label="เลือกเคส EX-50"]').checked);
 root.querySelector('#preliminaryOpen').click();assert.equal(opened.id,'c0');
 root.querySelector('#preliminaryClear').click();assert(root.querySelector('#preliminaryExport').disabled);
 assert(root.querySelector('#preliminaryApprove').disabled);
 assert(cases.every(e=>e.status==='open'));
 console.log('Preliminary UI: 51 cases across pages, select/export/open/clear; no status mutation passed');
 w.happyDOM.abort();
}
// Supply the installed DOM implementation explicitly; production has no dependency.
import(process.env.AUDIT_DOM_MODULE || 'happy-dom').then(({Window})=>test(Window)).catch(e=>{console.error(e);process.exitCode=1;});
