import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
import sheets from '../mc8-live-sheets.js';
const ctx={performance,console,setTimeout};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('formats.js','utf8')+'\n'+fs.readFileSync('engine.js','utf8')+'\nthis.engine=Engine;',ctx);
const bo=[{company:'UFABET7M',subco:'UFABET7M',date:'2026-10-09',sec:14*3600+12*60,
  account:'COREPAY',direction:'withdraw',amount:5,rowNo:1,source_file_id:'synthetic-bo',
  memberCode:'test-member',performedBy:'test-operator',raw:'test BO withdrawal'}];
const result=await ctx.engine.reconcile([],bo,{toleranceDeposit:90,toleranceWithdraw:180},[],null);
assert.equal(result.waitingBo.length,1);
assert.equal(result.matched,0);
assert.equal(result.exceptions.length,0);
const rows=sheets.rowsOf({run:{summary:{waiting_bo:result.waitingBo}},cases:[]},'UFABET7M');
assert.equal(rows.length,1);
assert.equal(sheets.sheetOf(rows[0]),'CP ถ');
assert.equal(rows[0].boAmount,5);
assert.equal(rows[0].pmAmount,null);
assert.equal(rows[0].boTime,'2026-10-09 14:12:00');
assert.equal(rows[0].bo.performedBy,'test-operator');
// Verify the generated deployable worker, not just a source-code regex.
const worker=JSON.parse(fs.readFileSync('n8n/audit-headless-worker.json','utf8'));
assert.ok(worker.nodes.some(n=>n.parameters?.jsCode?.includes('summary:{waiting_bo:result.waitingBo||[],waiting_bo_version:1')));
console.log('Engine → saved waiting BO → CP withdrawal sheet: no STM, no fabricated match or loss passed');
