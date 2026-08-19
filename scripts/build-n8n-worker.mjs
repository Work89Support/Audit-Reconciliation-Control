import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFile(path.join(root, name), "utf8");
const [formats, rules, registry, engine, pdfOriginal] = await Promise.all([
  read("formats.js"),
  read("rules.js"),
  read("registry.js"),
  read("engine.js"),
  read("pdf-stm.js"),
]);

const pdf = pdfOriginal.replace(
  "async function parse(fileName, arrayBuffer, businessDate) {\n    const pages = await textLines(arrayBuffer);",
  "async function parse(fileName, pages, businessDate) {",
);

const runtime = [formats, rules, registry, engine, pdf].join("\n\n");
const settings = `({toleranceDeposit:90,toleranceWithdraw:180,diffAlert:1,rules:{crossDay:true,pmSuccessOnly:true,filterCarryForward:true}})`;

const normalizeCode = `${runtime}
const meta=$('วนทีละไฟล์').item.json;
const file=meta.file, job=meta.job, ext=file.ext;
const input=$input.all();
let norm, rawRows=[];
if(ext==='pdf'){
  const text=String((input[0]&&input[0].json&&input[0].json.text)||'');
  const lines=text.split(/\\r?\\n/).map(s=>s.replace(/\\s+/g,' ').trim()).filter(Boolean);
  const pages=[lines.map(text=>({text,items:text.split(/\\s+/).map(s=>({s}))}))];
  norm=await PdfStm.parse(file.file_name,pages,job.business_date);
}else if(ext==='csv'){
  const text=String((input[0]&&input[0].json&&(input[0].json.data??input[0].json.text))||'');
  rawRows=Engine.parseCSV(text);
  norm=Engine.normalize(file.file_name,rawRows,${settings},job.business_date);
}else{
  rawRows=input.map(x=>Array.isArray(x.json.row)?x.json.row:Object.values(x.json));
  norm=Engine.normalize(file.file_name,rawRows,${settings},job.business_date);
}
let tag=Registry.matchFile(file.file_name).match;
const fallbackCompany=job.company||file.company||'';
const fallbackAccount=(tag&&tag.account)||'';
const fallbackBank=(tag&&tag.bank)||'';
for(const r of (norm.records||[])){
  if((!r.account||r.account==='UNKNOWN')&&fallbackAccount) r.account=Registry.normalizeAccount(fallbackAccount,fallbackBank||r.bank);
  else if(r.account&&/\\d/.test(String(r.account))) r.account=Registry.normalizeAccount(r.account,fallbackBank||r.bank);
  if(!r.bank&&fallbackBank) r.bank=fallbackBank;
  r.subco=fallbackCompany;
  r.company=fallbackCompany;
}
for(const r of (norm.aux||[])){ if(!r.company) r.company=fallbackCompany; r.subco=fallbackCompany; }
return [{json:{job,file,format:norm.format,records:norm.records||[],aux:norm.aux||[],row_count:ext==='pdf'?(norm.records||[]).length:rawRows.length,warnings:norm.warnings||[],dropped:norm.dropped||{}}}];`;

