import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=async name=>JSON.parse(await readFile(new URL('../n8n/'+name,import.meta.url),'utf8'));
const parent=await load('audit-round-dispatcher.json');
const child=await load('audit-round-worker.json');
for(const wf of [parent,child]){
 const names=new Set(wf.nodes.map(n=>n.name));
 assert.equal(names.size,wf.nodes.length);
 for(const [from,outputs] of Object.entries(wf.connections)){
  assert.ok(names.has(from));
  for(const lane of outputs.main) for(const e of lane) assert.ok(names.has(e.node));
 }
}
assert.equal(child.nodes.find(n=>n.id==='schedule').disabled,true);
assert.equal(child.nodes.find(n=>n.id==='claim').alwaysOutputData,true);
assert.equal(child.connections['รับงานจากรอบตรวจ'].main[0][0].node,'รวมเป็นหนึ่งรอบ','child must not requeue failed work every iteration');
assert.equal(parent.settings.timezone,'Asia/Bangkok');
assert.equal(parent.settings.executionTimeout,2400,'respect live Cloud maximum of 40 minutes');
assert.equal(parent.nodes.find(n=>n.id==='call-worker').parameters.options.waitForSubWorkflow,true);
assert.match(parent.nodes.find(n=>n.id==='peek-queue').parameters.url,/status=eq.queued.*is_archived=eq.false.*attempt_count=lt.3/);
assert.equal(parent.connections['มีงานจึงเรียก Worker'].main[1][0].node,'หยุดเมื่อคิวหมดหรือมี Worker อื่นทำอยู่');
assert.equal(parent.connections['ทำงานแล้วจึงดูคิวถัดไป'].main[1][0].node,'หยุดเมื่อคิวหมดหรือมี Worker อื่นทำอยู่');
const code=parent.nodes.find(n=>n.id==='queue-guard').parameters.jsCode;
const guard=new Function('$input','$runIndex',code);
assert.equal(guard({all:()=>[{json:{}}]},0)[0].json.has_work,false);
assert.equal(guard({all:()=>[{json:{id:'one'}}]},0)[0].json.has_work,true);
assert.throws(()=>guard({all:()=>[]},500),/500/);
const summary=new Function('$',child.nodes.find(n=>n.id==='summary').parameters.jsCode);
assert.equal(summary(()=>({first:()=>({json:{}})}))[0].json.worked,false);
assert.equal(summary(()=>({first:()=>({json:{id:'one'}})}))[0].json.job_id,'one');
// Simulate an initially populated queue, an empty queue and a busy worker.
for(const initial of [0,1,9,36]){
 let remaining=initial,calls=0;
 while(guard({all:()=>[{json:remaining?{id:'job'}:{}}]},calls)[0].json.has_work){remaining--;calls++;}
 assert.equal(calls,initial,'one useful child invocation per queued job; none when empty');
}
console.log('Round dispatcher: schedule, graph, queue drain, empty/busy stop and safety guards passed');
