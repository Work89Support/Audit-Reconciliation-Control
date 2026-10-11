import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
for (const id of ['exSearch', 'exStatus', 'exType', 'exSeverity']) {
  assert.ok(app.includes(`for="${id}"`), `${id} has a visible accessible label`);
  assert.equal((app.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1);
}
assert.ok(app.includes('x.status === "ALL" ? "selected"'));
assert.ok(app.includes('case-filter-current'));
assert.ok(app.includes('ค้นหา: ${h(query)}'));
const reset = app.slice(app.indexOf('$("#exReset").addEventListener'), app.indexOf('$("#pgPrev").addEventListener'));
assert.ok(reset.includes('status: "ACTION"'));
assert.ok(!reset.includes('state.filters ='), 'case reset preserves date/company scope');
console.log('Filter labels, selected status, escaped summary, and scoped reset passed');
assert.ok(app.includes('aria-label="แยกตรวจฝากและถอน"'));
assert.ok(app.includes('data-review-direction="${value}"'));
const directionHandler = app.slice(app.indexOf("root.querySelectorAll('[data-review-direction]')"), app.indexOf("root.querySelectorAll('[data-review-status]')"));
assert.ok(directionHandler.includes('state.filters.direction = button.dataset.reviewDirection'));
assert.ok(directionHandler.includes('reviewQueueIds = []'));
assert.ok(directionHandler.includes('rerender()'));
assert.ok(!directionHandler.includes('state.filters ='), 'direction switch preserves date/company');
const missingGroupCode = app.slice(app.indexOf('function cloudMissingGroupsText('), app.indexOf('async function cloudLoad('));
const context = vm.createContext({});
vm.runInContext(missingGroupCode, context);
const showMissing = context.cloudMissingGroupsText;
assert.equal(showMissing([]), 'ครบ');
assert.equal(showMissing([['STM', 'SCB'], ['BO']]), 'STM / SCB, BO');
assert.equal(showMissing(['STM', 'BO']), 'STM, BO');
const structured = [{kind:'STM',label:'••1111',source_labels:['บัญชีPM บ้านอื่น 111144411111'],direction:'deposit'},
  {kind:'STM',label:'••1111',direction:'withdraw'}];
const untouched = JSON.stringify(structured);
assert.equal(showMissing(structured), 'STM · บัญชีPM บ้านอื่น 111144411111 · ฝาก, STM · ••1111 · ถอน');
assert.equal(JSON.stringify(structured), untouched, 'presentation does not alter missing coverage or jobs');
for (const value of [null,undefined,{},'STM']) assert.equal(showMissing(value), 'ยังไม่มีข้อมูลไฟล์ที่ขาด');
assert.doesNotThrow(() => showMissing([null, 1, {}, ['STM', null]]));
assert.ok(app.includes('h(cloudMissingGroupsText(j.missing_groups))'), 'escape structured file labels in HTML');
assert.equal(showMissing([{kind:'STM',label:'<img onerror=alert(1)>',direction:'deposit'}]), 'STM · <img onerror=alert(1)> · ฝาก');
console.log('Cloud missing groups: legacy arrays, structured coverage objects, malformed data and unchanged source passed');
