const assert=require('node:assert/strict');
const sheets=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
const data={run:{company:'3XB',business_date:'2026-10-09',summary:{}},cases:[],sourceBo:[]};
const source=(account,direction,amount,ref,row,time)=>({company:'3XB',account,direction,systemAmount:amount,boDate:'2026-10-09',boTime:time,boSource:{fileId:'bo-file',row},customerDetails:{bo:{reference:ref}},boRaw:`${ref}|${time}|${amount}`});
data.sourceBo=[source('-','deposit',5,'placeholder',2,'01:00:00'),
  source('ยืม PM บ้านอื่น 123456789','withdraw',80000,'loan-1',3,'08:08:00'),
  source('ยืม PM บ้านอื่น 123456789','withdraw',80000,'loan-2',4,'08:12:00'),
  source('ยืม PM บ้านอื่น 123456789','deposit',80000,'return-1',5,'08:21:00')];
const rows=sheets.rowsOf(data,'3XB'),snapshot=JSON.stringify(rows),totals=sheets.summarize(rows);
const groups=sheets.accountReviewGroups(rows);
assert.equal(groups.length,1);
assert.ok(groups.every(g=>!g.label.startsWith('-')));
const withdrawal={rows:groups[0].rows.filter(r=>r.direction==='withdraw')};
assert.equal(withdrawal.rows.length,2,'equal amounts at different times with different BO IDs remain separate');
assert.equal(sheets.summarize(withdrawal.rows).boCents,16000000);
assert.equal(sheets.summarize(withdrawal.rows).boCount,2);
assert.equal(groups[0].rows.filter(r=>r.direction==='deposit').length,1,'real borrowed-PM deposit is retained in combined borrowed sheet');
const exported=sheets.buildAuditExportSheets(rows,'3XB','2026-10-09',false,schema);
assert.equal(exported.slice(2).length,1);
assert.equal(exported[0].rows.length,4,'master source trace remains available');
assert.equal(JSON.stringify(rows),snapshot);
assert.deepEqual(sheets.summarize(rows),totals,'saved financial totals unchanged');
for(const company of sheets.COMPANIES){
  const placeholder={...rows[0],company};
  const real={...rows[1],company,account:'AUTOPEER',boAccountLabel:'AUTOPEER'};
  const review=[placeholder,real],before=JSON.stringify(review),saved=sheets.summarize(review);
  assert.equal(sheets.accountReviewGroups(review).length,1,`${company}: exclude placeholder deposit only`);
  const output=sheets.buildAuditExportSheets(review,company,'2026-10-09',false,schema);
  assert.equal(output[0].rows.length,2,`${company}: retain master source rows`);
  assert.equal(output[1].footerRows[0][5],80005,`${company}: retain source total`);
  assert.deepEqual(sheets.summarize(review),saved);
  assert.equal(JSON.stringify(review),before);
  assert.equal(sheets.accountReviewGroups([{...placeholder,direction:'withdraw'}]).length,1,'do not exclude unspecified withdrawals');
  assert.equal(sheets.accountReviewGroups([{...placeholder,isPair:true,pmAmount:5,pmDate:'2026-10-09'}]).length,1,'do not hide a pair or statement evidence');
}
console.log('All companies: placeholder deposit sheet excluded; source rows, equal-amount transactions and saved totals preserved');
