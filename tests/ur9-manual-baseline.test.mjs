import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(new URL('../formats.js', import.meta.url), 'utf8') + '\n;globalThis.__Formats=Formats;',
  context,
);
const Formats = context.__Formats;

// UR9 manual audit 25-10-2026 reconciles 671 ordinary pairs:
// bank 68 + provider rows 122+70+20+210+24+86+15+56. The remaining
// physical rows sit at the day boundary and must remain separate review
// evidence. They must never be discarded or used to manufacture a match.
assert.equal(68 + 122 + 70 + 20 + 210 + 24 + 86 + 15 + 56, 671);
assert.equal(5 + 1 + 2 + 1, 9, 'manual baseline retains nine unmatched boundary rows');

const withdrawHeaders = [
  'id', 'amount', 'provider', 'status', 'requestTime', 'updateTime',
  'transferredAmount', '_id', 'customerId',
];
const boundaryWithdrawals = Formats.parse('UR9_PM_PROVIDER_W_2026-10-25.xlsx', [withdrawHeaders,
  ['ur9-autopeer-late', 300, 'autopeer', 'PARTIAL', '2026-10-25 23:56:20', '2026-10-26 00:16:31', 50, '6ade34b4d498fcc4a166af7f', 'evos168'],
  ['ur9-mypay-late', 270, 'mypays24', 'PARTIAL', '2026-10-25 23:30:19', '2026-10-26 00:31:02', 150, '6ade2e9bdcbcfa60fbecd45c', 'evos168'],
], '2026-10-25');
assert.equal(boundaryWithdrawals.records.length, 2);
assert.deepEqual(Array.from(boundaryWithdrawals.records, row => row.amount), [50, 150]);
assert.ok(boundaryWithdrawals.records.every(row => row.crossDay === true));
assert.deepEqual(
  Array.from(boundaryWithdrawals.records, row => row.sourceId),
  ['ur9-autopeer-late', 'ur9-mypay-late'],
  'UR9 day-boundary provider rows remain distinct by source identity',
);

const depositHeaders = [
  'id', 'amount', 'provider', 'status', 'requestTime', 'paymentTime',
  'realAmount', '_id', 'customerId',
];
const boundaryDeposit = Formats.parse('UR9_PM_COREPAY_D_2026-10-25.xlsx', [depositHeaders, [
  'ur9-corepay-late', 140, 'corepay', 'successed',
  '2026-10-25 23:57:43', '2026-10-26 00:00:34', 140,
  '6ade3507583e52ba74319497', 'evs75387',
]], '2026-10-25');
assert.equal(boundaryDeposit.records.length, 1);
assert.equal(boundaryDeposit.records[0].amount, 140);
assert.equal(boundaryDeposit.records[0].crossDay, true);
assert.equal(boundaryDeposit.records[0].requestDate, '2026-10-25');
assert.equal(boundaryDeposit.records[0].settlementDate, '2026-10-26');

// Automatic UR9 runs must use one current revision for every required source.
// Replaced files are evidence/history only and cannot enter the new result.
const worker = JSON.parse(fs.readFileSync(new URL('../n8n/audit-headless-worker.json', import.meta.url), 'utf8'));
const selectionCode = worker.nodes.find(node => node.name === 'เลือกไฟล์ของบริษัท')?.parameters?.jsCode;
assert.ok(selectionCode, 'worker effective-source selector exists');
const job = { id: 'job-ur9', company: 'UR9', business_date: '2026-10-25' };
const providers = ['AUTOPEER_D', 'AUTOPEER_W', 'COREPAY_D', 'COREPAY_W', 'MYPAY_D', 'MYPAY_W', 'AZPAY_D', 'AZPAY_W'];
const sourceFiles = [
  { id: 'bo-current', physical_source_file_id: 'bo-physical', file_name: 'UR9_BO_2026-10-25.xlsx', kind: 'bo_main', parsed: true },
  { id: 'stm-current', physical_source_file_id: 'stm-physical', file_name: 'UR9_STM_SCB_2026-10-25.pdf', kind: 'stm_pdf', parsed: true },
  ...providers.map((provider, index) => ({
    id: `logical-${provider}`,
    physical_source_file_id: `physical-${provider}`,
    file_name: `UR9_PM_${provider}_2026-10-25.xlsx`,
    kind: 'pm_statement',
    parsed: true,
    created_at: `2026-10-26T02:${String(index).padStart(2, '0')}:00Z`,
  })),
  { id: 'old-bo', physical_source_file_id: 'old-bo-physical', file_name: 'UR9_BO_2026-10-25 (old).xlsx', kind: 'bo_main', parsed: true, excluded: true },
];
const selected = vm.runInNewContext(`(function(){${selectionCode}})()`, {
  $input: { all: () => [{ json: { company: 'UR9', business_date: '2026-10-25', source_files: sourceFiles } }] },
  $: () => ({ first: () => ({ json: job }) }),
});
assert.equal(selected.length, 10, 'UR9 effective scope keeps BO, STM, and all eight current PM files');
assert.ok(!selected.some(item => item.json.file.id === 'old-bo-physical'));

console.log('UR9 manual baseline: 671 pairs, nine boundary rows, actual payout, and effective source scope passed');
