const assert=require('node:assert/strict');
const fs=require('node:fs');

const schema=fs.readFileSync('supabase/schema.sql','utf8');
const queue=fs.readFileSync('supabase/20260830_parse_files_before_reconciliation.sql','utf8');
const worker=JSON.parse(fs.readFileSync('n8n/audit-headless-worker.json','utf8'));
const dispatcher=JSON.parse(fs.readFileSync('n8n/audit-round-dispatcher.json','utf8'));

assert.match(schema,/v_late,case when v_late then now\(\) else null end/);
assert.match(schema,/attempt_count=case when excluded\.file_count<>daily_recon_jobs\.file_count then 0/);
assert.match(schema,/last_error=case when excluded\.file_count<>daily_recon_jobs\.file_count then null/);
assert.match(queue,/j\.status in \('waiting_files','needs_review','completed','queued','error'\)/);
assert.match(queue,/not coalesce\(f\.parsed,false\)/);
assert.match(queue,/f\.kind=any\(array\[/);
assert.equal(worker.nodes.some(node=>node.type==='n8n-nodes-base.scheduleTrigger'),false,'worker must have no competing schedule');
const schedule=dispatcher.nodes.find(node=>node.type==='n8n-nodes-base.scheduleTrigger');
assert.ok(schedule,'automatic dispatcher schedule is required');
assert.notEqual(schedule.disabled,true,'automatic dispatcher schedule must not be disabled');
assert.equal(schedule.parameters.rule.interval[0].expression,'0 0 8,19 * * *');
assert.ok(dispatcher.nodes.some(node=>node.id==='queue'),'dispatcher must refresh due and late-source jobs before draining the queue');
console.log('PASS late source auto queue: new unread files reset retries and the single 08:00/19:00 Dispatcher refreshes and drains the queue without a competing Worker timer');
