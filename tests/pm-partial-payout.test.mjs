import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL('../formats.js', import.meta.url), 'utf8') + '\nglobalThis.F = Formats;', context);
const header = ['id','provider','status','updateTime','amount','transferredAmount','P2P จ่าย','Progress','customerId'];
// This suite covers legacy partial-payout fallbacks. XB-company strict source
// columns are covered separately in xb-provider-columns.test.mjs.
const parse = (provider, direction, data) => context.F.parse(`AT4_PM_${provider}_${direction}_2026-09-11.xlsx`, [header, ...data], '2026-09-11');
const row = (status, requested, paid, p2p = '', progress = '') => ['W1','autopeer',status,'2026-09-11 21:15:00',requested,paid,p2p,progress,'3win21150'];
for (const provider of ['AUTOPEER','ATP','MYPAY']) {
  const p = parse(provider, 'W', [row('PARTIAL',550,355), row('PARTIAL',195,161), row('SUCCESSED',100,100)]);
  assert.deepEqual(Array.from(p.records, r=>r.amount), [355,161,100]);
  assert.deepEqual(Array.from(p.records, r=>r.unpaidAmount), [195,34,null]);
  assert.equal(p.records[0].partial,true);
  assert.equal(p.records[2].partial,false);
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
assert.equal(parse('COREPAY','W',[row('PARTIAL',550,355)]).records.length,0);
assert.equal(parse('AUTOPEER','W',[row('RETURN',550,0),row('PENDING',550,0)]).records.length,0);

// System 123 files can retain `pending` after BO already contains the
// transaction. Keep the row as evidence; the reconciliation matcher still
// requires the configured member/account/amount identity before closure.
const sys123PendingHeader = ['วันที่ทำรายการ','Ref Id','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินฝาก','สถานะ'];
const sys123PendingRow = ['2026-09-11 10:15:00','REF-123','member-1','1234567890',500,'Pending'];
const pending123 = context.F.parse('AT4_PM_LOCALPAY_D_2026-09-11.xlsx',[sys123PendingHeader,sys123PendingRow],'2026-09-11');
assert.equal(pending123.records.length,1);
assert.equal(pending123.records[0].amount,500);
assert.equal(pending123.records[0].status,'pending');

// The waiver is company-scoped. It must not silently relax XB controls.
const pendingXb = context.F.parse('MC8_PM_COREPAY_D_2026-09-11.xlsx',[sys123PendingHeader,sys123PendingRow],'2026-09-11');
assert.equal(pendingXb.records.length,0);

// System 123 also uses short provider tokens in source file/sheet names.
// They must not remain under the generic PM bucket.
const shortProvider123 = context.F.parse('FR8_PM_CP_D_2026-09-11.xlsx',[sys123PendingHeader,sys123PendingRow],'2026-09-11');
assert.equal(shortProvider123.records.length,1);
assert.equal(shortProvider123.records[0].account,'COREPAY');
console.log('PM partial payout: provider, direction, precision and missing-amount guards passed');
