const assert=require('node:assert/strict'),api=require('../mc8-live-sheets.js'),schema=require('../mc8-sheet-schema.js');
const rows=[];
function add(account,direction,bo=true){const index=rows.length;rows.push({key:'r'+index,company:'FR8',account,boAccountLabel:bo?account:'',direction,kind:bo?'matched':'review',isPair:bo,boAmount:bo?index+1:null,pmAmount:index+1,boDate:bo?'2026-10-09':'',pmDate:'2026-10-09',bo:bo?{reference:'bo'+index}:{},pm:{reference:'pm'+index}});}
for(const d of ['withdraw','deposit'])for(const a of ['4311918665','4311918665 : Manual','4311918665 : sms','AUTOPEER','AUTOPEER-ATPPRDEXT307 : AUTOPEER','COREPAY','CPXM-598 : CP','CYBERPLUS','Cyberplus-3 : Cyberplus'])add(a,d);
add('999999999999 : Manual','deposit');add('999999999999 : Manual','withdraw');
add('AUTOPEER','withdraw',false);add('CYBERPLUS','deposit',false);
const before=JSON.stringify(rows),groups=api.accountReviewGroups(rows);
assert.equal(groups.length,9);
assert.deepEqual(new Set(groups.map(g=>g.label)),new Set(['4311918665 : Manual ถอน','4311918665 : Manual ฝาก','AUTOPEER ถอน','AUTOPEER ฝาก','COREPAY ถอน','COREPAY ฝาก','CYBERPLUS ถอน','CYBERPLUS ฝาก','999999999999 : Manual']));
assert.equal(groups.flatMap(g=>g.rows).length,rows.length);assert.equal(new Set(groups.flatMap(g=>g.rows)).size,rows.length);
assert.deepEqual(api.summarize(groups.flatMap(g=>g.rows)),api.summarize(rows));
assert.equal(JSON.stringify(rows),before,'do not alter source labels, amounts, matches or case states');
for(const g of groups)assert.deepEqual(api.filter(rows,'all','all','all',g.key),g.rows);
const exported=api.buildAuditExportSheets(rows,'FR8','2026-10-09',true,schema);
assert.equal(exported.length,11);assert.equal(new Set(exported.map(s=>s.name)).size,11);
assert.deepEqual(exported[1].rows.map(r=>r[1]),groups.map(g=>g.label));
assert.equal(exported.slice(2).flatMap(s=>s.rows).length,rows.length);
console.log('FR8 exact requested nine groups, alias consolidation, orphan visibility and unchanged persisted evidence passed');
