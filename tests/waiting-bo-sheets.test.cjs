const assert=require('node:assert/strict');
const sheets=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
// Synthetic BO-only transaction: no statement is invented, no case is closed.
const waiting={company:'UFABET7M',account:'CP PAYMENT ถอน 0000000001',direction:'ถอน',systemAmount:5,
  boDate:'2026-10-09',boTime:'14:12:00',boRaw:'synthetic BO withdrawal',
  boSource:{fileId:'test-bo',row:1},customerDetails:{bo:{user:'test-member',performedBy:'test-operator'}}};
const input={run:{summary:{waiting_bo:[waiting,{...waiting,company:'FR8'}]}},cases:[]};
const before=JSON.stringify(input);
const rows=sheets.rowsOf(input,'UFABET7M');
assert.equal(rows.length,1);
assert.equal(sheets.sheetOf(rows[0]),'CP ถ');
assert.equal(rows[0].boTime,'2026-10-09 14:12:00');
assert.equal(rows[0].pmAmount,null);
assert.equal(rows[0].case,undefined);
assert.match(sheets.auditStatus(rows[0]),/ยังไม่มี STM\/PM/);
assert.equal(sheets.filter(rows,'all','all','waiting_source').length,1);
const summary=sheets.summarize(rows);
assert.equal(summary.boCents,500);
assert.equal(summary.boCount,1);
assert.equal(summary.pmCount,0);
assert.equal(summary.matchedCount,0);
assert.equal(summary.waitingBoCount,1);
assert.equal(summary.diffAfterCents,0,'missing statement must not become financial loss');
const exportSheets=sheets.buildAuditExportSheets(rows,'UFABET7M','2026-10-09',true,schema);
const cp=exportSheets.find(s=>s.name===waiting.account);
assert.equal(cp.rows.length,1);
assert.ok(cp.headers.filter(h=>h.startsWith('STM/PM ·')).every(h=>cp.rows[0][cp.headers.indexOf(h)]===''),'all absent PM columns remain blank');
assert.equal(cp.rows[0][cp.headers.indexOf('BO · ยอด')],5);
assert.equal(cp.rows[0][cp.headers.indexOf('บัญชีบริษัท / Provider')],waiting.account);
assert.equal(cp.rows[0][cp.headers.indexOf('BO · ผู้ดำเนินการ')],'test-operator');
assert.equal(cp.rows[0][cp.headers.indexOf('ผลต่างยอด')],'');
assert.equal(cp.rowTones[0],'warning');
assert.match(exportSheets.find(s=>s.name==='สรุป').rows.find(r=>r[1]===waiting.account)[8],/รอข้อมูล/);
assert.equal(JSON.stringify(input),before);
assert.equal(sheets.rowsOf({run:{summary:{waiting_bo:{}}},cases:[]}).length,0);
assert.equal(sheets.rowsOf({run:{summary:{waiting_bo:[waiting,waiting]}},cases:[]},'UFABET7M').length,1);
const existing={id:'case-test',company:'UFABET7M',account:waiting.account,direction:'ถอน',system_amount:5,
  bo_raw:waiting.boRaw,bo_date:waiting.boDate,bo_time:waiting.boTime,
  customer_details:{bo:waiting.customerDetails.bo,source_rows:{bo:waiting.boSource}}};
assert.equal(sheets.rowsOf({...input,cases:[existing]},'UFABET7M').length,1,'do not count BO again when a case represents it');
console.log('BO-only account sheet and export tests passed');
const snapshotInput={run:{company:'UFABET7M',business_date:'2026-10-09',summary:{},boWaitingSnapshot:{company:'UFABET7M',business_date:'2026-10-09',waiting_bo:[waiting]}},cases:[]};
assert.equal(sheets.rowsOf(snapshotInput,'UFABET7M')[0].boAmount,5,'parse-only reporting snapshot does not need an accepted reconciliation run');
assert.equal(sheets.rowsOf({...snapshotInput,run:{...snapshotInput.run,business_date:'2026-10-08'}},'UFABET7M').length,0,'snapshot must match business date');
for(const company of ['3XB','MC8','MR9','PS8','UR9','FR8','AT4','SK8','UFABET7M']){
  const w={...waiting,company};
  const d={run:{company,business_date:w.boDate,summary:{waiting_bo:[w]}},cases:[]};
  const baseline=sheets.summarize(sheets.rowsOf(d,company));
  const h={...existing,company,id:'closed-history',code:'OLD-CASE',status:'closed',business_date:w.boDate,customer_details:{...existing.customer_details,waiting_source:true}};
  const linked=sheets.rowsOf({...d,waitingHistory:[h]},company);
  assert.equal(linked.length,1);assert.equal(linked[0].key,h.id);assert.equal(linked[0].code,h.code);
  assert.equal(linked[0].case.status,'closed');assert.match(sheets.auditStatus(linked[0]),/ปิดเคสแล้ว/);
  assert.deepEqual(sheets.summarize(linked),baseline,'history must not alter financial results');
  assert.equal(sheets.rowsOf({...d,waitingHistory:[{...h,customer_details:{...h.customer_details,source_rows:{bo:{...w.boSource,row:99}}}}]},company)[0].case,undefined,'equal amount is not identity');
}
