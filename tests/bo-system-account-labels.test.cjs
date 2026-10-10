const assert=require('node:assert/strict');
const sheets=require('../mc8-live-sheets.js'),schema=require('../mc8-sheet-schema.js');
const mapping=[['3XB','ยืม PM บ้านอื่น 123456789','ยืม PM บริษัทอื่น'],['FR8','999999999999 : Manual','999999999999 : Manual'],['AT4','0000000009 : Manual','0000000009 : Manual'],['SK8','1111111111: Manual','1111111111 : Manual'],['SK8','2222222222: Manual','2222222222 : Manual'],['UFABET7M','บัญชีPM บ้านอื่น(ยืม) บัญชีPM บ้านอื่น(ยืม)','บัญชีPM บ้านอื่น(ยืม)']];
(async()=>{
for(const [company,account,name] of mapping){
 const data={run:{company,business_date:'2026-10-09',summary:{}},cases:[]};
 await sheets.hydrateBoOperators(data,[{id:'test-source',company,kind:'bo_main',parsed:true,file_name:'test.xlsx'}],async()=>['deposit','withdraw'].map((direction,i)=>({company,account,boIdentityRaw:account,date:'2026-10-09',sec:3600+i,direction,amount:i?7:5,rowNo:i+2,ref:'test-'+i,raw:'synthetic source '+i})));
 const rows=sheets.rowsOf(data,company);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>sheets.sheetOf(r)===name));
 const workbook=sheets.buildAuditExportSheets(rows,company,'2026-10-09',false,schema),fullLabel=sheets.accountReviewGroups(rows)[0].label,exportName=workbook.find(s=>s.name==='สรุป').rows.find(r=>r[1]===fullLabel)[0],target=workbook.find(s=>s.name===exportName);
 assert.equal(workbook.slice(2).length,company==='3XB'?1:2);
 assert.equal(target.rows.length,company==='3XB'?2:1);
 const deposit=workbook.slice(2).find(s=>s.rows.some(r=>r[s.headers.indexOf('BO ฝาก')]===5)),withdraw=workbook.slice(2).find(s=>s.rows.some(r=>r[s.headers.indexOf('BO ถอน')]===7));
 assert.equal(deposit.footerRows[0][deposit.headers.indexOf('BO ฝาก')],5);
 assert.equal(withdraw.footerRows[0][withdraw.headers.indexOf('BO ถอน')],7);
 assert.ok(workbook.slice(2).every(s=>s.rows.every(r=>r[s.headers.indexOf('บัญชีบริษัท / Provider')]===rows[0].account)));
 if(company!=='3XB')assert.ok(!workbook.some(s=>s.name==='ยืม PM บริษัทอื่น'));
 const normalized=workbook.map(s=>s.name.replace(/[:\\/?*\[\]]/g,' ').trim().slice(0,31).toLowerCase());
 assert.equal(new Set(normalized).size,normalized.length,'Excel names must remain unique after colon sanitization');
}
 assert.equal(sheets.sheetOf({company:'FR8',account:'1111111111: Manual',direction:'withdraw'}),'OTHER','do not mix company-specific manual accounts');
 assert.equal(sheets.sheetOf({company:'UFABET7M',account:'ยืม PM บ้านอื่น 123456789',direction:'deposit'}),'OTHER','XB vocabulary does not leak into 7M');
 console.log('System-specific BO account labels, separate directions, original identity and unique Excel names passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
