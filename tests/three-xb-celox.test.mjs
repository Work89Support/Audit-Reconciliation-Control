import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

const context = vm.createContext({ console, performance });
vm.runInContext(
  fs.readFileSync(new URL('../registry.js', import.meta.url), 'utf8')
    + '\n' + fs.readFileSync(new URL('../formats.js', import.meta.url), 'utf8')
    + '\n' + fs.readFileSync(new URL('../engine.js', import.meta.url), 'utf8')
    + '\n;globalThis.__Registry=Registry;globalThis.__Formats=Formats;globalThis.__Engine=Engine;',
  context,
);
const { __Registry: Registry, __Formats: Formats, __Engine: Engine } = context;
const boLabel = 'พร้อมเพย์-CLX(celox)(P2P)';
assert.equal(Formats.canonicalPm(boLabel), 'CELOX');
assert.equal(Registry.matchFile('3X_PM_CELOX_D_2026-11-09.csv').match?.subco, '3XB');
assert.equal(Registry.matchFile('3X_PM_CELOX_W_2026-11-09.csv').match?.provider, 'CELOX');
assert.equal(Registry.matchFile('MR9_PM_CELOX_D_2026-11-09.csv').match, null,
  'CELOX remains inactive for other XB companies');

// These are the deposit/withdraw column shapes of the supplied comparison
// workbook. Each physical PM row must stay separate from BO-only rows.
const depositRows = [[
  'id', 'amount', 'provider', 'status', 'requestTime', 'fee', 'reference',
  'merchantRef', 'systemRef', 'systemOrderNo', 'customerId', 'realAmount',
  'payee', 'paymentTime', 'expiredTime', '_id', 'gatewayId', 'site',
  'submitStatus', 'paymentMethods', 'gateway.name', 'gateway.id',
], [
  'celox-deposit-1', 200, 'celox', 'successed', '2026-11-09 16:20:00', 0,
  'deposit-ref', '', '', '', 'user-deposit', 200, '', '2026-11-09 16:23:42',
  '', 'provider-deposit-1', '', '', '', '', '', '',
]];
const withdrawRows = [[
  'id', 'amount', 'provider', 'status', 'requestTime', 'fee', 'systemRef',
  'systemOrderNo', 'transactionId', 'bankCode', 'bankAccountNo',
  'bankAccountName', 'updateTime', 'gatewayId', 'site', '_id',
  'submitStatus', 'paymentMethods', 'gateway.name', 'gateway.id',
], [
  'celox-withdraw-1', 100, 'celox', 'SUCCESSED', '2026-11-09 16:37:00', 0,
  '', '', 'bo-withdraw-1', 'KBANK', '0000000000', '',
  '2026-11-09 16:38:29', '', '', 'provider-withdraw-1', '', '', '', '',
]];
const deposit = Formats.parse('3X_PM_CELOX_D_2026-11-09.csv', depositRows, '2026-11-09').records;
const withdraw = Formats.parse('3X_PM_CELOX_W_2026-11-09.csv', withdrawRows, '2026-11-09').records;
assert.equal(deposit.length, 1);
assert.equal(withdraw.length, 1);
assert.equal(deposit[0].account, 'CELOX');
assert.equal(withdraw[0].account, 'CELOX');
assert.equal(deposit[0].timeColumn, 'paymentTime');
assert.equal(withdraw[0].timeColumn, 'updateTime');
assert.equal(deposit[0].amountColumn, 'realAmount');
assert.equal(withdraw[0].amountColumn, 'amount');
assert.equal(deposit[0].amount, 200);
assert.equal(withdraw[0].amount, 100);
assert.equal(deposit[0].memberCode, 'user-deposit');
assert.equal(withdraw[0].ref, 'bo-withdraw-1');
assert.equal(Formats.parse('MR9_PM_CELOX_D_2026-11-09.csv', depositRows, '2026-11-09').records.length, 0);

const bo = [
  { rowNo: 1, source: 'bo', formatCode: 'bo_transaction_export', company: '3XB',
    date: '2026-11-09', sec: 16 * 3600 + 23 * 60, direction: 'deposit', amount: 200,
    account: 'CELOX', channel: 'CELOX', isPmChannel: true, memberCode: 'user-deposit',
    ref: 'deposit-ref', raw: boLabel },
  { rowNo: 2, source: 'bo', formatCode: 'bo_transaction_export', company: '3XB',
    date: '2026-11-09', sec: 16 * 3600 + 38 * 60, direction: 'withdraw', amount: 100,
    account: 'CELOX', channel: 'CELOX', isPmChannel: true, memberCode: 'user-withdraw',
    ref: 'bo-withdraw-1', raw: boLabel },
];
const result = await Engine.reconcile([...deposit, ...withdraw], bo, {
  toleranceDeposit: 90, toleranceWithdraw: 180, exactUniqueTolerance: 600,
  rules: { crossDay: true, pmSuccessOnly: true, filterCarryForward: true },
}, [], null);
assert.equal(result.matched, 2);
assert.equal(result.exceptions.length, 0);
const wrongIdentity = await Engine.reconcile([...deposit, ...withdraw], [
  { ...bo[0], memberCode: 'different-user' },
  { ...bo[1], ref: 'different-transaction' },
], { toleranceDeposit: 90, toleranceWithdraw: 180, exactUniqueTolerance: 600,
  rules: { crossDay: true, pmSuccessOnly: true, filterCarryForward: true } }, [], null);
assert.equal(wrongIdentity.matched, 0,
  'CELOX must not match on amount and time when BO user or transaction code conflicts');

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/audit-mail-ingest.json', import.meta.url), 'utf8'));
const classifier = workflow.nodes.find(node => node.id === 'classify').parameters.jsCode;
const classified = vm.runInNewContext(`(function(){${classifier}})()`, {
  $input: { all: () => [{ json: {
    file_name: '3X_PM_CELOX_D_2026-11-09.csv',
    subject: '[AUDIT] 3XB | 2026-11-09 | BO+PM', business_date: '2026-11-09',
    batch_id: 'test', attachment_index: 1,
  }, binary: { data: { fileSize: 100 } } }] },
});
assert.equal(classified[0].json.kind, 'pm_statement');
assert.equal(classified[0].json.company, '3XB');
console.log('3XB CELOX intake, parser, account scope and 1:1 matching passed.');
