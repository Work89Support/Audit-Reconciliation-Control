import fs from 'node:fs/promises';
const base=JSON.parse(await fs.readFile(new URL('../n8n/audit-headless-worker.json',import.meta.url),'utf8'));
// Reuse the proven parsers/quality gates; omit every daily-run write/close node.
const start=base.nodes.findIndex(n=>n.name==='Supabase: อ่านรายการไฟล์ของวัน');
const end=base.nodes.findIndex(n=>n.name==='กระทบยอดและสร้าง Exception');
const nodes=structuredClone(base.nodes.slice(start,end+1));
const claim=structuredClone(base.nodes.find(n=>n.name==='Supabase: จองหนึ่งงาน'));
claim.id='claim-scoped';claim.parameters.url='={{ $vars.SUPABASE_URL }}/rest/v1/rpc/claim_account_recheck';
claim.parameters.jsonBody='={{ JSON.stringify({p_id:$json.body.job_id,p_execution_id:$execution.id}) }}';
const webhook={id:'account-recheck-hook',name:'เริ่มตรวจเฉพาะบัญชี',type:'n8n-nodes-base.webhook',typeVersion:2,
 position:[-300,0],parameters:{httpMethod:'POST',path:'account-recheck',authentication:'headerAuth',responseMode:'onReceived'},
 credentials:{httpHeaderAuth:{id:'aWWc6GWpAusDqYsA',name:'Account recheck worker secret'}}};
const calculate=nodes.find(n=>n.name==='กระทบยอดและสร้าง Exception');
const readFiles=nodes.find(n=>n.name==='Supabase: อ่านรายการไฟล์ของวัน');
readFiles.parameters.method='POST';
readFiles.parameters.url='={{ $vars.SUPABASE_URL }}/rest/v1/rpc/effective_audit_source_batches';
readFiles.parameters.sendBody=true;readFiles.parameters.specifyBody='json';
readFiles.parameters.jsonBody='={{ JSON.stringify({p_company:$json.company,p_date:$json.business_date}) }}';
const selectFiles=nodes.find(n=>n.name==='เลือกไฟล์ของบริษัท');
const loopNeedle='for(const f of (b.source_files||[])){';
if(!selectFiles.parameters.jsCode.includes(loopNeedle))throw Error('File selector changed');
selectFiles.parameters.jsCode=selectFiles.parameters.jsCode.replace(loopNeedle,loopNeedle+"if(!job.selected_file_ids?.includes(f.id)||f.excluded) continue;");
// Explicitly selected receipts must not be silently collapsed by filename.
selectFiles.parameters.jsCode=selectFiles.parameters.jsCode.replace(/const healthyNames=new Set[\s\S]*?const out=selected\.map/, 'const selected=candidates; const out=selected.map');
selectFiles.parameters.jsCode=selectFiles.parameters.jsCode.replace('({json:{job,file},pairedItem:',"({json:{job,file:{...file,selection_id:file.id,id:file.physical_source_file_id||file.id}},pairedItem:");
const needle="if(bo.some(r=>r.formatCode))";
if(!calculate.parameters.jsCode.includes(needle))throw Error('Scoped worker baseline changed');
calculate.parameters.jsCode=calculate.parameters.jsCode.replace(needle,`const scopeRow=r=>String(r.subco||r.company||'').toUpperCase()===job.company
 &&(job.account==='ALL'||String(r.account||'').trim()===job.account)&&(job.direction==='all'||r.direction===job.direction);
 const scopedStm=stm.filter(scopeRow),scopedBo=bo.filter(scopeRow);
 stm.length=0;stm.push(...scopedStm);bo.length=0;bo.push(...scopedBo);
 if(!stm.length||!bo.length) throw Error('ไม่พบข้อมูลทั้งสองฝั่งของบัญชี ไม่ถือว่าข้อมูลขาดเป็นยอดศูนย์');
 ${needle}`);
