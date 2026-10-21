import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const gmailCredentials={gmailOAuth2:{id:'REPLACE_GMAIL_CRED',name:'Gmail (work.ltd89)'}};
const supabaseCredentials={supabaseApi:{id:'REPLACE_SUPABASE_CRED',name:'Supabase API'}};
const liveWorkflow={__rl:true,value:'REPLACE_WITH_LIVE_WORKFLOW_ID',mode:'list',cachedResultName:'Audit — Live Gmail ingest เข้า Supabase (v2)'};
const schedule=(id,name,minutes,x)=>({parameters:{rule:{interval:[{field:'minutes',minutesInterval:minutes}]}},id,name,type:'n8n-nodes-base.scheduleTrigger',typeVersion:1.2,position:x});
const http=(id,name,parameters,position)=>({parameters:{authentication:'predefinedCredentialType',nodeCredentialType:'supabaseApi',options:{timeout:30000},...parameters},id,name,type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position,credentials:supabaseCredentials});
const code=(id,name,jsCode,position)=>({parameters:{jsCode},id,name,type:'n8n-nodes-base.code',typeVersion:2,position});
const gmailList=(id,name,query,position)=>({parameters:{operation:'getAll',returnAll:false,limit:20,filters:{q:query},options:{}},id,name,type:'n8n-nodes-base.gmail',typeVersion:2.1,position,alwaysOutputData:true,credentials:gmailCredentials});
const gmailGet=(id,name,position)=>({parameters:{operation:'get',messageId:'={{ $json.id }}',simple:false,options:{downloadAttachments:true,dataPropertyAttachmentsPrefixName:'attachment_'}},id,name,type:'n8n-nodes-base.gmail',typeVersion:2.1,position,credentials:gmailCredentials});
const runLive=(id,name,position)=>({parameters:{workflowId:liveWorkflow,workflowInputs:{mappingMode:'defineBelow',value:{},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:true},options:{waitForSubWorkflow:true}},id,name,type:'n8n-nodes-base.executeWorkflow',typeVersion:1.2,position});
const connect=(...names)=>Object.fromEntries(names.slice(0,-1).map((name,index)=>[name,{main:[[{node:names[index+1],type:'main',index:0}]]}]));

const poller={
  name:'Audit — Registry Gmail intake ทุก 5 นาที',
  nodes:[
    schedule('schedule','ตรวจเมลทุก 5 นาที',5,[-720,260]),
    http('sources','อ่านทะเบียนผู้ส่ง',{url:'={{ $vars.SUPABASE_URL }}/rest/v1/mail_sources?active=eq.true&select=email&order=email'},[-500,260]),
    code('query','สร้างคำค้นจากทะเบียน',`const emails=$input.all().map(i=>String(i.json.email||'').trim().toLowerCase()).filter(Boolean);\nif(!emails.length)return [];\nconst senders=emails.map(email=>'from:'+email.replace(/[^a-z0-9@._%+\\-]/g,'')).join(' ');\nreturn [{json:{query:'has:attachment newer_than:30m -label:ingested {'+senders+'}'}}];`,[-280,260]),
    gmailList('list','ค้นเมลจากผู้ส่งที่เปิดใช้','={{ $json.query }}',[-40,260]),
    code('valid','ตัดรายการว่าง',`return $input.all().filter(item=>item.json&&item.json.id);`,[180,260]),
    gmailGet('get','ดาวน์โหลดเมลและไฟล์แนบ',[400,260]),
    runLive('live','ส่งเข้า Workflow Live',[640,260]),
  ],
  connections:connect('ตรวจเมลทุก 5 นาที','อ่านทะเบียนผู้ส่ง','สร้างคำค้นจากทะเบียน','ค้นเมลจากผู้ส่งที่เปิดใช้','ตัดรายการว่าง','ดาวน์โหลดเมลและไฟล์แนบ','ส่งเข้า Workflow Live'),
  settings:{executionOrder:'v1',saveManualExecutions:true,timezone:'Asia/Bangkok',callerPolicy:'workflowsFromSameOwner'},pinData:{},meta:{instanceId:'audit-ai-reconciliation'},tags:[{name:'audit'},{name:'mail-intake'}]
};

