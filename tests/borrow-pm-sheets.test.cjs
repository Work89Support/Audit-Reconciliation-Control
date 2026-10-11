const assert=require('node:assert/strict');
const sheets=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
(async()=>{
 const data={run:{company:'3XB',business_date:'2026-10-09',summary:{}},cases:[]};
 const source=[['withdraw',80000],['deposit',8000],['withdraw',8000],['deposit',20000]].map(([direction,amount],i)=>({company:'3XB',date:'2026-10-09',sec:3600+i,bankDate:'2026-10-09',bankSec:4000+i,account:'ยืม PM บ้านอื่น 123456789',direction,amount,rowNo:i+2,ref:`test-${i}`,memberCode:'test',raw:`test row ${i}`}));
 await sheets.hydrateBoOperators(data,[{id:'test-file',company:'3XB',kind:'bo_main',parsed:true,file_name:'test.xlsx'}],async()=>[...source,{...source[0],company:'FR8'},{...source[0],date:'2026-10-08'},{...source[0],kind:'bookkeeping'},{...source[0],originalType:'โบนัส'}]);
 const rows=sheets.rowsOf(data,'3XB');
 assert.equal(rows.length,4);
 assert.ok(rows.every(r=>sheets.sheetOf(r)==='ยืม PM บริษัทอื่น'&&r.pmAmount===null&&!r.case));
 assert.equal(sheets.summarize(rows).matchedCount,0);
 assert.equal(sheets.summarize(rows).diffAfterCents,0);
 const workbook=sheets.buildAuditExportSheets(rows,'3XB','2026-10-09',false,schema);
 const details=workbook.slice(2);
 assert.equal(details.length,1);
 assert.equal(details.reduce((n,s)=>n+s.rows.length,0),4);
 const deposit=details[0],withdraw=details[0];
 assert.equal(deposit.footerRows[0][deposit.headers.indexOf('BO ฝาก')],28000);
 assert.equal(withdraw.footerRows[0][withdraw.headers.indexOf('BO ถอน')],88000);
 assert.ok(details.every(sheet=>sheet.rows.every(row=>row[sheet.headers.indexOf('ไฟล์ BO ต้นทาง')]==='test.xlsx')));
 assert.ok(details[0].rows.every(row=>row[details[0].headers.indexOf('BO · เวลาทำรายการต้นทาง')].startsWith('2026-10-09 01:06:')));
 const view=sheets.tableView(rows,'3XB','2026-10-09',false,sheets.accountReviewGroups(rows)[0].key,schema);
 assert.ok(view.headers.includes('ประเภท')&&view.headers.includes('BO ฝาก')&&view.headers.includes('BO ถอน'));
 assert.equal(workbook.filter(s=>s.name.startsWith('STM')).length,0);
 data.run.summary.waiting_bo=[data.borrowBo[0]];
 assert.equal(sheets.rowsOf(data,'3XB').length,4,'deduplicate worker snapshot and direct BO by source');
 data.cases=[{id:'existing',company:'3XB',account:'123456789',direction:'ถอน',system_amount:80000,bo_raw:'test row 0',bo_date:'2026-10-09',bo_time:'01:00:00',customer_details:{bo:{reference:'test-0'},source_rows:{bo:{fileId:'test-file',row:2}}}}];
 const classified=sheets.rowsOf(data,'3XB');
 assert.equal(classified.length,4);
 assert.ok(classified.every(row=>sheets.sheetOf(row)==='ยืม PM บริษัทอื่น'),'use exact original source identity for already represented BO');
 console.log('Borrow PM: source-only BO, company/day isolation, deposit/withdraw totals and deduplication passed');
 // Production-shaped canonical snapshot must retain ten distinct BO sources,
 // including equal amounts in opposite directions and at different times.
 const amounts=[46000,35000,75305,120000,89000];
 const sourceTen=['withdraw','deposit'].flatMap((direction,d)=>amounts.map((amount,i)=>({
   company:'3XB',date:'2026-10-10',account:'123456789',
   boIdentityRaw:'ยืม PM บ้านอื่น 123456789',direction,amount,
   sec:3600+i*60+d,rowNo:10*d+i+2,ref:`borrow-${d}-${i}`,raw:`borrow ${d} ${i}`
 })));
 const ten={run:{company:'3XB',business_date:'2026-10-10',summary:{},
   boWaitingSnapshot:{company:'3XB',business_date:'2026-10-10',waiting_bo:sourceTen.map(r=>({
     company:r.company,account:r.account,direction:r.direction,systemAmount:r.amount,
     boDate:r.date,boTime:`01:0${r.rowNo%5}:00`,boRaw:r.raw,
     boSource:{fileId:'borrow-file',row:r.rowNo},customerDetails:{bo:{reference:r.ref}}
   }))}},cases:[]};
 await sheets.hydrateBoOperators(ten,[{id:'borrow-file',company:'3XB',kind:'bo_main',parsed:true,file_name:'borrow.xlsx'}],async()=>sourceTen);
 const immutable=JSON.stringify(ten),tenRows=sheets.rowsOf(ten,'3XB');
 assert.equal(tenRows.length,10);
 assert.equal(new Set(tenRows.map(r=>r.boSource.row)).size,10);
 assert.ok(tenRows.every(r=>r.account==='ยืม PM บ้านอื่น 123456789'&&r.pmAmount===null&&!r.case));
 const groups=sheets.accountReviewGroups(tenRows);
 assert.equal(groups.length,1);
 assert.equal(groups[0].label,'ยืม PM บ้านอื่น 123456789');
 assert.equal(groups[0].rows.length,10);
 for(const direction of ['deposit','withdraw']){
   const subset=tenRows.filter(r=>r.direction===direction);
   assert.equal(subset.length,5);
   assert.equal(subset.reduce((n,r)=>n+r.boAmount,0),365305);
 }
 const exports=sheets.buildAuditExportSheets(tenRows,'3XB','2026-10-10',false,schema);
 const borrowed=exports.filter(s=>s.name==='ยืม PM บ้านอื่น 123456789');
 assert.equal(borrowed.length,1);
 assert.equal(borrowed[0].rows.length,10);
 assert.equal(borrowed[0].footerRows[0][borrowed[0].headers.indexOf('BO ฝาก')],365305);
 assert.equal(borrowed[0].footerRows[0][borrowed[0].headers.indexOf('BO ถอน')],365305);
 assert.equal(JSON.stringify(ten),immutable,'view/export never mutate source, amounts or cases');
 // Do not borrow a name from another company, direction, amount or row.
 for(const override of [{company:'MC8'},{direction:'deposit'},{systemAmount:1},{boSource:{fileId:'other',row:2}}]){
   const snapshot=ten.run.boWaitingSnapshot.waiting_bo[0];
   const guarded={...ten,run:{...ten.run,boWaitingSnapshot:{...ten.run.boWaitingSnapshot,waiting_bo:[{...snapshot,...override}]}},sourceBo:ten.sourceBo.slice(0,1)};
   const result=sheets.rowsOf(guarded,'3XB');
   if(override.company)assert.equal(result.length,1);
   else assert.equal(result[0].account,'123456789','unproven source label must not be applied');
 }
 console.log('Canonical borrowed waiting snapshot: one named sheet, ten distinct sources and unchanged amounts passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
