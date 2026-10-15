const assert=require('node:assert/strict');
const fs=require('node:fs');
const sheets=require('../mc8-live-sheets.js'),schema=require('../mc8-sheet-schema.js');
const data={run:{company:'3XB',business_date:'2026-10-14',summary:{}},cases:[{
 id:'fixture-case',code:'EX-3008',company:'3XB',account:'AZPAY',direction:'ฝาก',status:'clarifying',ex_type:'cross_day',
 bo_date:'2026-10-14',bo_time:'20:45:00',system_amount:100.68,bank_amount:null,
 customer_details:{bo:{reference:'TEST-REF',user:'TEST-USER'},source_rows:{bo:{fileId:'fixture-bo',row:3}}},
 bo_raw:'TEST-REF | 2026-10-14 20:45 | ฝาก | ออโต้ | TEST-USER | AZPAY | 100.68 | 100.68 | 1.60 | 2026-10-15 00:18 | | Admin'
}]};
const original=JSON.stringify(data),rows=sheets.rowsOf(data,'3XB');
assert.equal(sheets.filter(rows,'all','all','pending_next_day').length,1,'cross-day case remains visible while waiting for clarification');
assert.equal(sheets.filter(rows,'all','all','review').length,0,'do not contradict cross-day label');
const closed=sheets.rowsOf({...data,cases:[{...data.cases[0],status:'closed'}]},'3XB');
assert.equal(sheets.filter(closed,'all','all','pending_next_day').length,0,'closed history not pending');
const view=sheets.tableView(rows,'3XB','2026-10-14',true,'AZ ฝ',schema);
assert.equal(view.rows[0][view.headers.indexOf('เวลา')],'2026-10-14 20:45:00');
assert.equal(view.rows[0][view.headers.indexOf('เวลาทำรายการ')],'2026-10-15 00:18');
const xlsx=sheets.buildAuditExportSheets(rows,'3XB','2026-10-14',true,schema);
const exported=xlsx.find(s=>s.headers.includes('BO · เวลาทำรายการต้นทาง'));
assert.ok(exported.rows.some(row=>row[exported.headers.indexOf('BO · เวลาทำรายการต้นทาง')]==='2026-10-15 00:18'),'Excel shares exact source-time mapping');
const noTime=rows.map(row=>({...row,boRaw:''}));
const empty=sheets.tableView(noTime,'3XB','2026-10-14',true,'AZ ฝ',schema);
assert.equal(empty.rows[0][empty.headers.indexOf('เวลาทำรายการ')],'','never invent source time from creation time');
assert.equal(JSON.stringify(data),original,'source record and amounts unchanged');
assert.match(fs.readFileSync('mc8-live-sheets.js','utf8'),/row.boTransactionTime=original.boTransactionTime/);
console.log('PASS AZPAY: source execution time, cross-day filtering including clarifying, closed-history exclusion, web/Excel parity, no data writes.');
