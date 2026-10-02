import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL('../formats.js', import.meta.url), 'utf8') + '\nglobalThis.F = Formats;', context);
const header = ['id','provider','status','updateTime','amount','transferredAmount','P2P จ่าย','Progress','customerId'];
// This suite covers legacy partial-payout fallbacks. XB-company strict source
// columns are covered separately in xb-provider-columns.test.mjs.
const parse = (provider, direction, data) => context.F.parse(`AT4_PM_${provider}_${direction}_2026-09-11.xlsx`, [header, ...data], '2026-09-11');
const row = (status, requested, paid, p2p = '', progress = '', provider = 'AUTOPEER') => ['W1',provider,status,'2026-09-11 21:15:00',requested,paid,p2p,progress,'3win21150'];
for (const provider of ['AUTOPEER','ATP','MYPAY']) {
  const p = parse(provider, 'W', [row('PARTIAL',550,355,'','',provider), row('PARTIAL',195,161,'','',provider), row('SUCCESSED',100,100,'','',provider)]);
  assert.deepEqual(Array.from(p.records, r=>r.amount), [355,161,100]);
  assert.deepEqual(Array.from(p.records, r=>r.unpaidAmount), [195,34,null]);
  assert.equal(p.records[0].partial,true);
  assert.equal(p.records[2].partial,false);
  assert.equal(p.records[0].account,provider === 'ATP' ? 'AUTOPEER' : provider);
}
// Missing/zero/invalid actual paid must never fall back to requested or rounded Progress.
for (const paid of ['',0,'bad','355 (550)',-1,'355.123']) {
  const p = parse('AUTOPEER','W',[row('PARTIAL',550,paid,'',550)]);
  assert.equal(p.records.length,0);
  assert.ok(Object.keys(p.dropped).some(k=>k.startsWith('PARTIAL')));
}
assert.equal(parse('AUTOPEER','W',[row('PARTIAL',550,600)]).records.length,0);
assert.equal(parse('AUTOPEER','W',[row('PARTIAL',550,'','355.45',355)]).records[0].amount,355.45);
assert.equal(parse('AUTOPEER','W',[row('SUCCESS-PARTIAL',550,'','355.45',355)]).records[0].amount,355.45);
assert.equal(parse('AUTOPEER','D',[row('PARTIAL',550,355)]).records.length,0);
assert.equal(parse('COREPAY','W',[row('PARTIAL',550,355,'','','COREPAY')]).records.length,0);
// The provider in the source row is authoritative, even when the filename is
// mislabeled. Do not reject valid AUTOPEER payouts based on a COREPAY filename,
// or allow COREPAY partial payouts based on an AUTOPEER filename.
const mislabeledAutopeer = parse('COREPAY','W',[row('PARTIAL',550,355)]);
assert.equal(mislabeledAutopeer.records.length,1);
assert.equal(mislabeledAutopeer.records[0].account,'AUTOPEER');
assert.equal(mislabeledAutopeer.records[0].amount,355);
assert.equal(parse('AUTOPEER','W',[row('PARTIAL',550,355,'','','COREPAY')]).records.length,0);
assert.equal(parse('AUTOPEER','W',[row('RETURN',550,0),row('PENDING',550,0)]).records.length,0);

// System 123 reconciliation uses completed transactions only. Pending rows are
// not settled evidence and must not inflate the denominator or open cases.
const sys123PendingHeader = ['วันที่ทำรายการ','Ref Id','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินฝาก','สถานะ'];
const sys123PendingRow = ['2026-09-11 10:15:00','REF-123','member-1','1234567890',500,'Pending'];
const pending123 = context.F.parse('AT4_PM_LOCALPAY_D_2026-09-11.xlsx',[sys123PendingHeader,sys123PendingRow],'2026-09-11');
assert.equal(pending123.records.length,0);

// AZPAY can emit a pending-only withdrawal sheet without any timestamp column.
// It is still a recognized PM control file and every row is deliberately
// excluded as non-success; it must not fall through as an unreadable workbook.
const pendingOnlyNoDateHeader = ['PaymentId','Ref1','Ref2','จำนวนเงินถอน','ค่าธรรมเนียม','ถอนสุทธิ','สถานะ'];
const pendingOnlyNoDateRow = ['2dfec976a9','2efbf1d7-1983-4942-abda-a92dfec976a9','',150000,0,150000,'Pending'];
const pendingOnlyNoDate = context.F.parse('FR8_PM_AZPAY_W_2026-09-27.xlsx',[pendingOnlyNoDateHeader,pendingOnlyNoDateRow],'2026-09-27');
assert.equal(pendingOnlyNoDate.code,'pm_provider');
assert.equal(pendingOnlyNoDate.records.length,0);
assert.equal(pendingOnlyNoDate.dropped['รายการไม่สำเร็จ (PM: pending)'],1);

// The waiver is company-scoped. It must not silently relax XB controls.
const pendingXb = context.F.parse('MC8_PM_COREPAY_D_2026-09-11.xlsx',[sys123PendingHeader,sys123PendingRow],'2026-09-11');
assert.equal(pendingXb.records.length,0);

// System 123 also uses short provider tokens in source file/sheet names.
// They must not remain under the generic PM bucket.
const shortProvider123 = context.F.parse('FR8_PM_CP_D_2026-09-11.xlsx',[sys123PendingHeader,sys123PendingRow],'2026-09-11');
assert.equal(shortProvider123.records.length,0);

// COREPAY deposits contain fee decimals in PM, while BO records the whole-baht
// base amount. Keep the deposit column and canonicalize only this provider rule.
const corepaySuccessRow = ['2026-09-11 10:15:00','REF-CP','member-2','9988776655',100.45,'Success'];
const corepaySuccess = context.F.parse('FR8_PM_CP_D_2026-09-11.xlsx',[sys123PendingHeader,corepaySuccessRow],'2026-09-11');
assert.equal(corepaySuccess.records.length,1);
assert.equal(corepaySuccess.records[0].account,'COREPAY');
assert.equal(corepaySuccess.records[0].amount,100);
console.log('PM partial payout: provider, direction, precision and missing-amount guards passed');
