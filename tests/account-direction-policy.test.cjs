const assert=require('node:assert/strict');
const api=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
function row(company,account,label,direction,index){return {company,account,boAccountLabel:label,direction,key:index,isPair:true,kind:'matched',boAmount:index+1,pmAmount:index+1,boDate:'2026-10-09',pmDate:'2026-10-09',bo:{reference:`bo-${index}`},pm:{reference:`pm-${index}`}};}
for(const company of api.COMPANIES){
  for(const [account,label,split] of [['AUTOPEER','ATP PAYMENT 00000ATP',true],['5034633029','SCB ภานุพงษ์ 5034633029',['AT4','FR8','SK8'].includes(company)],['0812792075','TMN รุ่งฟ้า 0812792075',['AT4','FR8','SK8','UFABET7M'].includes(company)]]){
    const rows=['deposit','withdraw'].map((d,i)=>row(company,account,label,d,i)),before=JSON.stringify(rows);
    const groups=api.accountReviewGroups(rows);
    assert.equal(groups.length,split?2:1,`${company} ${label}`);
    assert.equal(new Set(groups.flatMap(g=>g.rows)).size,2);
    if(split)for(const g of groups){assert.equal(new Set(g.rows.map(r=>r.direction)).size,1);assert.match(g.label,/ฝาก|ถอน/);}
    for(const g of groups)assert.deepEqual(api.filter(rows,'all','all','all',g.key),g.rows);
    const sheets=api.buildAuditExportSheets(rows,company,'2026-10-09',true,schema);
    assert.equal(sheets.length,2+groups.length);
    assert.equal(new Set(sheets.map(s=>s.name.toLowerCase())).size,sheets.length);
    assert.equal(sheets[1].footerRows[0][4],3);assert.equal(sheets[1].footerRows[0][5],3);
    assert.equal(JSON.stringify(rows),before);
  }
}
for(const [company,account] of [['FR8','999999999999 : Manual'],['AT4','0000000009 : Manual'],['SK8','1111111111 : Manual'],['UFABET7M','บัญชีPM บ้านอื่น(ยืม)'],['3XB','ยืม PM บริษัทอื่น']]){
  assert.equal(api.accountReviewGroups(['deposit','withdraw'].map((d,i)=>row(company,account,account,d,i))).length,company==='FR8'?1:2);
}
for(const company of api.COMPANIES){
  const rows=['deposit','withdraw'].map((d,i)=>row(company,'5034633029',`${d==='deposit'?'ฝาก':'ถอน'} SCB ภานุพงษ์ 5034633029`,d,i));
  assert.equal(api.accountReviewGroups(rows).length,['AT4','FR8','SK8'].includes(company)?2:1,'bank identity combines directional BO aliases only where allowed');
}
const directional=['deposit','withdraw'].map((d,i)=>row('UFABET7M','COREPAY','CP PAYMENT ถอน 0000000001',d,i));
assert.equal(api.accountReviewGroups(directional).length,2,'source label must never override actual transaction direction');
const longLabel='บัญชีPM บ้านอื่น(ยืม) '.repeat(3);
const longSheets=api.buildAuditExportSheets(['deposit','withdraw'].map((d,i)=>row('UFABET7M',longLabel,longLabel,d,i)),'UFABET7M','2026-10-09',true,schema).slice(2);
assert.ok(longSheets.some(s=>s.name.endsWith('ฝาก'))&&longSheets.some(s=>s.name.endsWith('ถอน')),'Excel 31-character limit preserves the direction suffix');
console.log('All nine companies: PM direction split, bank policy, unchanged totals and unique web/export groups passed');
