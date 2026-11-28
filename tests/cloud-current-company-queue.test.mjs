import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const source = readFileSync(new URL('../supabase.js', import.meta.url), 'utf8');
const companies = ['3XB', 'AT4', 'FR8', 'MC8', 'MR9', 'PS8', 'SK8', 'UFABET7M', 'UR9'];
const rows = companies.map((company, i) => ({company, business_date:'2026-11-27', status:i === 7 ? 'needs_review' : 'completed', matched:100 + i, exception_count:i, file_count:12, is_archived:false}));
rows.push({company:'PS', status:'waiting_files', file_count:0, is_archived:false});
rows.push({company:'PS', status:'waiting_files', file_count:0, is_archived:true});
rows.push({company:'PS8', status:'completed', matched:999, is_archived:true});
rows.push({company:'XXX', status:'waiting_files', is_archived:false});
const before = JSON.stringify(rows);
const ctx = {cloudState:{operations:rows}};
vm.createContext(ctx);
vm.runInContext(app.slice(app.indexOf('const LIVE_COMPANY_CODES ='), app.indexOf('const actionableAuditRows =')), ctx);
const renderStart = app.indexOf('  const operations = (cloudState.operations');
assert.ok(renderStart > 0, 'Exercise the actual Cloud queue selection');
vm.runInContext(app.slice(renderStart, app.indexOf('\n', renderStart)) + '\nglobalThis.visible = operations;', ctx);
assert.deepEqual(Array.from(ctx.visible, r => r.company), companies);
assert.equal(ctx.visible.find(r => r.company === 'PS8').matched, 105);
assert.equal(ctx.visible.find(r => r.company === 'UFABET7M').status, 'needs_review', 'A real company needing review must remain visible');
assert.equal(JSON.stringify(rows), before, 'Rendering must preserve all source/result rows');

const requests = [];
const transport = {json:async path => {requests.push(path); return [];}};
vm.createContext(transport);
vm.runInContext(source.slice(source.indexOf('  function rangedView('), source.indexOf('  async function primaryOverlays(')) + '\nglobalThis.readView = rangedView;', transport);
for (const opts of [200, {from:'2026-11-27', to:'2026-11-27', company:'PS8', limit:200}]) {
  await transport.readView('v_recon_operations', 'business_date.desc,company.asc', opts, 100);
  const url = new URL(requests.at(-1), 'https://example.invalid');
  assert.equal(url.searchParams.get('is_archived'), 'eq.false', 'Exclude history before the queue limit');
  assert.equal(url.searchParams.get('limit'), '200');
  if (typeof opts === 'object') {
    assert.equal(url.searchParams.get('company'), 'eq.PS8');
    assert.deepEqual(url.searchParams.getAll('business_date'), ['gte.2026-11-27','lte.2026-11-27']);
  }
}
await transport.readView('v_recon_quality', 'business_date.desc', {}, 1000);
assert.equal(new URL(requests.at(-1), 'https://example.invalid').searchParams.has('is_archived'), false, 'Historical quality reads retain their existing contract');
console.log('PASS Cloud queue: nine real companies, archived/unknown rows excluded, PS8 and needs_review retained, bounded GET filters, unchanged results.');
