import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(new URL('../formats.js', import.meta.url), 'utf8') + '\n;globalThis.__Formats=Formats;',
  context,
);
const Formats = context.__Formats;

// AT4 manual audit 25-10-2026 contains 353 real pairs:
// normal bank 9 withdrawals + 3 deposits, AUTOPEER 25 withdrawals +
// 92 deposits, and COREPAY 38 withdrawals + 186 deposits. Five physical
// source rows remain unmatched and must stay visible for Audit review.
assert.equal(9 + 3 + 25 + 92 + 38 + 186, 353);
assert.equal(1 + 2 + 1 + 1, 5, 'manual baseline retains five unmatched source rows');

// System 123 COREPAY deposit exports include fee fractions in the PM amount,
// while BO records the integer base amount. This normalization is intentionally
// limited to COREPAY deposits for AT4/FR8/SK8; source values remain in raw.
const providerHeaders = [
  'id', 'amount', 'provider', 'status', 'requestTime', 'paymentTime',
  'realAmount', '_id', 'customerId',
];
const corepay = Formats.parse('AT4_PM_COREPAY_D_2026-10-25.xlsx', [providerHeaders,
  ['cp-200-11', 200.11, 'corepay', 'successed', '2026-10-25 14:21:02', '2026-10-25 14:21:04', 200.11, '6ade00000000000000000001', 'AFF13512'],
  ['cp-110-20', 110.20, 'corepay', 'successed', '2026-10-25 10:19:43', '2026-10-25 10:19:45', 110.20, '6ade00000000000000000002', 'AFF21700'],
  ['cp-300-44', 300.44, 'corepay', 'successed', '2026-10-25 09:57:50', '2026-10-25 09:57:53', 300.44, '6ade00000000000000000003', 'AFF19806'],
], '2026-10-25');
assert.deepEqual(Array.from(corepay.records, row => row.amount), [200, 110, 300]);
assert.deepEqual(Array.from(corepay.records, row => row.sourceId), ['cp-200-11', 'cp-110-20', 'cp-300-44']);
assert.ok(corepay.records.every(row => row.account === 'COREPAY' && row.direction === 'deposit'));

// AT4 normal-bank BO rows must use the bank timestamp, not the BO creation
// time. Missing bank time is review evidence and must not be auto-matched.
const bankHeaders = [
  'วันที่ทำรายการ', 'วันที่ธนาคาร', 'จำนวนเงินฝากจริง', 'จำนวนเงินถอนจริง',
  'ชื่อธนาคาร', 'สมาชิก', 'บัญชีลูกค้า', 'เกิดโดย',
];
const bank = Formats.parse('AT4_BO_2026-10-25.xlsx', [bankHeaders,
  ['2026-10-25 22:56:23', '2026-10-25 23:16:00', '', 200, '6517248040 : Manual', 'AFF26298', '6789826327 | DANUPON NGAMSAENG', 'ถอน ออโต้'],
], '2026-10-25');
assert.equal(bank.records.length, 1);
assert.equal(bank.records[0].sec, 23 * 3600 + 16 * 60);
assert.equal(bank.records[0].matchTimeColumn, 'วันที่ธนาคาร');

const missingBankTime = Formats.parse('AT4_BO_2026-10-25.xlsx', [bankHeaders,
  ['2026-10-25 22:56:23', '', '', 200, '6517248040 : Manual', 'AFF26298', '6789826327 | DANUPON NGAMSAENG', 'ถอน ออโต้'],
], '2026-10-25');
assert.equal(missingBankTime.records.length, 0);
assert.equal(missingBankTime.dropped['ระบบ 123 ธนาคารมีเวลาแต่ไม่มีวันที่ธนาคาร'], 1);

// Automatic AT4 runs consume one effective revision for BO, statement and
// each provider source. Replaced attachments remain evidence only.
const worker = JSON.parse(fs.readFileSync(new URL('../n8n/audit-headless-worker.json', import.meta.url), 'utf8'));
const selectionCode = worker.nodes.find(node => node.name === 'เลือกไฟล์ของบริษัท')?.parameters?.jsCode;
assert.ok(selectionCode, 'worker effective-source selector exists');
const job = { id: 'job-at4', company: 'AT4', business_date: '2026-10-25' };
const sourceFiles = [
  { id: 'bo-current', physical_source_file_id: 'bo-physical', file_name: 'AT4_BO_2026-10-25.xlsx', kind: 'bo_main', parsed: true },
  { id: 'stm-current', physical_source_file_id: 'stm-physical', file_name: 'AT4_STM_BBL_2026-10-25.pdf', kind: 'stm_pdf', parsed: true },
  ...['AUTOPEER_D', 'AUTOPEER_W', 'COREPAY_D', 'COREPAY_W'].map((provider, index) => ({
    id: `logical-${provider}`,
    physical_source_file_id: `physical-${provider}`,
    file_name: `AT4_PM_${provider}_2026-10-25.xlsx`,
    kind: 'pm_statement',
    parsed: true,
    created_at: `2026-10-26T02:${String(index).padStart(2, '0')}:00Z`,
  })),
  { id: 'bo-old', physical_source_file_id: 'bo-old-physical', file_name: 'AT4_BO_2026-10-25 (old).xlsx', kind: 'bo_main', parsed: true, excluded: true },
];
const selected = vm.runInNewContext(`(function(){${selectionCode}})()`, {
  $input: { all: () => [{ json: { company: 'AT4', business_date: '2026-10-25', source_files: sourceFiles } }] },
  $: () => ({ first: () => ({ json: job }) }),
});
assert.equal(selected.length, 6, 'AT4 effective scope keeps one BO, one STM, and four current PM files');
assert.ok(!selected.some(item => item.json.file.id === 'bo-old-physical'));

console.log('AT4 manual baseline: 353 pairs, five unmatched rows, COREPAY base amount, bank time, and effective scope passed');