const queue={
  name:'Audit — Mail pull request worker',
  nodes:[
    schedule('schedule','ตรวจคิวดึงเมลทุก 2 นาที',2,[-900,300]),
    http('claim','รับคำขอหนึ่งรายการ',{method:'POST',url:'={{ $vars.SUPABASE_URL }}/rest/v1/rpc/claim_mail_pull_request',sendBody:true,specifyBody:'json',jsonBody:'={}'},[-680,300]),
    {parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'has-id',leftValue:'={{ $json.id }}',rightValue:'',operator:{type:'string',operation:'notEmpty',singleValue:true}}],combinator:'and'},options:{}},id:'has-request',name:'มีคำขอหรือไม่',type:'n8n-nodes-base.if',typeVersion:2.2,position:[-460,300]},
    code('query','สร้างคำค้นย้อนหลัง',`const request=$json;\nconst from=DateTime.fromISO(request.date_from,{zone:'Asia/Bangkok'}).minus({days:1}).toFormat('yyyy/MM/dd');\nconst before=DateTime.fromISO(request.date_to,{zone:'Asia/Bangkok'}).plus({days:1}).toFormat('yyyy/MM/dd');\nreturn [{json:{request,query:'has:attachment -label:ingested from:'+request.source_email+' after:'+from+' before:'+before}}];`,[-230,220]),
    gmailList('list','ค้นเมลย้อนหลังสูงสุด 20 ฉบับ','={{ $json.query }}',[0,220]),
    code('attach','แนบเลขคำขอ',`const request=$('สร้างคำค้นย้อนหลัง').first().json.request;\nconst messages=$input.all().filter(item=>item.json&&item.json.id);\nreturn messages.length?messages.map(item=>({json:{...item.json,mail_pull_request_id:request.id},binary:item.binary})):[{json:{mail_pull_request_id:request.id,empty:true}}];`,[220,220]),
    {parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'has-message',leftValue:'={{ $json.id }}',rightValue:'',operator:{type:'string',operation:'notEmpty',singleValue:true}}],combinator:'and'},options:{}},id:'has-message',name:'พบเมลหรือไม่',type:'n8n-nodes-base.if',typeVersion:2.2,position:[440,220]},
    gmailGet('get','ดาวน์โหลดเมลย้อนหลังและไฟล์แนบ',[680,120]),
    runLive('live','ส่งเมลย้อนหลังเข้า Workflow Live',[920,120]),
    code('summary','สรุปผลนำเข้า',`const request=$('สร้างคำค้นย้อนหลัง').first().json.request;\nconst count=$input.all().length;\nreturn [{json:{id:request.id,status:count>=20?'partial':'completed',found:count,imported:count,skipped:0,receipt:{archive_only:true,limit:20}}}];`,[1160,120]),
    code('empty','สรุปว่าไม่พบเมล',`const request=$('สร้างคำค้นย้อนหลัง').first().json.request;return [{json:{id:request.id,status:'completed',found:0,imported:0,skipped:0,receipt:{archive_only:true,limit:20}}}];`,[680,360]),
    http('finish','บันทึกใบรับผลดึง',{method:'POST',url:'={{ $vars.SUPABASE_URL }}/rest/v1/rpc/finish_mail_pull_request',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify({p_id:$json.id,p_status:$json.status,p_found:$json.found,p_imported:$json.imported,p_skipped:$json.skipped,p_error:null,p_receipt:$json.receipt}) }}'},[1400,240]),
  ],
  connections:{
    'ตรวจคิวดึงเมลทุก 2 นาที':{main:[[{node:'รับคำขอหนึ่งรายการ',type:'main',index:0}]]},
    'รับคำขอหนึ่งรายการ':{main:[[{node:'มีคำขอหรือไม่',type:'main',index:0}]]},
    'มีคำขอหรือไม่':{main:[[{node:'สร้างคำค้นย้อนหลัง',type:'main',index:0}],[]]},
    'สร้างคำค้นย้อนหลัง':{main:[[{node:'ค้นเมลย้อนหลังสูงสุด 20 ฉบับ',type:'main',index:0}]]},
    'ค้นเมลย้อนหลังสูงสุด 20 ฉบับ':{main:[[{node:'แนบเลขคำขอ',type:'main',index:0}]]},
    'แนบเลขคำขอ':{main:[[{node:'พบเมลหรือไม่',type:'main',index:0}]]},
    'พบเมลหรือไม่':{main:[[{node:'ดาวน์โหลดเมลย้อนหลังและไฟล์แนบ',type:'main',index:0}],[{node:'สรุปว่าไม่พบเมล',type:'main',index:0}]]},
    'ดาวน์โหลดเมลย้อนหลังและไฟล์แนบ':{main:[[{node:'ส่งเมลย้อนหลังเข้า Workflow Live',type:'main',index:0}]]},
    'ส่งเมลย้อนหลังเข้า Workflow Live':{main:[[{node:'สรุปผลนำเข้า',type:'main',index:0}]]},
    'สรุปผลนำเข้า':{main:[[{node:'บันทึกใบรับผลดึง',type:'main',index:0}]]},
    'สรุปว่าไม่พบเมล':{main:[[{node:'บันทึกใบรับผลดึง',type:'main',index:0}]]},
  },
  settings:{executionOrder:'v1',saveManualExecutions:true,timezone:'Asia/Bangkok',callerPolicy:'workflowsFromSameOwner'},pinData:{},meta:{instanceId:'audit-ai-reconciliation'},tags:[{name:'audit'},{name:'mail-intake'},{name:'backfill'}]
};

for(const [file,workflow] of [['audit-mail-registry-poller.json',poller],['audit-mail-pull-queue.json',queue]])fs.writeFileSync(path.join(root,'n8n',file),JSON.stringify(workflow,null,2)+'\n');

