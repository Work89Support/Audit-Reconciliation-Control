import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../supabase.js', import.meta.url), 'utf8');
const fn = source.slice(source.indexOf('  async function dailyChecklist('), source.indexOf('  async function boFirstCoverage('));
let calls = [], fail = false;
const load = vm.runInNewContext(`(${fn.trim()})`, {
  rpc: async (name, args) => {
    calls.push(args);
    if (fail && calls.length === 2) throw new Error('statement timeout');
    return [{business_date: args.p_to}];
  },
});
const rows = await load({from:'2026-09-01',to:'2026-09-09',company:'ALL'});
assert.equal(rows.length,3);
assert.deepEqual(calls.map(x=>[x.p_from,x.p_to]),[
  ['2026-09-07','2026-09-09'],['2026-09-04','2026-09-06'],['2026-09-01','2026-09-03'],
]);
assert.ok(calls.every(x=>x.p_company===null));
calls=[];
await load({from:'2026-08-31',to:'2026-09-02',company:'PS8',limit:1});
assert.equal(calls.length,1);
assert.equal(calls[0].p_from,'2026-08-31');
assert.equal(calls[0].p_company,'PS8');
assert.equal(calls[0].p_limit,1);
calls=[]; fail=true;
await assert.rejects(load({from:'2026-09-01',to:'2026-09-09'}),/statement timeout/);
await assert.rejects(load({from:'2026-09-09',to:'2026-09-01'}),/ช่วงวันที่/);
console.log('Checklist: bounded slices, date boundaries, global limit and fail-closed loading passed');
