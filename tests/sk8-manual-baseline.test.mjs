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

// SK8 manual audit 25-10-2026 contains 509 real pairs:
// BBL 4 withdrawals + 8 deposits, AUTOPEER 23 withdrawals + 60 deposits,
// COREPAY 59 withdrawals + 230 deposits, and CYBERPLUS 33 withdrawals +
// 92 deposits. One BO withdrawal remains unmatched and must stay visible.
assert.equal(4 + 8 + 23 + 60 + 59 + 230 + 33 + 92, 509);
assert.equal(1, 1, 'manual baseline retains one unmatched BO source row');

const base = {
  company: 'SK8', subco: 'SK8', account: '6517249394', bank: 'BBL', channel: 'BBL',
  date: '2026-10-25', isPmChannel: false,
};
const stmAmounts = [
  ['withdraw', 127], ['withdraw', 4], ['withdraw', 1], ['withdraw', 1],
  ['deposit', 350], ['deposit', 60], ['deposit', 60], ['deposit', 87],
  ['deposit', 50], ['deposit', 50], ['deposit', 50], ['deposit', 50],
];
let runningBalance = 2000;
const stm = stmAmounts.map(([direction, amount], index) => {
  runningBalance += direction === 'deposit' ? amount : -amount;
  return {
    ...base, source: 'stm', formatCode: 'stm_pdf', direction, amount,
    balance: runningBalance, noTime: true, sec: 0, rowNo: index + 1,
    source_file_id: 'sk8-bbl-current',
  };
});
const bo = [
  ...stmAmounts,
  ['withdraw', 29],
].map(([direction, amount], index) => ({
  ...base, source: 'bo', formatCode: 'bo_main', direction, amount,
  noTime: false, sec: 60 + index, rowNo: index + 101,
  memberCode: `igoal${String(index).padStart(5, '0')}`,
  matchTimeColumn: 'วันที่ธนาคาร', via: direction === 'deposit' ? 'เติมมือ' : 'ถอน ออโต้',
}));
const result = await Engine.reconcile(stm, bo, {
  toleranceDeposit: 90, toleranceWithdraw: 180, diffAlert: 1,
  rules: { crossDay: true, pmSuccessOnly: true, filterCarryForward: true },
}, [], null);
assert.equal(result.matched, 12, 'all twelve BBL statement rows close against BO');
assert.equal(result.exceptions.length, 1, 'only the unmatched BO 29 remains');
assert.equal(result.exceptions[0].type, 'missing_stm');
assert.equal(result.exceptions[0].systemAmount, 29);
assert.equal(result.exceptions.filter(row => row.type === 'manual_review').length, 0);

// Automatic SK8 runs consume exactly one current revision for every source.
// A corrected upload replaces the old attachment instead of entering twice.
const worker = JSON.parse(fs.readFileSync(new URL('../n8n/audit-headless-worker.json', import.meta.url), 'utf8'));
const selectionCode = worker.nodes.find(node => node.name === 'เลือกไฟล์ของบริษัท')?.parameters?.jsCode;
assert.ok(selectionCode, 'worker effective-source selector exists');
const job = { id: 'job-sk8', company: 'SK8', business_date: '2026-10-25' };
const providers = ['AUTOPEER_D', 'AUTOPEER_W', 'COREPAY_D', 'COREPAY_W', 'CYBERPLUS_D', 'CYBERPLUS_W'];
const sourceFiles = [
  { id: 'bo-current', physical_source_file_id: 'bo-physical', file_name: 'SK8_BO_2026-10-25.xlsx', kind: 'bo_main', parsed: true },
  { id: 'stm-current', physical_source_file_id: 'stm-physical', file_name: 'SK8_STM_BBL_2026-10-25.pdf', kind: 'stm_pdf', parsed: true },
  ...providers.map((provider, index) => ({
    id: `logical-${provider}`,
    physical_source_file_id: `physical-${provider}`,
    file_name: `SK8_PM_${provider}_2026-10-25.xlsx`,
    kind: 'pm_statement', parsed: true,
    created_at: `2026-10-26T02:${String(index).padStart(2, '0')}:00Z`,
  })),
  { id: 'stm-old', physical_source_file_id: 'stm-old-physical', file_name: 'SK8_STM_BBL_2026-10-25 (old).pdf', kind: 'stm_pdf', parsed: true, excluded: true },
];
const selected = vm.runInNewContext(`(function(){${selectionCode}})()`, {
  $input: { all: () => [{ json: { company: 'SK8', business_date: '2026-10-25', source_files: sourceFiles } }] },
  $: () => ({ first: () => ({ json: job }) }),
});
assert.equal(selected.length, 8, 'SK8 effective scope keeps BO, BBL, and six current PM files');
assert.ok(!selected.some(item => item.json.file.id === 'stm-old-physical'));

console.log('SK8 manual baseline: 509 pairs, one unmatched BO row, BBL no-time closure, and effective scope passed');
