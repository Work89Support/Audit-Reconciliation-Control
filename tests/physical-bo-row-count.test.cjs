const assert=require('node:assert/strict');
const api=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
const amounts=[50,50,50,30,50,20,30,200,20,20,20,40,40,60,50,20,168,100,111,80];
const late=[100,80,100,100,100,55,100,100,124];
for(const company of api.COMPANIES){
 const account='TEST-SCB',fileId=`bo-${company}`;
 const input={run:{business_date:'2026-10-17',summary:{match_evidence:amounts.map((amount,i)=>({company,account,direction:'deposit',amount,
  bo:{fileId,row:i+2,date:'2026-10-17',sec:3600+i*60},stm:{fileId:`stm-${company}`,row:i+2,date:'2026-10-17',sec:3600+i*60},
  customer:{bo:{reference:i===7?'ไม่จับ':i===9?'ยอดไม่จับ':'บอทไม่จับ'},stm:{reference:`STM-${i}`}}}))}},
 cases:late.map((amount,i)=>({id:`late-${i}`,code:`EX-${3000+i}`,company,account,direction:'ฝาก',business_date:'2026-10-17',bo_date:'2026-10-17',bo_time:`23:${String(10+i).padStart(2,'0')}:00`,system_amount:amount,bank_amount:null,status:'open',ex_type:'cross_day',bo_raw:`source row ${100+i}`,
 customer_details:{bo:{reference:'บอทไม่จับ'},source_rows:{bo:{fileId,row:100+i},stm:null},account_review_hold_id:'preserved-hold-marker'}}))};
 const before=JSON.stringify(input),rows=api.rowsOf(input,company),snapshot=JSON.stringify(rows);
 const s=api.summarize(rows);
 assert.equal(rows.length,29,company);
 assert.equal(s.pmCount,20,company);assert.equal(s.matchedCount,20,company);
 assert.equal(s.boCount,29,company);assert.equal(s.boCents,206800,company);
 assert.equal(s.crossDayCount,9,company);assert.equal(s.crossDayBoCents,85900,company);
 assert.equal(s.unmatchedBoCount,9,company);assert.equal(s.unmatchedBoCents,85900,company);
 assert.equal(s.diffBeforeCents,0,company);assert.equal(s.diffAfterCents,-85900,company);
 const same={...rows[0],key:'another-warning',isPair:false,bo:{reference:'different note'},pmAmount:null,pm:{},pmDate:''};
 assert.equal(api.summarize([...rows,same]).boCount,29,company);
 const another={...same,key:'separate-file',boSource:{...rows[0].boSource,fileId:'different-file'}};
 assert.equal(api.summarize([...rows,another]).boCount,30,company);
 assert.equal(api.summarize([rows[0],{...rows[0],bo:{}}]).boCount,1,company);
 assert.ok(api.buildAuditExportSheets(rows,company,'2026-10-17',true,schema).length>2,company);
 assert.equal(JSON.stringify(rows),snapshot,'summary/export must not mutate rows, cases, amounts or holds');
 assert.equal(JSON.stringify(input),before,'source reports must remain immutable');
}
const legacy={key:'legacy',company:'PS8',account:'AUTOPEER',direction:'deposit',boAmount:100,boDate:'2026-10-17',bo:{reference:'genuine-id'}};
assert.equal(api.summarize([legacy,{...legacy,key:'same'}]).boCount,1);
console.log('PASS physical BO identity across nine companies: 20 matched + 9 cross-day = 29 / 2068; 9 / 859 cross-day; exact-row duplicates, distinct files/rows, legacy fallback, immutable reports/cases/holds and shared exports. No production writes.');