const reconcileCode = `const performance={now:()=>Date.now()};\n${formats}\n\n${rules}\n\n${registry}\n\n${engine}
const files=$input.all().map(x=>x.json).filter(x=>x&&x.file);
if(!files.length) throw new Error('ไม่พบไฟล์ที่อ่านได้ในงานนี้');
const job=files[0].job;
const stm=[],bo=[];
for(const f of files){
  if(f.format&&f.format.source==='aux') continue;
  if(f.format&&f.format.source==='bo') bo.push(...(f.records||[]));
  else stm.push(...(f.records||[]));
}
if(bo.some(r=>r.formatCode)){const merged=Formats.merge(bo);bo.length=0;merged.sort((a,b)=>(a.sec||0)-(b.sec||0)).forEach(r=>bo.push(r));}
const parsed=files.filter(f=>f.format&&(f.format.source==='bo'||f.format.source==='aux')).map(f=>({records:f.format.source==='bo'?(f.records||[]):[],aux:f.aux||[]}));
const biz=Rules.run(parsed,${settings});
let result;
const started=Date.now();
if(!stm.length){
  const hourlyStm=new Array(24).fill(0),hourlyMatched=new Array(24).fill(0);
  bo.forEach(r=>hourlyStm[Math.max(0,Math.min(23,Math.floor((r.sec||0)/3600)))]++);
  result={matched:0,exceptions:[],stmCount:0,boCount:bo.length,elapsedMs:0,matchRate:0,noStmCount:bo.length,hourlyStm,hourlyMatched,rulesOnly:true};
}else if(!bo.length){
  throw new Error('ไม่มีรายการฝั่ง BO หลังอ่านไฟล์');
}else{
  result=await Engine.reconcile(stm,bo,{...${settings},asOf:Date.now()},Registry.ACCOUNTS.map(a=>({id:a.account,bank:a.bank,company:a.subco,type:a.type,active:true})),null);
}
const best=new Map();
for(const e of (result.exceptions||[]).concat(biz.exceptions||[])){
  const k=[e.type,e.account,e.time,e.systemAmount??''].join('|');
  const old=best.get(k); if(!old||(!old.detail&&e.detail)) best.set(k,e);
}
const exceptions=[...best.values()].sort((a,b)=>(a.sortSec||0)-(b.sortSec||0)).map((e,i)=>({
  code:'EX-'+String(3001+i),business_date:e.date||job.business_date,occurred_at:e.time||'00:00:00',company:e.company||job.company,
  bank:e.bank||null,account:e.account||null,direction:e.direction||null,member_code:e.member||null,ex_type:e.type,type_name:e.typeName||e.type,
  severity:['critical','high','medium','low'].includes(e.severity)?e.severity:'medium',status:e.status||'open',track:e.track||null,
  system_amount:e.systemAmount??null,bank_amount:e.bankAmount??null,amount_diff:e.amountDiff??0,risk_amount:e.riskAmount??0,time_diff_sec:e.timeDiffSec??0,
  employee:e.employee||null,shift:e.shift||null,cause:e.cause||null,detail:e.detail||null,stm_raw:String(e.stmRaw||'').slice(0,4000),bo_raw:String(e.boRaw||'').slice(0,4000)
}));
const fileIds=files.map(f=>f.file.id).filter(Boolean);
return [{json:{job,result:{run_by:'n8n-cloud-worker',elapsed_ms:result.elapsedMs||Date.now()-started,stm_count:result.stmCount||0,bo_count:result.boCount||0,matched:result.matched||0,match_rate:Number((result.matchRate||0).toFixed(3)),no_stm_count:result.noStmCount||0,file_ids:fileIds,summary:{rules_only:!!result.rulesOnly,rule_exceptions:(biz.exceptions||[]).length,worker_version:'1.0.0'}},exceptions,files:files.map(f=>({id:f.file.id,parsed:true,row_count:f.row_count||0,parse_error:null}))}}];`;

const cred = { supabaseApi: { id: "dGndiinLb7AKnjIu", name: "Supabase account" } };
const http = (id, name, position, parameters) => ({ parameters, id, name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position, credentials: cred });

