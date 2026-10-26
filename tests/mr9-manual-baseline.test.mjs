import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(new URL('../formats.js', import.meta.url), 'utf8') + '\n;globalThis.__Formats=Formats;',
  context,
);
const Formats = context.__Formats;

// MR9 manual audit 25-10-2026: MYPAY withdrawals must use the amount that was
// actually transferred. Requested amounts and partial balances are evidence,
// not the amount used for reconciliation.
const headers = [
  'id', 'amount', 'provider', 'status', 'requestTime', 'updateTime',
  'transferredAmount', '_id', 'customerId',
];
const rows = [
  ['p2p-partial-250', 300, 'mypays24', 'PARTIAL', '2026-10-25 23:20:05', '2026-10-26 00:21:04', 250, '6ade2c35b0eec4509255348e', '2467414'],
  // Same time and amount are two real source rows. Their immutable ids must
  // remain distinct; do not collapse them by amount/time.
  ['p2p-same-1', 50, 'mypays24', 'SUCCESSED', '2026-10-25 10:45:34', '2026-10-25 10:52:21', 50, '6add7b5eb0eec4509254bee1', '2466888'],
  ['p2p-same-2', 50, 'mypays24', 'SUCCESSED', '2026-10-25 10:45:34', '2026-10-25 10:52:21', 50, '6add7b5eb0eec4509254bee2', '2466889'],
];
const parsed = Formats.parse('MR9_PM_MYPAY_W_2026-10-25.xlsx', [headers, ...rows], '2026-10-25');
assert.equal(parsed.records.length, 3, 'all physical MR9 provider rows must remain present');
assert.equal(parsed.records[0].amount, 250, 'PARTIAL MYPAY uses transferredAmount, not requested amount');
assert.equal(parsed.records[0].requested, 300);
assert.equal(parsed.records[0].unpaidAmount, 50);
assert.equal(parsed.records[0].amountColumn, 'transferredAmount');
assert.equal(parsed.records[0].crossDay, true, 'late D request settled on D+1 stays in the D source scope');
assert.equal(parsed.records[0].requestDate, '2026-10-25');
assert.equal(parsed.records[0].settlementDate, '2026-10-26');
assert.deepEqual(
  Array.from(parsed.records.slice(1), row => row.sourceId),
  ['p2p-same-1', 'p2p-same-2'],
  'same-time/same-amount rows stay separate by source identity',
);

// The automatic worker must consume only the effective file revision. This is
// the production guard against an old MR9 attachment and its corrected upload
// entering the same run and inflating pairs/cases.
const worker = JSON.parse(fs.readFileSync(new URL('../n8n/audit-headless-worker.json', import.meta.url), 'utf8'));
const selectionCode = worker.nodes.find(node => node.name === 'เลือกไฟล์ของบริษัท')?.parameters?.jsCode;
assert.ok(selectionCode, 'worker effective-source selector exists');
const job = { id: 'job-mr9', company: 'MR9', business_date: '2026-10-25' };
const batch = {
  company: 'MR9',
  business_date: '2026-10-25',
  source_files: [
    { id: 'logical-current', physical_source_file_id: 'physical-current', file_name: 'MR9_PM_MYPAY_W_2026-10-25.xlsx', kind: 'pm_statement', parsed: true, created_at: '2026-10-26T02:00:00Z' },
    { id: 'logical-old', physical_source_file_id: 'physical-old', file_name: 'MR9_PM_MYPAY_W_2026-10-25 (old).xlsx', kind: 'pm_statement', parsed: true, excluded: true, created_at: '2026-10-26T01:00:00Z' },
    { id: 'bo-current', physical_source_file_id: 'bo-physical', file_name: 'MR9_BO_2026-10-25.xlsx', kind: 'bo_main', parsed: true, created_at: '2026-10-26T02:00:00Z' },
  ],
};
const selected = vm.runInNewContext(`(function(){${selectionCode}})()`, {
  $input: { all: () => [{ json: batch }] },
  $: () => ({ first: () => ({ json: job }) }),
});
assert.deepEqual(
  Array.from(selected, item => item.json.file.id).sort(),
  ['bo-physical', 'physical-current'],
  'excluded revision is absent and effective physical ids are used',
);

console.log('MR9 manual baseline: actual MYPAY payout, repeated source rows, and effective source revision passed');
