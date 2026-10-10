const assert=require('node:assert/strict');
const {hydrateBoOperators,rowsOf,tableView,buildAuditExportSheets}=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
(async()=>{
 for(const company of ['UFABET7M','3XB','MC8','MR9','PS8','UR9']){
  const fileId='original-bo';
  const data={run:{company,business_date:'2026-10-04',summary:{match_evidence:[{company,account:'AUTOPEER',direction:'withdraw',boAmount:100,stmAmount:100,bo:{fileId,row:3},customer:{bo:{user:'customer-not-operator'}}}]}},cases:[{id:'case',company,account:'AUTOPEER',direction:'ถอน',status:'closed',system_amount:200,bank_amount:200,employee:'audit-assignee-not-operator',approved_by:'head-not-operator',customer_details:{source_rows:{bo:{fileId,row:4}},bo:{user:'other-customer'}}}]};
  const files=[{id:fileId,company,kind:'bo_main',parsed:true,file_name:'BO.xlsx'},{id:'wrong-company',company:'OTHER',kind:'bo_main',parsed:true}];
  let reads=0;
  const errors=await hydrateBoOperators(data,files,async f=>{reads++;assert.equal(f.id,fileId);return [{rowNo:3,company,username:'พนักงาน BO ก'},{rowNo:4,company,performedBy:'พนักงาน BO ข'},{rowNo:5,company:'OTHER',username:'ห้ามข้ามบริษัท'}]});
  assert.equal(reads,1);assert.equal(errors.length,0);
  const rows=rowsOf(data,company);assert.equal(rows[0].bo.performedBy,'พนักงาน BO ก');assert.equal(rows[1].bo.performedBy,'พนักงาน BO ข');
  const view=tableView(rows,company,'2026-10-04',true,'AT ถ',schema);
  assert.deepEqual(view.rows.map(r=>r[view.headers.indexOf('ผู้ดำเนินการ')]),['พนักงาน BO ก','พนักงาน BO ข']);
  const group=require('../mc8-live-sheets.js').accountReviewGroups(rows)[0];
  const accountView=tableView(group.rows,company,'2026-10-04',true,group.key,schema);
  assert.deepEqual(accountView.headers,view.headers,'BO account tab retains the original detailed provider headers');
  assert.deepEqual(accountView.rows,view.rows,'BO account tab retains times, references, statuses and operator values');
  const bankRows=rows.map(r=>({...r,account:'1953583301',boAccountLabel:'KB กิตติ 1953583301',boTime:'2026-10-04 12:00:00',pmTime:'2026-10-04 12:00:01',pmRaw:'ต้นทาง STM',boRaw:'ต้นทาง BO'}));
  const bankGroup=require('../mc8-live-sheets.js').accountReviewGroups(bankRows)[0];
  const bankView=tableView(bankGroup.rows,company,'2026-10-04',true,bankGroup.key,schema);
  assert.ok(bankView.headers.includes('วัน / เวลา Statement')&&bankView.headers.includes('วัน / เวลา BO'));
  assert.deepEqual(bankView.rows.map(r=>r[bankView.headers.indexOf('BO · ผู้ดำเนินการ')]),['พนักงาน BO ก','พนักงาน BO ข']);
  assert.ok(bankView.headers.includes('เลขอ้างอิง Statement')&&bankView.headers.includes('เลขอ้างอิง BO'));
  const exp=buildAuditExportSheets(rows,company,'2026-10-04',true,schema).find(s=>s.name==='AUTOPEER · ถอน');
  assert.deepEqual(exp.rows.map(r=>r[exp.headers.indexOf('BO · ผู้ดำเนินการ')]),['พนักงาน BO ก','พนักงาน BO ข']);
  delete data.boOperators[`${fileId}|4`];assert.equal(rowsOf(data,company)[1].bo.performedBy,'','never substitute Audit/head/customer names');
  const failed=await hydrateBoOperators(data,files,async()=>{throw new Error('source unavailable')});assert.equal(failed.length,1);assert.equal(rowsOf(data,company)[0].bo.performedBy,'');
 }
 console.log('7M and XXX BO operator: exact source file/row, company scope, screen/export equality, failure and no Audit/head fallback passed');
})().catch(e=>{console.error(e);process.exitCode=1});