const nodes = [
  { parameters: { rule: { interval: [{ field: "minutes", minutesInterval: 10 }] } }, id: "schedule", name: "ทุก 10 นาที", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [-1040, 80] },
  { parameters: {}, id: "manual", name: "ทดสอบด้วยมือ", type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-1040, 240] },
  http("queue", "Supabase: ตรวจไฟล์และจัดคิว", [-820, 160], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/queue_due_daily_recon_jobs", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ p_from: DateTime.now().setZone('Asia/Bangkok').minus({ days: 90 }).toISODate(), p_to: DateTime.now().setZone('Asia/Bangkok').plus({ days: 1 }).toISODate() }) }}", options: { response: { response: {} } },
  }),
  { parameters: { jsCode: "return Array.from({length:5},(_,i)=>({json:{slot:i+1}}));" }, id: "slots", name: "เตรียมประมวลผลสูงสุด 5 งาน", type: "n8n-nodes-base.code", typeVersion: 2, position: [-600, 160] },
  { parameters: { batchSize: 1, options: {} }, id: "job-loop", name: "วนทีละงาน", type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-380, 160] },
  http("claim", "Supabase: จองงานถัดไป", [-140, 280], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/claim_daily_recon_job", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ p_worker: 'n8n-cloud-worker' }) }}", options: { response: { response: {} } },
  }),
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "has-job", leftValue: "={{ !!$json.id }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-job", name: "มีงานในคิว?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [80, 280] },
  http("files", "Supabase: อ่านรายการไฟล์ของวัน", [300, 220], {
    url: "={{ $vars.SUPABASE_URL }}/rest/v1/mail_batches?business_date=eq.{{ $json.business_date }}&select=id,company,source_files(id,file_name,storage_path,kind,company,parsed)", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi", options: { response: { response: {} } },
  }),
  { parameters: { jsCode: "const job=$('Supabase: จองงานถัดไป').item.json; const out=[]; for(const b of $input.all().map(x=>x.json)){for(const f of (b.source_files||[])){const company=String(f.company||b.company||'').toUpperCase(); const ext=String(f.file_name||'').split('.').pop().toLowerCase(); if(company===String(job.company||'').toUpperCase()&&['xlsx','xlsm','xls','csv','pdf'].includes(ext)&&f.kind!=='doc_clarify') out.push({json:{job,file:{...f,ext}}});}} if(!out.length) throw new Error('ไม่พบไฟล์ที่รองรับสำหรับ '+job.business_date+' '+job.company); return out;" }, id: "filter-files", name: "เลือกไฟล์ของบริษัท", type: "n8n-nodes-base.code", typeVersion: 2, position: [520, 220] },
  { parameters: { batchSize: 1, options: {} }, id: "file-loop", name: "วนทีละไฟล์", type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [740, 220] },
  http("download", "ดาวน์โหลดไฟล์จาก Storage", [980, 340], {
    url: "={{ $vars.SUPABASE_URL }}/storage/v1/object/audit-files/{{ $json.file.storage_path }}", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    options: { response: { response: { responseFormat: "file", outputPropertyName: "data" } }, timeout: 120000 },
  }),
  { parameters: { conditions: { options: { caseSensitive: false, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "is-pdf", leftValue: "={{ $('วนทีละไฟล์').item.json.file.ext }}", rightValue: "pdf", operator: { type: "string", operation: "equals" } }], combinator: "and" }, options: {} }, id: "if-pdf", name: "เป็น PDF?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1200, 340] },
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "is-excel", leftValue: "={{ ['xlsx','xlsm','xls'].includes($('วนทีละไฟล์').item.json.file.ext) }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-excel", name: "เป็น Excel?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1420, 440] },
  { parameters: { operation: "pdf", binaryPropertyName: "data", options: {} }, id: "extract-pdf", name: "อ่าน PDF", type: "n8n-nodes-base.extractFromFile", typeVersion: 1.1, position: [1420, 280] },
  { parameters: { operation: "xlsx", binaryPropertyName: "data", options: { headerRow: false, rawData: false, readAsString: true } }, id: "extract-xlsx", name: "อ่าน Excel", type: "n8n-nodes-base.extractFromFile", typeVersion: 1.1, position: [1640, 400] },
  { parameters: { operation: "text", binaryPropertyName: "data", destinationKey: "data", options: { encoding: "utf8" } }, id: "extract-csv", name: "อ่าน CSV", type: "n8n-nodes-base.extractFromFile", typeVersion: 1.1, position: [1640, 520] },
  { parameters: { jsCode: normalizeCode }, id: "normalize", name: "แปลงรายการเป็นมาตรฐาน", type: "n8n-nodes-base.code", typeVersion: 2, position: [1880, 340] },
  { parameters: { jsCode: reconcileCode }, id: "reconcile", name: "กระทบยอดและสร้าง Exception", type: "n8n-nodes-base.code", typeVersion: 2, position: [980, 80] },
  http("insert-run", "Supabase: สร้างผลการรัน", [1200, 80], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/recon_runs", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=representation" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ business_date: $json.job.business_date, company: $json.job.company, run_by: $json.result.run_by, elapsed_ms: $json.result.elapsed_ms, stm_count: $json.result.stm_count, bo_count: $json.result.bo_count, matched: $json.result.matched, match_rate: $json.result.match_rate, exception_count: $json.exceptions.length, no_stm_count: $json.result.no_stm_count, file_ids: $json.result.file_ids, summary: { ...$json.result.summary, worker: 'n8n-cloud', job_id: $json.job.id } }) }}", options: { response: { response: {} } },
  }),
  { parameters: { jsCode: "const source=$('กระทบยอดและสร้าง Exception').item.json; const run=$json; const runId=run.id; if(!runId) throw new Error('Supabase ไม่คืน run id'); const exception_rows=source.exceptions.map(e=>({...e,run_id:runId})); const ids=source.files.map(f=>f.id).filter(Boolean); return [{json:{...source,run_id:runId,exception_rows,file_filter:'id=in.('+ids.join(',')+')'}}];" }, id: "prepare-save", name: "เตรียมบันทึก Exception", type: "n8n-nodes-base.code", typeVersion: 2, position: [1420, 80] },
  { ...http("insert-exceptions", "Supabase: บันทึก Exception", [1640, 80], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/exceptions", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=minimal" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify($json.exception_rows) }}", options: { response: { response: {} } },
  }), alwaysOutputData: true },
  { ...http("mark-files", "Supabase: ทำเครื่องหมายไฟล์อ่านแล้ว", [1860, 80], {
    method: "PATCH", url: "={{ $vars.SUPABASE_URL }}/rest/v1/source_files?{{ $('เตรียมบันทึก Exception').item.json.file_filter }}", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=minimal" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ parsed: true, parsed_at: $now.toISO(), parse_error: null }) }}", options: { response: { response: {} } },
  }), alwaysOutputData: true },
  http("finish", "Supabase: ปิดงานสำเร็จ", [2080, 80], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/finish_daily_recon_job", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ p_job_id: $('เตรียมบันทึก Exception').item.json.job.id, p_run_id: $('เตรียมบันทึก Exception').item.json.run_id }) }}", options: { response: { response: {} } },
  }),
  { parameters: { jsCode: "return [{json:{finished_at:new Date().toISOString(),message:'ประมวลผลรอบนี้เสร็จแล้ว'}}];" }, id: "summary", name: "จบรอบ Worker", type: "n8n-nodes-base.code", typeVersion: 2, position: [-140, 40] },
];

