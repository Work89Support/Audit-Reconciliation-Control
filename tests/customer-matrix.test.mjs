// Synthetic format contracts, not a claim that every original file was audited.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const box={performance,console}; vm.createContext(box);
for(const file of ['formats.js','engine.js']) vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),box);
const {Engine,Formats}=vm.runInContext('({Engine,Formats})',box);
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
const banks=['KBANK','KBNK','SCB','KTB','BBL','GSB','BAAC','TTB','BAY','KKP','UOB','CIMB','LHB','TISCO','GHB'];
let stmChecks=0,pmChecks=0;
for(const company of companies) for(const bank of banks) for(const direction of ['deposit','withdraw']) {
  const base={company,account:'4311918665',date:'2026-09-07',sec:36000,amount:3,direction,rowNo:1};
  const s={...base,desc:`${direction==='deposit'?'รับโอนจาก':'โอนไป'} ${bank} x0060 ตัวอย่างลูกค้า`};
  const b={...base,sec:36005,custAccount:'1251510060'};
  const result=await Engine.reconcile([s],[b],{},[],null);
  assert.equal(result.customerIdentityMatched,1,`${company}/${bank}/${direction}`);
  assert.equal(result.matchEvidence[0].customer.stm.last4,'0060');
  assert.equal(result.matchEvidence[0].customer.stm.account,'');
  assert.equal(result.matchEvidence[0].customer.stm.name,'ตัวอย่างลูกค้า');
  assert.equal(result.matchEvidence[0].direction,direction);
  assert.equal(result.matchEvidence[0].account,'4311918665');
  stmChecks++;
}
for(const company of companies) for(const provider of ['AUTOPEER','AZPAY','COREPAY','CPXM','MYPAY','CYBERPLUS']) for(const token of ['D','W']) {
  const label=token==='D'?'ฝาก':'ถอน';
  const headers=['วันเวลา','รหัสสมาชิก','เลขบัญชีสมาชิก','ชื่อบัญชีสมาชิก','ชื่อธนาคารสมาชิก','OrderId','PaymentId','Ref1','Ref2',`จำนวนเงิน${label}`,'ค่าธรรมเนียม',token==='D'?'รับสุทธิ':'ถอนสุทธิ','สถานะ'];
  const entry=['2026-09-07 12:00:00','TEST-USER','0012345678','ทดสอบ','KBANK','TEST-ORDER','TEST-PAYMENT','','',100,2,98,'Success'];
  const parsed=Formats.parse(`${company}_PM_${provider}_${token}_2026-09-07.xlsx`,[headers,entry,[...entry.slice(0,-1),'Time out']],'2026-09-07');
  assert.equal(parsed.records.length,1);
  const r=parsed.records[0];
  assert.equal(r.direction,token==='D'?'deposit':'withdraw');
  assert.equal(r.subco,company);
  assert.equal(r.account,provider==='CPXM'?'COREPAY':provider);
  assert.equal(r.custAccount,'0012345678');
  assert.equal(r.custBank,'KBANK',`${company}/${provider}/${token}: customer bank`);
  pmChecks++;
}
console.log(`Synthetic customer contracts: ${stmChecks} bank/company/direction combinations; ${pmChecks} PM combinations passed`);
