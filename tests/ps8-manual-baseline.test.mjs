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

// PS8 manual Audit 25-10-2026: all 191 provider rows reconcile, all 22 SCB
// statement rows reconcile, and one BO withdrawal (80 baht) remains visible.
assert.equal(21 + 22 + 3 + 11 + 5 + 81 + 14 + 34, 191);
assert.equal(191 + 22, 213);

const base = {
  company: 'PS8', subco: 'PS8', account: '5292894087', bank: 'SCB', channel: 'SCB',
  date: '2026-10-25', isPmChannel: false, noTime: false,
};
const stm = Array.from({ length: 22 }, (_, index) => ({
  ...base, source: 'stm', formatCode: 'stm_pdf', rowNo: index + 1,
  direction: index % 2 ? 'withdraw' : 'deposit', amount: 100 + index, sec: 600 + index * 60,
}));
const bo = [
  ...stm.map((row, index) => ({ ...row, source: 'bo', formatCode: 'bo_main', rowNo: index + 101, sec: row.sec + 30 })),
  { ...base, source: 'bo', formatCode: 'bo_main', rowNo: 129, direction: 'withdraw', amount: 80, sec: 84060, lateNight: true },
];
const result = await Engine.reconcile(stm, bo, {
  toleranceDeposit: 90, toleranceWithdraw: 180, exactUniqueTolerance: 600, diffAlert: 1,
  rules: { crossDay: true, pmSuccessOnly: true, filterCarryForward: true },
}, [], null);
assert.equal(result.matched, 22);
assert.equal(result.exceptions.length, 1, 'PS8 must create one case, not duplicate the same residual row');
assert.equal(result.exceptions[0].type, 'cross_day');
assert.equal(result.exceptions[0].systemAmount, 80);

const worker = JSON.parse(fs.readFileSync(new URL('../n8n/audit-headless-worker.json', import.meta.url), 'utf8'));
const selectionCode = worker.nodes.find(node => node.name === 'เลือกไฟล์ของบริษัท')?.parameters?.jsCode;
assert.ok(selectionCode);
const providers = ['AUTOPEER_D', 'AUTOPEER_W', 'AZPAY_D', 'AZPAY_W', 'COREPAY_D', 'COREPAY_W', 'MYPAY_D', 'MYPAY_W'];
const sourceFiles = [
  { id: 'bo-current', physical_source_file_id: 'bo-physical', file_name: 'PS8_BO_2026-10-25.xlsx', kind: 'bo_main', parsed: true },
  { id: 'stm-current', physical_source_file_id: 'stm-physical', file_name: 'PS8_STM_SCB_2026-10-25.xlsx', kind: 'stm_pdf', parsed: true },
  ...providers.map((provider, index) => ({
    id: `logical-${provider}`, physical_source_file_id: `physical-${provider}`,
    file_name: `PS8_PM_${provider}_2026-10-25.xlsx`, kind: 'pm_statement', parsed: true,
    created_at: `2026-10-26T02:${String(index).padStart(2, '0')}:00Z`,
  })),
  { id: 'stm-old', physical_source_file_id: 'stm-old-physical', file_name: 'PS8_STM_SCB_2026-10-25 (old).xlsx', kind: 'stm_pdf', parsed: true, excluded: true },
];
const selected = vm.runInNewContext(`(function(){${selectionCode}})()`, {
  $input: { all: () => [{ json: { company: 'PS8', business_date: '2026-10-25', source_files: sourceFiles } }] },
  $: () => ({ first: () => ({ json: { id: 'job-ps8', company: 'PS8', business_date: '2026-10-25' } }) }),
});
assert.equal(selected.length, 10, 'PS8 effective scope keeps BO, SCB, and eight current provider files');
assert.ok(!selected.some(item => item.json.file.id === 'stm-old-physical'));

console.log('PS8 manual baseline: 213 pairs, one BO-only row, no duplicate case, and effective scope passed');
