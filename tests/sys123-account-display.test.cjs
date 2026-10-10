const assert=require('node:assert/strict'),api=require('../mc8-live-sheets.js'),schema=require('../mc8-sheet-schema.js');
const rows=[];
function add(account,direction,bo=true){const index=rows.length;rows.push({key:'r'+index,company:'FR8',account,boAccountLabel:bo?account:'',direction,kind:bo?'matched':'review',isPair:bo,boAmount:bo?index+1:null,pmAmount:index+1,boDate:bo?'2026-10-09':'',pmDate:'2026-10-09',bo:bo?{reference:'bo'+index}:{},pm:{reference:'pm'+index}});}
for(const d of ['withdraw','deposit'])for(const a of ['4311918665','4311918665 : Manual','4311918665 : sms','AUTOPEER','AUTOPEER-ATPPRDEXT307 : AUTOPEER','COREPAY','CPXM-598 : CP','CYBERPLUS','Cyberplus-3 : Cyberplus'])add(a,d);
add('999999999999 : Manual','deposit');add('999999999999 : Manual','withdraw');
add('AUTOPEER','withdraw',false);add('CYBERPLUS','deposit',false);
const before=JSON.stringify(rows),groups=api.accountReviewGroups(rows);
assert.equal(groups.length,10);
assert.deepEqual(new Set(groups.map(g=>g.label)),new Set(['4311918665 : Manual ถอน','4311918665 : Manual ฝาก','AUTOPEER ถอน','AUTOPEER ฝาก','COREPAY ถอน','COREPAY ฝาก','CYBERPLUS ถอน','CYBERPLUS ฝาก','999999999999 : Manual ถอน','999999999999 : Manual ฝาก']));
assert.equal(groups.flatMap(g=>g.rows).length,rows.length);assert.equal(new Set(groups.flatMap(g=>g.rows)).size,rows.length);
assert.deepEqual(api.summarize(groups.flatMap(g=>g.rows)),api.summarize(rows));
assert.equal(JSON.stringify(rows),before,'do not alter source labels, amounts, matches or case states');
for(const g of groups)assert.deepEqual(api.filter(rows,'all','all','all',g.key),g.rows);
const exported=api.buildAuditExportSheets(rows,'FR8','2026-10-09',true,schema);
assert.equal(exported.length,12);assert.equal(new Set(exported.map(s=>s.name)).size,12);
assert.deepEqual(exported[1].rows.map(r=>r[1]),groups.map(g=>g.label));
assert.equal(exported.slice(2).flatMap(s=>s.rows).length,rows.length);
for(const company of ['AT4','SK8']){
  const bank='6517248040';
  const bankRows=['deposit','withdraw'].flatMap((direction,i)=>[
    {...rows[0],company,account:bank,boAccountLabel:bank,direction,key:`${company}-${i}-number`},
    {...rows[0],company,account:bank,boAccountLabel:`BBL ชื่อบัญชี ${bank}`,direction,key:`${company}-${i}-named`},
    {...rows[0],company,account:bank,boAccountLabel:`${bank} : Manual`,direction,key:`${company}-${i}-manual-channel`},
    {...rows[0],company,account:bank,boAccountLabel:'',direction,key:`${company}-${i}-stm`,isPair:false,boAmount:null,boDate:'',bo:{}}
  ]);
  const prior=JSON.stringify(bankRows),bankGroups=api.accountReviewGroups(bankRows);
  assert.deepEqual(bankGroups.map(g=>g.label),[`${bank} ถอน`,`${bank} ฝาก`]);
  assert.ok(bankGroups.every(g=>g.rows.length===4&&g.rows.every(r=>r.direction===g.direction)));
  assert.deepEqual(api.summarize(bankGroups.flatMap(g=>g.rows)),api.summarize(bankRows));
  assert.equal(JSON.stringify(bankRows),prior);
  const bankSheets=api.buildAuditExportSheets(bankRows,company,'2026-10-09',true,schema);
  assert.deepEqual(bankSheets.slice(2).map(s=>s.name),[`${bank} ถอน`,`${bank} ฝาก`]);
}
console.log('FR8/AT4/SK8 direction groups, bank-number labels, alias consolidation and unchanged persisted evidence passed');
