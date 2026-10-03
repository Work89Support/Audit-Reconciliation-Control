import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
const ctx = { performance, console, setTimeout };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('formats.js','utf8') + '\n' + fs.readFileSync('engine.js','utf8') + '\nthis.engine=Engine;this.formats=Formats;', ctx);
const common = { company:'UFABET7M', subco:'UFABET7M', date:'2026-10-02', amount:3000, sec:53520 };
const stm = [
  { ...common, account:'1953583301', direction:'deposit', balance:3154.20, rowNo:40, source_file_id:'kb', raw:'รับโอน 3000 BAY X5104' },
  { ...common, account:'1953583301', direction:'deposit', balance:6154.20, rowNo:41, source_file_id:'kb', raw:'รับโอน 3000 BAY X5104' },
  { ...common, account:'0639274201', direction:'withdraw', balance:37854.53, sec:53530, rowNo:80, source_file_id:'tmn', raw:'เงินออก -3000 promptpay_bay_fundout' },
  { ...common, account:'0639274201', direction:'withdraw', balance:34854.53, sec:53577, rowNo:81, source_file_id:'tmn', raw:'เงินออก -3000 promptpay_bay_fundout' },
];
const bo = [
  { ...common, account:'0639274201', direction:'deposit', amount:-3000, rowNo:1664, source_file_id:'bo', raw:'โยกเงินออก | โยกเข้า KB กิตติ 3000' },
  { ...common, account:'1953583301', direction:'withdraw', rowNo:1665, source_file_id:'bo', raw:'โยกเงินเข้า | รับยอด TMN สรวิศา 3000' },
  { ...common, account:'0639274201', direction:'deposit', amount:-3000, rowNo:1666, source_file_id:'bo', raw:'โยกเงินออก | โยกเข้า kb กิตติ 3000' },
  { ...common, account:'1953583301', direction:'withdraw', rowNo:1667, source_file_id:'bo', raw:'โยกเงินเข้า | รับยอด TMN สรวิศา 3000' },
];
const run=(s,b)=>ctx.engine.reconcile(s,b,{toleranceDeposit:90,toleranceWithdraw:180},[],null);
const result=await run(stm,bo);
assert.equal(result.matched,4);
assert.equal(result.exceptions.length,0);
assert.equal(new Set(result.matchEvidence.map(e=>e.bo.row)).size,4);
assert(result.matchEvidence.every(e=>e.internalTransferGroup?.countPerLeg===2 && e.internalTransferGroup.amountPerLeg===6000));
for (const [label,s,b] of [
  ['missing BO',stm,bo.slice(0,3)],
  ['missing STM',stm.slice(0,3),bo],
  ['wrong balance',stm.map((r,i)=>i===1?{...r,balance:6155.20}:r),bo],
  ['missing balance',stm.map((r,i)=>i===1?{...r,balance:null}:r),bo],
  ['duplicate source row',stm,bo.map((r,i)=>i===3?{...r,rowNo:1665}:r)],
  ['intervening unknown STM row',stm.map((r,i)=>i===1?{...r,rowNo:42}:r),bo],
  ['not 7M',stm.map(r=>({...r,company:'FR8',subco:'FR8'})),bo.map(r=>({...r,company:'FR8',subco:'FR8'}))],
  ['third account', [...stm,{...stm[0],account:'OTHER',source_file_id:'other'}],bo],
]) {
  const r=await run(s,b);
  assert.equal(r.matchEvidence.filter(e=>e.internalTransferGroup).length,0,label);
  assert(r.exceptions.length>0,label);
}
const unmatched=await run(stm.map((r,i)=>i===1?{...r,balance:6155.20}:r),bo);
assert.equal(unmatched.exceptions.filter(e=>e.boSource?.fileId==='bo').length,4);
const script=fs.readFileSync('scripts/build-n8n-worker.mjs','utf8');
const start=script.indexOf('const exceptionIdentity=e=>');
const end=script.indexOf('const eligibleExceptions=',start);
vm.runInContext(script.slice(start,end)+'\nthis.exceptionIdentity=exceptionIdentity;',ctx);
const repeated=unmatched.exceptions.filter(e=>e.account==='1953583301' && e.type==='missing_stm');
assert.equal(repeated.length,2);
assert.notEqual(ctx.exceptionIdentity(repeated[0]),ctx.exceptionIdentity(repeated[1]));
assert.equal(ctx.exceptionIdentity(repeated[0]),ctx.exceptionIdentity({...repeated[0]}));
console.log('7M repeated transfer: balanced 2x2, eight safety guards and source-row case identity passed');
