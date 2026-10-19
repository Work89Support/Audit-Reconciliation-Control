// Can also patch an exported live worker without replacing any parser/code.
export function patchWorkerPreflightGate(workflow){
 const stage='Supabase: พักรายงานที่มีคำเตือนก่อนสร้างเคส',check='ไม่มีคำเตือนและเขียนผลต่อได้?';
 if(workflow.nodes.some(n=>n.name===stage))return workflow;
 const quality=workflow.connections['ไฟล์ผ่าน Quality Gate?'];
 if(quality?.main?.[0]?.length!==1||quality.main[0][0].node!=='เตรียมข้อมูลผลการรัน')throw Error('Unreviewed worker quality branch');
 const original=workflow.nodes.find(n=>n.name==='Supabase: สร้างผลการรัน');
 if(!original||!workflow.nodes.some(n=>n.name==='จบรอบ Worker'))throw Error('Worker publication nodes changed');
 const http=structuredClone(original);
 http.id='preflight-report-before-case-writes';http.name=stage;http.position=[1550,-220];
 Object.assign(http.parameters,{method:'POST',url:'={{ $vars.SUPABASE_URL }}/rest/v1/rpc/stage_daily_recon_preflight',sendBody:true,specifyBody:'json',jsonBody:"={{ (()=>{const x=$('กระทบยอดและสร้าง Exception').first().json;return JSON.stringify({p_job_id:x.job.id,p_result:x.result,p_exceptions:x.exceptions});})() }}"});
 // Never retry a mutating staging call implicitly; its database nonce is also idempotent.
 http.retryOnFail=false;
 const gate={id:'preflight-report-proceed',name:check,type:'n8n-nodes-base.if',typeVersion:2.2,position:[1770,-220],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'loose',version:2},conditions:[{id:'preflight-proceed',leftValue:'={{ $json.proceed === true }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};
 workflow.nodes.push(http,gate);
 quality.main[0]=[{node:stage,type:'main',index:0}];
 workflow.connections[stage]={main:[[{node:check,type:'main',index:0}]]};
 workflow.connections[check]={main:[[{node:'เตรียมข้อมูลผลการรัน',type:'main',index:0}],[{node:'จบรอบ Worker',type:'main',index:0}]]};
 return workflow;
}
