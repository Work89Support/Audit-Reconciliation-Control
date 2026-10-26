import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(new URL('../formats.js', import.meta.url), 'utf8') + '\n;globalThis.__Formats=Formats;',
  context,
);
const Formats = context.__Formats;

// MC8 manual audit 25-10-2026 contains 17 real AZPAY withdrawals. The row
// provider is authoritative even when a copied attachment name still says
// MYPAY. Dropping this file explains the old 758 result versus 775 manual
// pairs, so lock every physical source row into the parser result.
const azHeaders = [
  'id', 'amount', 'provider', 'status', 'requestTime', 'updateTime',
  'transferredAmount', '_id', 'customerId',
];
const azRows = Array.from({ length: 17 }, (_, index) => [
  `az-${index + 1}`,
  100 + index,
  'azpay',
  'SUCCESSED',
  `2026-10-25 10:${String(index).padStart(2, '0')}:00`,
  `2026-10-25 10:${String(index).padStart(2, '0')}:30`,
  '',
  `6ade0000000000000000${String(index).padStart(4, '0')}`,
  `3win${String(index).padStart(5, '0')}`,
]);
const azParsed = Formats.parse(
  'MC8_PM_MYPAY_W_2026-10-25.xlsx',
  [azHeaders, ...azRows],
  '2026-10-25',
);
assert.equal(azParsed.records.length, 17, 'all 17 physical MC8 AZPAY withdrawal rows stay eligible');
assert.ok(azParsed.records.every(row => row.account === 'AZPAY'));
assert.ok(azParsed.records.every(row => row.amountColumn === 'amount'));
assert.deepEqual(
  Array.from(azParsed.records, row => row.sourceId),
  azRows.map(row => row[0]),
  'MC8 AZPAY rows remain distinct by immutable source identity',
);

// A provider deposit requested late on D and settled on D+1 is part of the D
// source file. It must survive the business-date filter with both timestamps
// retained for audit, instead of being silently lost.
const depositHeaders = [
  'id', 'amount', 'provider', 'status', 'requestTime', 'paymentTime',
  'realAmount', '_id', 'customerId',
];
const deposit = Formats.parse('MC8_PM_COREPAY_D_2026-10-25.xlsx', [depositHeaders, [
  'cp-deposit-cross-day', 200, 'corepay', 'successed',
  '2026-10-25 23:55:45', '2026-10-26 00:02:46', 200,
  '6ade3491583e52ba74319480', '3win10878',
]], '2026-10-25');
assert.equal(deposit.records.length, 1, 'MC8 next-day provider settlement stays in the request-day source scope');
assert.equal(deposit.records[0].crossDay, true);
assert.equal(deposit.records[0].requestDate, '2026-10-25');
assert.equal(deposit.records[0].settlementDate, '2026-10-26');
assert.equal(deposit.records[0].amount, 200);

// The automatic worker must select only the effective MC8 file revision while
// retaining every active provider file. Old or replaced files cannot be mixed
// into the 775-pair manual baseline.
const worker = JSON.parse(fs.readFileSync(new URL('../n8n/audit-headless-worker.json', import.meta.url), 'utf8'));
const selectionCode = worker.nodes.find(node => node.name === 'เลือกไฟล์ของบริษัท')?.parameters?.jsCode;
assert.ok(selectionCode, 'worker effective-source selector exists');
const job = { id: 'job-mc8', company: 'MC8', business_date: '2026-10-25' };
const providers = ['AUTOPEER_D', 'AUTOPEER_W', 'COREPAY_D', 'COREPAY_W', 'MYPAY_D', 'MYPAY_W', 'AZPAY_D', 'AZPAY_W'];
const sourceFiles = [
  { id: 'bo-current', physical_source_file_id: 'bo-physical', file_name: 'MC8_BO_2026-10-25.xlsx', kind: 'bo_main', parsed: true },
  { id: 'stm-current', physical_source_file_id: 'stm-physical', file_name: 'MC8_STM_KB_2026-10-25.xlsx', kind: 'stm_pdf', parsed: true },
  ...providers.map((provider, index) => ({
    id: `logical-${provider}`,
    physical_source_file_id: `physical-${provider}`,
    file_name: `MC8_PM_${provider}_2026-10-25.xlsx`,
    kind: 'pm_statement',
    parsed: true,
    created_at: `2026-10-26T02:${String(index).padStart(2, '0')}:00Z`,
  })),
  { id: 'old-azpay', physical_source_file_id: 'old-azpay-physical', file_name: 'MC8_PM_AZPAY_W_2026-10-25 (old).xlsx', kind: 'pm_statement', parsed: true, excluded: true },
];
const selected = vm.runInNewContext(`(function(){${selectionCode}})()`, {
  $input: { all: () => [{ json: { company: 'MC8', business_date: '2026-10-25', source_files: sourceFiles } }] },
  $: () => ({ first: () => ({ json: job }) }),
});
assert.equal(selected.length, 10, 'MC8 effective scope keeps BO, STM, and all eight current PM files');
assert.ok(!selected.some(item => item.json.file.id === 'old-azpay-physical'));

console.log('MC8 manual baseline: 17 AZPAY withdrawals, next-day provider settlement, and effective source scope passed');
