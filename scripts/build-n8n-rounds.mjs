import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = JSON.parse(await readFile(path.join(root, 'n8n/audit-headless-worker.json'), 'utf8'));
// Separate staged artifact: do not disable the production timer until the parent is tested.
worker.nodes.find(n => n.id === 'schedule').disabled = true;
worker.nodes.push({id:'round-subworkflow',name:'รับงานจากรอบตรวจ',type:'n8n-nodes-base.executeWorkflowTrigger',typeVersion:1.1,position:[-1040,400],parameters:{inputSource:'passthrough'}});
worker.connections['รับงานจากรอบตรวจ']={main:[[{node:'รวมเป็นหนึ่งรอบ',type:'main',index:0}]]};
worker.nodes.find(n => n.id === 'claim').alwaysOutputData = true;
worker.nodes.find(n => n.id === 'summary').parameters.jsCode = "const job=$('Supabase: จองหนึ่งงาน').first().json; return [{json:{worked:!!job.id,job_id:job.id||null,finished_at:new Date().toISOString()}}];";
worker.settings.timezone='Asia/Bangkok';

const edge = node => ({node,type:'main',index:0});
const queue=structuredClone(worker.nodes.find(n=>n.id==='queue'));
queue.position=[-640,0]; queue.alwaysOutputData=true;
const credentials=structuredClone(queue.credentials);
const condition=(id,name,expression,position)=>({id,name,type:'n8n-nodes-base.if',typeVersion:2.2,position,parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:id+'-test',leftValue:expression,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}});
const rounds={name:'Audit - Round Dispatcher - Drain Useful Queue',active:false,settings:{executionOrder:'v1',timezone:'Asia/Bangkok',executionTimeout:2400},pinData:{},nodes:[
  {id:'round-clock',name:'รอบตรวจ 08:00 · 16:30 · 19:00',type:'n8n-nodes-base.scheduleTrigger',typeVersion:1.2,position:[-880,0],parameters:{rule:{interval:[{field:'cronExpression',expression:'0 0 8,19 * * *'},{field:'cronExpression',expression:'0 30 16 * * *'}]}}},
  {id:'manual-round',name:'เริ่มรอบด้วยมือ',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[-880,200],parameters:{}},
  queue,
  {id:'one-round',name:'เริ่มหนึ่งรอบ',type:'n8n-nodes-base.code',typeVersion:2,position:[-420,0],parameters:{jsCode:'return [{json:{}}];'}},
  {id:'peek-queue',name:'ดูคิวที่ทำได้จริง',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[-200,0],alwaysOutputData:true,credentials,parameters:{url:"={{ $vars.SUPABASE_URL }}/rest/v1/daily_recon_jobs?select=id&status=eq.queued&is_archived=eq.false&attempt_count=lt.3&order=business_date,company,updated_at&limit=1",authentication:'predefinedCredentialType',nodeCredentialType:'supabaseApi',options:{}}},
  {id:'queue-guard',name:'ตรวจคิวและกันวนไม่จบ',type:'n8n-nodes-base.code',typeVersion:2,position:[20,0],parameters:{jsCode:"if($runIndex>=500) throw new Error('หยุดเพื่อความปลอดภัย: เกิน 500 งานในรอบเดียว กรุณาตรวจคิวก่อนรันต่อ'); return [{json:{has_work:$input.all().some(x=>!!x.json.id)}}];"}},
  condition('has-work','มีงานจึงเรียก Worker','={{ $json.has_work === true }}',[240,0]),
  {id:'call-worker',name:'ทำหนึ่งงานและรอให้จบ',type:'n8n-nodes-base.executeWorkflow',typeVersion:1.2,position:[460,100],alwaysOutputData:true,parameters:{source:'database',workflowId:{__rl:true,value:'dLkbNHgk3xMy9p82',mode:'id'},workflowInputs:{mappingMode:'defineBelow',value:{},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:true},options:{waitForSubWorkflow:true}}},
  condition('progress','ทำงานแล้วจึงดูคิวถัดไป','={{ $json.worked === true }}',[680,100]),
  {id:'round-done',name:'หยุดเมื่อคิวหมดหรือมี Worker อื่นทำอยู่',type:'n8n-nodes-base.code',typeVersion:2,position:[460,-140],parameters:{jsCode:"return [{json:{finished_at:new Date().toISOString(),message:'จบรอบ: ไม่มีงานที่ทำต่อได้ ไม่เรียก Worker ซ้ำ'}}];"}}
],connections:{
  'รอบตรวจ 08:00 · 16:30 · 19:00':{main:[[edge('Supabase: ตรวจไฟล์และจัดคิว')]]},
  'เริ่มรอบด้วยมือ':{main:[[edge('Supabase: ตรวจไฟล์และจัดคิว')]]},
  'Supabase: ตรวจไฟล์และจัดคิว':{main:[[edge('เริ่มหนึ่งรอบ')]]},
  'เริ่มหนึ่งรอบ':{main:[[edge('ดูคิวที่ทำได้จริง')]]},
  'ดูคิวที่ทำได้จริง':{main:[[edge('ตรวจคิวและกันวนไม่จบ')]]},
  'ตรวจคิวและกันวนไม่จบ':{main:[[edge('มีงานจึงเรียก Worker')]]},
  'มีงานจึงเรียก Worker':{main:[[edge('ทำหนึ่งงานและรอให้จบ')],[edge('หยุดเมื่อคิวหมดหรือมี Worker อื่นทำอยู่')]]},
  'ทำหนึ่งงานและรอให้จบ':{main:[[edge('ทำงานแล้วจึงดูคิวถัดไป')]]},
  'ทำงานแล้วจึงดูคิวถัดไป':{main:[[edge('ดูคิวที่ทำได้จริง')],[edge('หยุดเมื่อคิวหมดหรือมี Worker อื่นทำอยู่')]]}
}};
await writeFile(path.join(root,'n8n/audit-round-worker.json'),JSON.stringify(worker,null,2)+'\n');
await writeFile(path.join(root,'n8n/audit-round-dispatcher.json'),JSON.stringify(rounds,null,2)+'\n');
console.log('Built staged round worker + dispatcher (not deployed)');
