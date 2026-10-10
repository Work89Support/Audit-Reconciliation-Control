const assert=require('node:assert/strict'),fs=require('node:fs');
const sheets=require('../mc8-live-sheets.js'),schema=require('../mc8-sheet-schema.js');
(async()=>{
 const data={run:{id:'test-run',company:'MC8',business_date:'2026-10-09',summary:{}},cases:[]};
 const source={company:'MC8',date:'2026-10-09',sec:3600,direction:'withdraw',amount:5,rowNo:2,account:'CUSTOM',boIdentityRaw:'บัญชีทดสอบตามชื่อ BO',ref:'test-ref',raw:'synthetic BO row'};
 await sheets.hydrateBoOperators(data,[{id:'test-file',file_name:'test.xlsx',kind:'bo_main',company:'MC8',parsed:true}],async()=>[source,{...source,company:'3XB'},{...source,date:'2026-10-08'}]);
 let rows=sheets.rowsOf(data,'MC8');assert.equal(rows.length,1);assert.equal(rows[0].account,source.boIdentityRaw);
 assert.equal(rows[0].pmAmount,null);assert.equal(sheets.filter(rows,'all','withdraw','all','bo-account:'+source.boIdentityRaw).length,1);
 const exportSheet=sheets.buildAuditExportSheets(rows,'MC8','2026-10-09',false,schema).find(s=>s.name===source.boIdentityRaw);
 assert.equal(exportSheet.rows[0][exportSheet.headers.indexOf('BO ถอน')],5);
 assert.equal(exportSheet.rows[0][exportSheet.headers.indexOf('BO ฝาก')],'');
 data.cases=[{id:'test-case',company:'MC8',account:'CUSTOM',direction:'ถอน',system_amount:5,bank_amount:null,status:'open',bo_raw:source.raw,bo_date:source.date,bo_time:'01:00:00',customer_details:{bo:{reference:source.ref},source_rows:{bo:{fileId:'test-file',row:2}},waiting_source:true,bo_account_label:source.boIdentityRaw}}];
 rows=sheets.rowsOf(data,'MC8');assert.equal(rows.length,1);assert.equal(rows[0].case.id,'test-case');assert.equal(rows[0].waiting,true);assert.equal(sheets.summarize(rows).diffAfterCents,0);
 console.log('BO account sheets and review-case safety tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