const connections = {
  "ทุก 10 นาที": { main: [[{ node: "Supabase: ตรวจไฟล์และจัดคิว", type: "main", index: 0 }]] },
  "ทดสอบด้วยมือ": { main: [[{ node: "Supabase: ตรวจไฟล์และจัดคิว", type: "main", index: 0 }]] },
  "Supabase: ตรวจไฟล์และจัดคิว": { main: [[{ node: "เตรียมประมวลผลสูงสุด 5 งาน", type: "main", index: 0 }]] },
  "เตรียมประมวลผลสูงสุด 5 งาน": { main: [[{ node: "วนทีละงาน", type: "main", index: 0 }]] },
  "วนทีละงาน": { main: [[{ node: "จบรอบ Worker", type: "main", index: 0 }], [{ node: "Supabase: จองงานถัดไป", type: "main", index: 0 }]] },
  "Supabase: จองงานถัดไป": { main: [[{ node: "มีงานในคิว?", type: "main", index: 0 }]] },
  "มีงานในคิว?": { main: [[{ node: "Supabase: อ่านรายการไฟล์ของวัน", type: "main", index: 0 }], [{ node: "วนทีละงาน", type: "main", index: 0 }]] },
  "Supabase: อ่านรายการไฟล์ของวัน": { main: [[{ node: "เลือกไฟล์ของบริษัท", type: "main", index: 0 }]] },
  "เลือกไฟล์ของบริษัท": { main: [[{ node: "วนทีละไฟล์", type: "main", index: 0 }]] },
  "วนทีละไฟล์": { main: [[{ node: "กระทบยอดและสร้าง Exception", type: "main", index: 0 }], [{ node: "ดาวน์โหลดไฟล์จาก Storage", type: "main", index: 0 }]] },
  "ดาวน์โหลดไฟล์จาก Storage": { main: [[{ node: "เป็น PDF?", type: "main", index: 0 }]] },
  "เป็น PDF?": { main: [[{ node: "อ่าน PDF", type: "main", index: 0 }], [{ node: "เป็น Excel?", type: "main", index: 0 }]] },
  "เป็น Excel?": { main: [[{ node: "อ่าน Excel", type: "main", index: 0 }], [{ node: "อ่าน CSV", type: "main", index: 0 }]] },
  "อ่าน PDF": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "อ่าน Excel": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "อ่าน CSV": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "แปลงรายการเป็นมาตรฐาน": { main: [[{ node: "วนทีละไฟล์", type: "main", index: 0 }]] },
  "กระทบยอดและสร้าง Exception": { main: [[{ node: "Supabase: สร้างผลการรัน", type: "main", index: 0 }]] },
  "Supabase: สร้างผลการรัน": { main: [[{ node: "เตรียมบันทึก Exception", type: "main", index: 0 }]] },
  "เตรียมบันทึก Exception": { main: [[{ node: "Supabase: บันทึก Exception", type: "main", index: 0 }]] },
  "Supabase: บันทึก Exception": { main: [[{ node: "Supabase: ทำเครื่องหมายไฟล์อ่านแล้ว", type: "main", index: 0 }]] },
  "Supabase: ทำเครื่องหมายไฟล์อ่านแล้ว": { main: [[{ node: "Supabase: ปิดงานสำเร็จ", type: "main", index: 0 }]] },
  "Supabase: ปิดงานสำเร็จ": { main: [[{ node: "วนทีละงาน", type: "main", index: 0 }]] },
};

const workflow = { name: "Audit - Headless Reconciliation Worker", nodes, connections, settings: { executionOrder: "v1", binaryMode: "separate", saveManualExecutions: true }, pinData: {}, active: false };
await writeFile(path.join(root, "n8n/audit-headless-worker.json"), JSON.stringify(workflow, null, 2) + "\n");
console.log(`built n8n/audit-headless-worker.json (${workflow.nodes.length} nodes)`);
