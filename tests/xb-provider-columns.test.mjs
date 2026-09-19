import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox={console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../formats.js',import.meta.url),'utf8')+'\n;globalThis.__Formats=Formats;',sandbox);
const Formats=sandbox.__Formats;
const companies=['3XB','MC8','MR9','PS8','UR9'];
const providers=[
  ['AUTOPEER','transferredAmount'],
  ['AZPAY','amount'],
  ['COREPAY','amount'],
  ['MYPAY','transferredAmount'],
];
const headers=['id','provider','status','paymentTime','expiredTime','updateTime','requestTime','realAmount','transferredAmount','amount','customerId'];
const values=['ROW-1','', 'successed','2026-09-15 10:01:02','2026-09-15 11:02:03','2026-09-15 12:03:04','2026-09-15 13:04:05',101,202,303,'member'];

for(const company of companies) for(const [provider,withdrawAmount] of providers){
  const depositRow=[...values];depositRow[1]=provider;
  const deposit=Formats.parse(`${company}_PM_${provider}_D_2026-09-15.xlsx`,[headers,depositRow],'2026-09-15').records[0];
  assert.equal(deposit.sec,10*3600+60+2,`${company} ${provider} deposit uses paymentTime`);
  assert.equal(deposit.amount,101,`${company} ${provider} deposit uses realAmount`);
  assert.equal(deposit.timeColumn,'paymentTime');
  assert.equal(deposit.amountColumn,'realAmount');

  const expiredOnly=[...depositRow];expiredOnly[3]='';
  const expired=Formats.parse(`${company}_PM_${provider}_D_2026-09-15.xlsx`,[headers,expiredOnly],'2026-09-15').records[0];
  assert.equal(expired.sec,11*3600+2*60+3,`${company} ${provider} deposit falls back to expiredTime`);
  assert.equal(expired.timeColumn,'expiredTime');

  const withdrawalRow=[...values];withdrawalRow[1]=provider;
  const withdrawal=Formats.parse(`${company}_PM_${provider}_W_2026-09-15.xlsx`,[headers,withdrawalRow],'2026-09-15').records[0];
  assert.equal(withdrawal.sec,12*3600+3*60+4,`${company} ${provider} withdrawal uses updateTime`);
  assert.equal(withdrawal.amount,withdrawAmount==='transferredAmount'?202:303,`${company} ${provider} withdrawal amount source`);
  assert.equal(withdrawal.timeColumn,'updateTime');
  assert.equal(withdrawal.amountColumn,withdrawAmount);
}

const noPayment=[...values];noPayment[1]='AUTOPEER';noPayment[3]='';noPayment[4]='';
assert.equal(Formats.parse('PS8_PM_AUTOPEER_D_2026-09-15.xlsx',[headers,noPayment],'2026-09-15').records.length,0,'requestTime cannot replace missing paymentTime and expiredTime');
const noReal=[...values];noReal[1]='AZPAY';noReal[7]='';
assert.equal(Formats.parse('MC8_PM_AZPAY_D_2026-09-15.xlsx',[headers,noReal],'2026-09-15').records.length,0,'amount cannot replace missing realAmount');
const noUpdate=[...values];noUpdate[1]='COREPAY';noUpdate[5]='';
assert.equal(Formats.parse('UR9_PM_COREPAY_W_2026-09-15.xlsx',[headers,noUpdate],'2026-09-15').records.length,0,'other time columns cannot replace missing updateTime');

console.log('XB provider column policy passed for 5 companies, 4 providers and both directions.');
