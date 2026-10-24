const assert=require('node:assert/strict');
const fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8');
const data=fs.readFileSync('data.js','utf8');
const store=fs.readFileSync('store.js','utf8');

const track=app.slice(app.indexOf('function trackOfException'),app.indexOf('function retagTracks'));
const due=app.slice(app.indexOf('function dueOf'),app.indexOf('function docNo'));

assert.match(track,/track: "daily"/);
assert.doesNotMatch(track,/track: "cycle"/);
assert.match(due,/ติดตามแบบเรียลไทม์/);
assert.doesNotMatch(due,/cycleOf|cycleRespondDays/);
assert.match(data,/code: "SYS123"[\s\S]+track: "daily"/);
assert.doesNotMatch(app,/\["cycleDue", "แจ้งเมื่อใกล้ครบรอบชี้แจง"\]/);
assert.doesNotMatch(store,/cycleDue:/);
console.log('Realtime clarification policy: every company follows per-case deadlines without monthly cycles');
