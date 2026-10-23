const assert=require('node:assert/strict'),fs=require('node:fs');
const dispatcher=JSON.parse(fs.readFileSync('n8n/audit-round-dispatcher.json','utf8'));
const builder=fs.readFileSync('scripts/build-n8n-rounds.mjs','utf8');
const trigger=dispatcher.nodes.find(node=>node.id==='round-clock');

assert.equal(trigger.name,'รอบตรวจ 08:00 · 11:00 · 19:00');
assert.deepEqual(trigger.parameters.rule.interval,[{field:'cronExpression',expression:'0 0 8,11,19 * * *'}]);
assert.ok(dispatcher.connections[trigger.name]);
assert.match(builder,/รอบตรวจ 08:00 · 11:00 · 19:00/);
assert.match(builder,/0 0 8,11,19 \* \* \*/);
assert.doesNotMatch(builder,/16:30|0 30 16/);
console.log('Round schedule: 08:00, 11:00 and 19:00 Asia/Bangkok only');
