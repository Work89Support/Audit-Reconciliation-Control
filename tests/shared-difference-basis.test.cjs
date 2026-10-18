const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=require('../mc8-live-sheets.js'),schema=require('../mc8-sheet-schema.js');
for(const company of api.COMPANIES){
 const base={company,account:'AUTOPEER',direction:'deposit',boDate:'2026-10-17',boTime:'2026-10-17 10:00:00'};
 const pair={...base,key:'pair',kind:'matched',isPair:true,boAmount:1000,pmAmount:1000,boSource:{fileId:'bo',row:1},pmSource:{fileId:'stm',row:1},bo:{reference:'pair'},pm:{reference:'pair'},pmDate:'2026-10-17'};
 const cross=[2,300].map((amount,i)=>({...base,key:`cross-${i}`,kind:'pending_next_day',exType:'cross_day',crossDay:true,boAmount:amount,pmAmount:null,boSource:{fileId:'bo',row:i+2},bo:{reference:`cross-${i}`},pm:{},case:{id:`cross-${i}`,status:'pending_next_day'}}));
 const waiting=[20000,40000,40000].map((amount,i)=>({...base,key:`wait-${i}`,kind:'closed',waiting:true,isPair:false,boAmount:amount,pmAmount:null,boSource:{fileId:'bo',row:i+4},bo:{reference:'note'},pm:{},case:{id:`wait-${i}`,status:'closed',customer_details:{account_review_hold_id:'keep-original'}}}));
 const rows=[pair,...cross,...waiting],before=JSON.stringify(rows);
 const openWaiting=rows.map(r=>r.waiting?{...r,kind:'waiting_source',case:{...r.case,status:'open'}}:r);
 for(const selected of [rows,openWaiting,rows.filter(r=>!r.waiting),waiting,rows.slice(1,3),[]]){
  const s=api.summarize(selected),view=api.tableView(selected,company,'2026-10-17',true,'all',schema);
  const footer=api.providerFooter(view.headers,view.rows,'all',undefined,s);
  const cells=[...footer.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]);
  const shown=Number(cells[view.headers.indexOf('ผลต่างยอด')].replace(/,/g,''));
  assert.equal(shown,s.diffAfterCents/100,company+' filtered DOM footer');
  const exported=api.buildAuditExportSheets(selected,company,'2026-10-17',true,schema);
  const all=exported.find(x=>x.name==='ข้อมูลทั้งหมด'),summary=exported.find(x=>x.name==='สรุป');
  assert.equal(all.footerRows[0][all.headers.indexOf('ผลต่างยอด')],s.diffAfterCents/100);
  assert.equal(summary.footerRows[0][summary.headers.indexOf('ผลต่าง')],s.diffAfterCents/100);
  for(const sheet of exported.slice(2)){
   const i=sheet.headers.indexOf('ผลต่างยอด');if(i<0)continue;
   assert.equal(sheet.footerRows[0][i],s.diffAfterCents/100,company+' account footer');
  }
 }
 const total=api.summarize(rows);
 assert.equal(total.waitingBoCents,10000000);assert.equal(total.closedWaitingBoCount,3);
 assert.equal(total.diffAfterCents,-30200);assert.equal(total.boCents,10130200);
 const display=api.tableView(rows,company,'2026-10-17',true,'all',schema);
 const missingStmRows=display.rows.filter(r=>[20000,40000].includes(r[display.headers.indexOf('BO · ยอด')]));
 assert.equal(missingStmRows.length,3,'exercise every closed waiting-source row');
 for(const r of missingStmRows)
  assert.equal(r[display.headers.indexOf('ผลต่างยอด')],'','never invent a per-row STM difference');
 assert.equal(JSON.stringify(rows),before,'never change sources, amounts, states, history or hold markers');
}
const source=fs.readFileSync('mc8-live-sheets.js','utf8');
assert.ok(source.includes('providerFooter(fullView.headers,fullView.rows,layoutSheet,visible,scope)'));
assert.ok(source.includes('ผลต่างไม่รวม BO รอ STM/PM'));
console.log('PASS shared difference basis: all nine companies, closed/open waiting BO, mixed and filtered scopes, zero/nonzero totals, web/account/export parity; missing STM rows remain blank; original amounts/cases/holds immutable. No live writes.');