// Rules sees ONLY selected BO rows, never the company-wide files.
const parsedNeedle="records:f.format.source==='bo'?(f.records||[]):[]";
if(!calculate.parameters.jsCode.includes(parsedNeedle))throw Error('Scoped Rules baseline changed');
calculate.parameters.jsCode=calculate.parameters.jsCode.replace(parsedNeedle,"records:f.format.source==='bo'?(f.records||[]).filter(scopeRow):[]");
const finish=structuredClone(claim);finish.id='finish-scoped';finish.name='Supabase: เก็บผลรอทบทวน';
finish.parameters.url='={{ $vars.SUPABASE_URL }}/rest/v1/rpc/finish_account_recheck';
// Keep nested object closers separated: n8n's expression delimiter is also "}}".
finish.parameters.jsonBody=`={{ JSON.stringify({p_id:$json.job.id,p_revision:$json.job.revision,p_error:$json.quality_errors?.length?'ไม่ผ่าน Quality Gate ตรวจแหล่งข้อมูล/รูปแบบไฟล์ก่อนลองใหม่':null,p_result:{quality:'passed',company:$json.job.company,business_date:$json.job.business_date,account:$json.job.account,direction:$json.job.direction,stm_count:$json.result?.stm_count||0,bo_count:$json.result?.bo_count||0,matched:$json.result?.matched||0,match_evidence:$json.result?.summary?.match_evidence||[],summary:$json.result?.summary||{},exceptions:$json.exceptions||[],source_files:$json.files||[],worker_version:$json.result?.summary?.worker_version} }) }}`;
const names=new Set(nodes.map(n=>n.name));names.add(claim.name);names.add(finish.name);names.add(webhook.name);
const connections={};
for(const [name,connection] of Object.entries(base.connections)){
 if(!names.has(name))continue;
 connections[name]={main:connection.main.map(branch=>branch.filter(e=>names.has(e.node)))};
}
connections[webhook.name]={main:[[{node:claim.name,type:'main',index:0}]]};
connections[claim.name]={main:[[{node:nodes[0].name,type:'main',index:0}]]};
connections[calculate.name]={main:[[{node:finish.name,type:'main',index:0}]]};
const workflow={name:'Audit — Manual account recheck (no case closure)',active:false,nodes:[webhook,claim,...nodes,finish],connections,settings:{executionOrder:'v1',executionTimeout:1500,saveDataSuccessExecution:'none',saveDataErrorExecution:'none',...(process.env.ACCOUNT_RECHECK_ERROR_WORKFLOW_ID?{errorWorkflow:process.env.ACCOUNT_RECHECK_ERROR_WORKFLOW_ID}:{})}};
await fs.writeFile(new URL('../n8n/audit-account-recheck.json',import.meta.url),JSON.stringify(workflow,null,2)+'\n');
const failure=structuredClone(claim);failure.id='fail-manual-recheck';failure.name='Supabase: จบงานตรวจซ้ำที่ล้มเหลว';
failure.parameters.url='={{ $vars.SUPABASE_URL }}/rest/v1/rpc/fail_account_recheck_execution';
failure.parameters.jsonBody='={{ JSON.stringify({p_execution_id:String($json.execution?.id||""),p_error:"Worker ล้มเหลว กรุณาตรวจ execution ID ใน n8n ก่อนลองใหม่"}) }}';
const trigger={id:'manual-recheck-error',name:'Worker ตรวจซ้ำล้มเหลว',type:'n8n-nodes-base.errorTrigger',typeVersion:1,parameters:{},position:[-300,0]};
await fs.writeFile(new URL('../n8n/audit-account-recheck-error.json',import.meta.url),JSON.stringify({name:'Audit — Manual recheck failure finalizer (no financial writes)',active:false,nodes:[trigger,failure],connections:{[trigger.name]:{main:[[{node:failure.name,type:'main',index:0}]]}},settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none'}},null,2)+'\n');
