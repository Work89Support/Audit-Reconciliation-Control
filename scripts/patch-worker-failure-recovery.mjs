import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
export const workerId='hggaOLqKPXB5roGM';
export const claimBody="={{ JSON.stringify({p_worker:'n8n-cloud-worker:'+String($execution.id),p_limit:1}) }}";
export const failureBody="={{ JSON.stringify({p_execution_id:String($json.execution?.id||''),p_workflow_id:String($json.workflow?.id||''),p_error:String($json.execution?.error?.message||$json.trigger?.error?.message||'Worker failed').slice(0,1600),p_last_node:String($json.execution?.lastNodeExecuted||'').slice(0,200)}) }}";
export function patchWorker(workflow,errorWorkflowId) {
 assert.equal(workflow.id,workerId,'ต้องใช้ export ของ Worker หลักเท่านั้น');
 const claim=workflow.nodes.find(n=>n.name==='Supabase: จองหนึ่งงาน');
 assert(claim?.parameters.url.includes('/rpc/claim_daily_recon_jobs'));
 claim.parameters.jsonBody=claimBody;
 const rename=workflow.nodes.find(n=>n.name==='คืนชื่อไฟล์ต้นฉบับ');
 assert(rename?.type==='n8n-nodes-base.code');
 // โหนดนี้คืนชื่อไฟล์อย่างเดียว ไม่มีการเขียนผล จึงลองใหม่แบบมีขอบเขตได้
 Object.assign(rename,{retryOnFail:true,maxTries:3,waitBetweenTries:15000});
 const summary=workflow.nodes.find(n=>n.name==='จบรอบ Worker');
 assert(summary?.type==='n8n-nodes-base.code');
 summary.parameters.jsCode="const job=$('Supabase: จองหนึ่งงาน').first().json; return [{json:{worked:!!job.id,job_id:job.id||null,finished_at:new Date().toISOString()}}];";
 assert(errorWorkflowId,'ต้องระบุ Error Workflow ที่เตรียมไว้');
 workflow.settings={...workflow.settings,errorWorkflow:errorWorkflowId};
 return workflow;
}
export function failureWorkflow(worker) {
 const claim=structuredClone(worker.nodes.find(n=>n.name==='Supabase: จองหนึ่งงาน'));
 assert(claim?.credentials?.supabaseApi);
 claim.id='fail-bound-execution';claim.name='Supabase: คืนสถานะเฉพาะ execution ที่ล้มเหลว';claim.position=[240,0];
 claim.parameters.url='={{ $vars.SUPABASE_URL }}/rest/v1/rpc/fail_daily_recon_execution';
 claim.parameters.jsonBody=failureBody;claim.parameters.options={...claim.parameters.options,timeout:30000};
 Object.assign(claim,{retryOnFail:true,maxTries:3,waitBetweenTries:5000});
 const trigger={id:'automatic-worker-error',name:'รับข้อผิดพลาด Worker',type:'n8n-nodes-base.errorTrigger',typeVersion:1,position:[0,0],parameters:{}};
 return {name:'Audit — Automatic worker failure finalizer (lease bound)',active:false,nodes:[trigger,claim],connections:{[trigger.name]:{main:[[{node:claim.name,type:'main',index:0}]]}},settings:{executionOrder:'v1',saveDataSuccessExecution:'all',saveDataErrorExecution:'all'}};
}
export function patchDispatcher(workflow) {
 assert.equal(workflow.id,'UBddGOySmAWzCgTu');
 const call=workflow.nodes.find(n=>n.name==='ทำหนึ่งงานและรอให้จบ');
 assert.equal(call?.parameters.workflowId.value,workerId);
 call.parameters.options={...call.parameters.options,waitForSubWorkflow:true};
 call.onError='continueRegularOutput';
 return workflow;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const [, ,kind,input,output,errorId]=process.argv;
 const workflow=JSON.parse(fs.readFileSync(input,'utf8'));
 const result=kind==='failure'?failureWorkflow(workflow):kind==='dispatcher'?patchDispatcher(workflow):patchWorker(workflow,errorId);
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
}
