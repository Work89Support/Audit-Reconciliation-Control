import assert from 'node:assert/strict';
import fs from 'node:fs';
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
