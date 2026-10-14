const assert=require('node:assert/strict');
const live=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
const writer=require('../xlsx-writer.js');
const amounts=[3500,120,100,200];
const input={cases:[...amounts.map((amount,i)=>({id:`stm-${i}`,code:`EX-${3010+i}`,company:'UFABET7M',account:'CYBERPLUS',direction:'deposit',status:'open',ex_type:'missing_bo',bank_amount:amount,system_amount:null,stm_date:'2026-10-13',stm_time:'23:57:29',customer_details:{stm:{reference:String(39205108+i)}}})),{id:'bo-only',company:'UFABET7M',account:'CYBERPLUS',direction:'deposit',status:'open',ex_type:'missing_stm',bank_amount:null,system_amount:400}]};
const before=JSON.stringify(input),rows=live.rowsOf(input,'UFABET7M'),totals=live.summarize(rows);
for(const direction of ['deposit','withdraw']){
  const scoped=rows.map(row=>({...row,direction}));
  const view=live.tableView(scoped,'UFABET7M','2026-10-13',true,direction==='deposit'?'CY ฝ':'CY ถ',schema);
  const index=view.headers.indexOf('จำนวนเงิน');
  assert.equal(index,direction==='deposit'?3:7);
  assert.deepEqual(view.rows.map(row=>row[index]).filter(value=>value!==''),amounts);
  assert.equal(view.rows.filter(row=>row[index]==='').length,1,'BO-only remains blank on STM side');
  assert.ok(live.providerFooter(view.headers,view.rows,direction==='deposit'?'CY ฝ':'CY ถ').includes('3,920.00'));
}
const sheets=live.buildAuditExportSheets(rows,'UFABET7M','2026-10-13',true,schema);
const detail=sheets.find(sheet=>sheet.name.includes('CYBERPLUS'));
assert.ok(detail);
assert.deepEqual(detail.rows.map(row=>row[detail.headers.indexOf('STM/PM · ยอด')]).filter(value=>value!==''),amounts);
assert.equal(detail.footerRows[0][detail.headers.indexOf('STM/PM · ยอด')],3920);
assert.equal(JSON.stringify(input),before);
assert.deepEqual(live.summarize(rows),totals);
assert.ok(rows.every(row=>row.case.status==='open'));
(async()=>{const blob=writer.build(sheets,'7M CYBERPLUS');assert.ok(blob.size>1000);console.log('7M CYBERPLUS case amounts: web columns, footer, XLSX, unchanged inputs/status/totals passed');})().catch(error=>{console.error(error);process.exitCode=1;});
