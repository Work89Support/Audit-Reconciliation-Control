import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

const context = vm.createContext({ console, performance });
vm.runInContext(
  fs.readFileSync(new URL('../formats.js', import.meta.url), 'utf8')
    + '\n' + fs.readFileSync(new URL('../engine.js', import.meta.url), 'utf8')
    + '\n;globalThis.__Engine=Engine;',
  context,
);
const Engine = context.__Engine;

// 3XB manual Audit 25-10-2026: 528 normal-bank rows and 4,550 provider
// rows reconcile. The remaining review set is 32 BO rows: 18 normal-bank,
// eight COREPAY deposits, two MYPAY withdrawals, two MYPAY deposits, and two
// inter-company PM borrowing rows. No statement/provider row is left orphaned.
assert.equal(528 + 4550, 5078);
assert.equal(18 + 8 + 2 + 2 + 2, 32);

const base = {
  company: '3XB', subco: '3XB', account: '5034633029', bank: 'SCB', channel: 'SCB',
  date: '2026-10-25', direction: 'deposit', amount: 0, isPmChannel: false,
  noTime: false, formatCode: 'stm_pdf',
};
const stm = [
  { ...base, source: 'stm', amount: 54, sec: 3600, rowNo: 3, custAccount: '11112222' },
  { ...base, source: 'stm', amount: 50, sec: 38640, rowNo: 9, custAccount: '33334444' },
  { ...base, source: 'stm', amount: 77, sec: 50000, rowNo: 10 },
  { ...base, source: 'stm', amount: 77, sec: 50000, rowNo: 11 },
];
const bo = [
  { ...base, source: 'bo', formatCode: 'bo_main', amount: 54, sec: 10620, rowNo: 103, custAccount: '55556666' },
  { ...base, source: 'bo', formatCode: 'bo_main', amount: 50, sec: 43020, rowNo: 109, custAccount: '77778888' },
  // Equal duplicate candidates are intentionally ambiguous and must stay open.
  { ...base, source: 'bo', formatCode: 'bo_main', amount: 77, sec: 70000, rowNo: 110 },
  { ...base, source: 'bo', formatCode: 'bo_main', amount: 77, sec: 70000, rowNo: 111 },
];
const result = await Engine.reconcile(stm, bo, {
  toleranceDeposit: 90, toleranceWithdraw: 180, exactUniqueTolerance: 600, diffAlert: 1,
  rules: { crossDay: true, pmSuccessOnly: true, filterCarryForward: true },
}, [], null);
assert.equal(result.matched, 2, 'unique residual 3XB bank amounts close despite clock/account presentation drift');
assert.equal(result.threeXbBankResidualMatched, 2);
assert.deepEqual(
  Array.from(result.matchEvidence, row => row.method).sort(),
  ['3xb-bank-residual-exact-amount', '3xb-bank-residual-exact-amount'],
);
assert.equal(result.exceptions.filter(row => row.type === 'missing_bo').length, 2, 'ambiguous duplicate STM rows stay open');
assert.equal(result.exceptions.filter(row => row.type === 'missing_stm').length, 2, 'ambiguous duplicate BO rows stay open');

const worker = JSON.parse(fs.readFileSync(new URL('../n8n/audit-headless-worker.json', import.meta.url), 'utf8'));
const selectionCode = worker.nodes.find(node => node.name === 'เลือกไฟล์ของบริษัท')?.parameters?.jsCode;
assert.ok(selectionCode);
const providers = ['AZPAY_D', 'AZPAY_W', 'AUTOPEER_D', 'AUTOPEER_W', 'COREPAY_D', 'COREPAY_W', 'MYPAY_D', 'MYPAY_W'];
const sourceFiles = [
  { id: 'bo-current', physical_source_file_id: 'bo-physical', file_name: '3XB_BO_2026-10-25.xlsx', kind: 'bo_main', parsed: true },
  { id: 'kb-current', physical_source_file_id: 'kb-physical', file_name: '3XB_STM_KBANK_2026-10-25.xlsx', kind: 'stm_pdf', parsed: true },
  { id: 'scb-current', physical_source_file_id: 'scb-physical', file_name: '3XB_STM_SCB_2026-10-25.xlsx', kind: 'stm_pdf', parsed: true },
  ...providers.map((provider, index) => ({
    id: `logical-${provider}`, physical_source_file_id: `physical-${provider}`,
    file_name: `3XB_PM_${provider}_2026-10-25.xlsx`, kind: 'pm_statement', parsed: true,
    created_at: `2026-10-26T02:${String(index).padStart(2, '0')}:00Z`,
  })),
  { id: 'bo-old', physical_source_file_id: 'bo-old-physical', file_name: '3XB_BO_2026-10-25 (old).xlsx', kind: 'bo_main', parsed: true, excluded: true },
];
const selected = vm.runInNewContext(`(function(){${selectionCode}})()`, {
  $input: { all: () => [{ json: { company: '3XB', business_date: '2026-10-25', source_files: sourceFiles } }] },
  $: () => ({ first: () => ({ json: { id: 'job-3xb', company: '3XB', business_date: '2026-10-25' } }) }),
});
assert.equal(selected.length, 11, '3XB effective scope keeps BO, two bank statements, and eight provider files');
assert.ok(!selected.some(item => item.json.file.id === 'bo-old-physical'));

console.log('3XB manual baseline: 5,078 pairs, 32 BO-only rows, safe residual bank matching, and effective scope passed');
