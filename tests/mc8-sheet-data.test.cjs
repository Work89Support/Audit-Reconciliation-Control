const assert=require('node:assert/strict');
const {analyze,cents}=require('../mc8-sheet-data.js');
const headers=['id','status','realAmount','customerId',null,'รหัส','เวลา','ประเภท','ยูสเซอร์','จำนวน','หมายเหตุ'];
const schema={sheets:[{name:'CP ฝ',headers}]};
const source={name:'CP ฝ',rows:[headers,['a','successed','150','u','',1,'2026-09-16 17:14','ฝาก','u',150,''],['','','','','',150,'','','',150,''],['','','','','ข้ามวัน',2,'2026-09-16 00:15','ฝาก','u',150,'']],rowNumbers:[1,2,248,250],formulas:{C248:'SUM(C2:C247)',J248:'SUM(J2:J247)'}};
let s=analyze([source],schema)[0];
assert.equal(s.pmTotal,15000);assert.equal(s.boTotal,30000);assert.equal(s.manualBo,15000);
assert.equal(s.rows.length,2);assert.equal(s.issues[0].row,250);assert.ok(s.issues[0].flags.includes('ข้ามวัน'));
assert.equal(cents('0'),0);assert.equal(cents(''),null);assert.equal(cents('1,234.56'),123456);
assert.equal(analyze([],schema)[0].missing,true);
const broken=structuredClone(source);broken.rows[1][2]='';
assert.ok(analyze([broken],schema)[0].errors.length);
const duplicate=structuredClone(source);duplicate.rows[0][3]='realAmount';
assert.ok(analyze([duplicate],schema)[0].errors.length);
const statuses=structuredClone(source);statuses.rows[1][1]='PARTIAL';
assert.equal(analyze([statuses],schema)[0].pmTotal,0);
for(const name of ['AT ถ','M ถ']) {
  const h=['id','status','transferredAmount','amount','รหัส','เวลา','ประเภท','ยูสเซอร์','จำนวน'];
  const wb={name,rows:[h,['a','PARTIAL','355','550',123,'2026-09-16','ถอน','u',355]]};
  const r=analyze([wb],{sheets:[{name,headers:h}]})[0];
  assert.equal(r.pmTotal,35500);assert.equal(r.boTotal,35500);
}
console.log('MC8 data: subtotal exclusion, cross-day, statuses, amounts, missing data passed');
