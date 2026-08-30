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
const settings = `({toleranceDeposit:90,toleranceWithdraw:180,exactUniqueTolerance:600,diffAlert:1,rules:{crossDay:true,pmSuccessOnly:true,filterCarryForward:true}})`;

const normalizeCode = `${runtime}
const meta=$('วนทีละไฟล์').item.json;
const file=meta.file, job=meta.job, ext=file.ext;
const input=$input.all();
let norm, rawRows=[], extractedText='';
let parseError=null;
let acceptedEmptyPm=false;
const upstreamError=input[0]&&input[0].json&&input[0].json.error;
if(upstreamError){
  parseError='อ่านไฟล์ไม่สำเร็จ ('+file.file_name+'): '+String(upstreamError.message||upstreamError.description||upstreamError).slice(0,500);
}
try{
  if(parseError){
    norm={format:{source:'unknown',realCode:null},records:[],aux:[],warnings:[],dropped:{}};
  }else if(ext==='pdf'){
    extractedText=String((input[0]&&input[0].json&&input[0].json.text)||'');
    const rawLines=extractedText.split(/\\r?\\n/).map(s=>s.replace(/\\s+/g,' ').trim()).filter(Boolean);
    // n8n's native PDF extractor returns some KBANK rows in visual-column order:
    // date time channel+balance description++transaction amount. Rebuild those rows
    // into the logical order expected by PdfStm (date time transaction amount balance ...).
    const joined=[];
    let pending='';
    for(const line of rawLines){
      if(/^\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}\\s+\\d{1,2}:\\d{2}\\b/.test(line)){
        if(pending) joined.push(pending);
        pending=line;
        if(/\\+\\+/.test(pending)){joined.push(pending);pending='';}
      }else if(pending){
        pending+=' '+line;
        if(/\\+\\+/.test(pending)){joined.push(pending);pending='';}
      }else joined.push(line);
    }
    if(pending) joined.push(pending);
    const lines=joined.map(line=>{
      const m=line.match(/^(\\d{1,2}-\\d{1,2}-\\d{2,4})\\s+(\\d{1,2}:\\d{2})\\s+(.+?)(-?[\\d,]+\\.\\d{2})\\s+(.*?)\\+\\+(รับโอนเงิน|โอนเงิน|ฝากเงิน|ถอนเงิน|หักบัญชี|ดอกเบี้ย|ค่าธรรมเนียม)\\s+(-?[\\d,]+\\.\\d{2})\\s*$/);
      return m?[m[1],m[2],m[6],m[7],m[4],m[3].trim(),m[5].trim()].filter(Boolean).join(' '):line;
    });
    const pages=[lines.map(text=>({text,items:text.split(/\\s+/).map(s=>({s}))}))];
    norm=await PdfStm.parse(file.file_name,pages,job.business_date);
  }else if(ext==='csv'){
    const text=String((input[0]&&input[0].json&&(input[0].json.data??input[0].json.text))||'');
    rawRows=Engine.parseCSV(text);
    const meaningfulText=text.replace(/^\uFEFF/,'').trim();
    acceptedEmptyPm=file.kind==='pm_statement'&&Number(file.size_bytes||0)<=16&&!meaningfulText;
    norm=acceptedEmptyPm
      ? {format:{source:'stm',realCode:'pm_empty'},records:[],aux:[],warnings:['ไฟล์ PM ไม่มีรายการ (0 รายการ)'],dropped:{}}
      : Engine.normalize(file.file_name,rawRows,${settings},job.business_date);
  }else{
    rawRows=input.map(x=>Array.isArray(x.json.row)?x.json.row:Object.values(x.json));
    norm=Engine.normalize(file.file_name,rawRows,${settings},job.business_date);
  }
}catch(error){
  parseError='อ่านไฟล์ไม่สำเร็จ: '+String(error&&error.message||error).slice(0,500);
  norm={format:{source:'unknown',realCode:null},records:[],aux:[],warnings:[],dropped:{}};
}
norm=norm||{format:{source:'unknown',realCode:null},records:[],aux:[],warnings:[],dropped:{}};
norm.format=norm.format||{source:'unknown',realCode:null};
const detectedSource=norm.format.source||'unknown';
const usableRows=(norm.records||[]).length+(norm.aux||[]).length;
const nonEmptyRows=rawRows.filter(r=>Array.isArray(r)&&r.some(v=>String(v??'').trim()!=='')).length;
if(!parseError&&ext==='pdf'&&!extractedText.trim()) parseError='ไม่พบข้อความใน PDF (อาจเป็นไฟล์สแกนหรือไฟล์เสีย)';
if(!parseError&&ext==='csv'&&nonEmptyRows===0&&!acceptedEmptyPm&&Number(file.size_bytes||0)>16) parseError='ดาวน์โหลดไฟล์แล้ว แต่โหนดอ่าน CSV ไม่คืนข้อมูล (ตรวจ encoding หรือขั้นตอนส่งต่อใน n8n)';
if(!parseError&&ext!=='pdf'&&nonEmptyRows===0&&!acceptedEmptyPm) parseError='ไฟล์ตารางว่างหรือไม่มีหัวตาราง';
if(!parseError&&ext!=='pdf'&&detectedSource==='unknown') parseError='ไม่พบหัวตารางที่รองรับภายใน 30 แถวแรก';
if(!parseError&&usableRows===0&&!acceptedEmptyPm) parseError='อ่านหัวตารางได้ แต่ไม่พบรายการที่นำไปกระทบยอดได้';
let tag=Registry.matchFile(file.file_name).match;
const fallbackCompany=job.company||file.company||'';
const fallbackAccount=(tag&&tag.account)||'';
const fallbackBank=(tag&&tag.bank)||'';
const kindSource={stm_pdf:'stm',pm_statement:'stm',bo_main:'bo',manual_credit:'bo',manual_payment:'bo',manual_bonus:'aux',comm_req:'aux',credit_out:'aux'};
if(!parseError&&kindSource[file.kind]) norm.format.source=kindSource[file.kind];
for(const r of (norm.records||[])){
  const pmKey=Formats.canonicalPm(r.channel||r.account||'');
  if(pmKey){r.account=pmKey;r.channel=pmKey;}
  if((!r.account||r.account==='UNKNOWN')&&fallbackAccount) r.account=Registry.normalizeAccount(fallbackAccount,fallbackBank||r.bank);
  else if(r.account&&/\\d/.test(String(r.account))) r.account=Registry.normalizeAccount(r.account,fallbackBank||r.bank);
  if(!r.bank&&fallbackBank) r.bank=fallbackBank;
  r.subco=fallbackCompany;
  r.company=fallbackCompany;
}
for(const r of (norm.aux||[])){ if(!r.company) r.company=fallbackCompany; r.subco=fallbackCompany; }
return [{json:{job,file,format:norm.format,detected_source:detectedSource,records:norm.records||[],aux:norm.aux||[],parsed:!parseError,row_count:usableRows,extracted_row_count:ext==='pdf'?extractedText.split(/\\r?\\n/).filter(s=>s.trim()).length:nonEmptyRows,parse_error:parseError,warnings:norm.warnings||[],dropped:norm.dropped||{}},pairedItem:{item:0}}];`;

const reconcileCode = `const performance={now:()=>Date.now()};\n${formats}\n\n${rules}\n\n${registry}\n\n${engine}
const files=$input.all().map(x=>x.json).filter(x=>x&&x.file);
if(!files.length) throw new Error('ไม่พบไฟล์ที่อ่านได้ในงานนี้');
const job=files[0].job;
const qualityErrors=files.filter(f=>f.parse_error).map(f=>({id:f.file.id,file_name:f.file.file_name,parse_error:f.parse_error,row_count:f.row_count||0}));
const parseResults=files.map(f=>({id:f.file.id,file_name:f.file.file_name,parsed:!f.parse_error,row_count:f.row_count||0,parse_error:f.parse_error||null}));
if(qualityErrors.length) return [{json:{job,result:null,exceptions:[],files:parseResults,quality_errors:qualityErrors},pairedItem:{item:0}}];
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
}else{
  result=await Engine.reconcile(stm,bo,{...${settings},asOf:Date.now()},Registry.ACCOUNTS.map(a=>({id:a.account,bank:a.bank,company:a.subco,type:a.type,active:true})),null);
}
const matchedBoKeys=new Set(result.matchedBoKeys||[]);
const resolvedRuleExceptions=(biz.exceptions||[]).filter(e=>!(e.type==='cross_day'&&e.sourceKey&&matchedBoKeys.has(e.sourceKey)));
const best=new Map();
for(const e of (result.exceptions||[]).concat(resolvedRuleExceptions)){
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
return [{json:{job,result:{run_by:'n8n-cloud-worker',elapsed_ms:result.elapsedMs||Date.now()-started,stm_count:result.stmCount||0,bo_count:result.boCount||0,matched:result.matched||0,match_rate:Number((result.matchRate||0).toFixed(3)),no_stm_count:result.noStmCount||0,file_ids:fileIds,summary:{rules_only:!!result.rulesOnly,rule_exceptions:resolvedRuleExceptions.length,worker_version:'1.2.3',exact_unique_tolerance_sec:600,pm_master_account_guard:true}},exceptions,files:parseResults,quality_errors:[]},pairedItem:{item:0}}];`;

const cred = { supabaseApi: { id: "dGndiinLb7AKnjIu", name: "Supabase account" } };
const http = (id, name, position, parameters) => ({ parameters, id, name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position, credentials: cred });
const driveCred = { googleDriveOAuth2Api: { id: "wYcR0wVZktx3BmP0", name: "Google Drive account" } };
const driveHttp = (id, name, position, parameters) => ({
  parameters,
  id,
  name,
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position,
  credentials: driveCred,
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 1000,
  onError: "continueRegularOutput",
});

const nodes = [
  { parameters: { rule: { interval: [{ field: "minutes", minutesInterval: 10 }] } }, id: "schedule", name: "ทุก 10 นาที", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [-1040, 80] },
  { parameters: {}, id: "manual", name: "ทดสอบด้วยมือ", type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-1040, 240] },
  http("queue", "Supabase: ตรวจไฟล์และจัดคิว", [-820, 160], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/queue_due_daily_recon_jobs", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ p_from: DateTime.now().setZone('Asia/Bangkok').startOf('month').toISODate(), p_to: DateTime.now().setZone('Asia/Bangkok').plus({ days: 1 }).toISODate() }) }}", options: { response: { response: {} } },
  }),
  { parameters: { jsCode: "return [{json:{started_at:new Date().toISOString()}}];" }, id: "single-cycle", name: "รวมเป็นหนึ่งรอบ", type: "n8n-nodes-base.code", typeVersion: 2, position: [-600, 160] },
  http("claim", "Supabase: จองหนึ่งงาน", [-380, 160], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/claim_daily_recon_jobs", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ p_worker: 'n8n-cloud-worker', p_limit: 1 }) }}", options: { response: { response: {} } },
  }),
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "has-job", leftValue: "={{ !!$json.id }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-job", name: "มีงานในคิว?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [-160, 160] },
  http("files", "Supabase: อ่านรายการไฟล์ของวัน", [300, 220], {
    url: "={{ $vars.SUPABASE_URL }}/rest/v1/mail_batches?business_date=eq.{{ $json.business_date }}&select=id,company,source_files(id,file_name,storage_path,kind,company,parsed,checksum,size_bytes)", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi", options: { response: { response: {} } },
  }),
  { parameters: { jsCode: "const job=$('Supabase: จองหนึ่งงาน').first().json; const out=[]; const reconKinds=new Set(['stm_pdf','pm_statement','bo_main','manual_credit','manual_payment','manual_bonus','comm_req','credit_out']); for(const b of $input.all().map(x=>x.json)){for(const f of (b.source_files||[])){const company=String(f.company||b.company||'').toUpperCase(); const ext=String(f.file_name||'').split('.').pop().toLowerCase(); if(company===String(job.company||'').toUpperCase()&&['xlsx','xlsm','xls','csv','pdf'].includes(ext)&&reconKinds.has(f.kind)) out.push({json:{job,file:{...f,ext}},pairedItem:{item:0}});}} if(!out.length) throw new Error('ไม่พบไฟล์กระทบยอดที่รองรับสำหรับ '+job.business_date+' '+job.company); return out;" }, id: "filter-files", name: "เลือกไฟล์ของบริษัท", type: "n8n-nodes-base.code", typeVersion: 2, position: [520, 220] },
  { parameters: { batchSize: 1, options: {} }, id: "file-loop", name: "วนทีละไฟล์", type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [740, 220] },
  http("download", "ดาวน์โหลดไฟล์จาก Storage", [980, 340], {
    url: "={{ $vars.SUPABASE_URL }}/storage/v1/object/audit-files/{{ $json.file.storage_path }}", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    options: { response: { response: { responseFormat: "file", outputPropertyName: "data" } }, timeout: 120000 },
  }),
  { parameters: { jsCode: "const item=$input.first(); const meta=$('วนทีละไฟล์').item.json; const binary={...(item.binary||{})}; if(!binary.data) throw new Error('ไม่พบข้อมูลไฟล์ '+meta.file.file_name); binary.data={...binary.data,fileName:meta.file.file_name,fileExtension:meta.file.ext}; return [{json:item.json,binary,pairedItem:{item:0}}];" }, id: "restore-original-file-name", name: "คืนชื่อไฟล์ต้นฉบับ", type: "n8n-nodes-base.code", typeVersion: 2, position: [1090, 340] },
  { parameters: { conditions: { options: { caseSensitive: false, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "is-pdf", leftValue: "={{ $('วนทีละไฟล์').item.json.file.ext }}", rightValue: "pdf", operator: { type: "string", operation: "equals" } }], combinator: "and" }, options: {} }, id: "if-pdf", name: "เป็น PDF?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1200, 340] },
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "is-excel", leftValue: "={{ ['xlsx','xlsm','xls'].includes($('วนทีละไฟล์').item.json.file.ext) }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-excel", name: "เป็น Excel?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1420, 440] },
  { parameters: { operation: "pdf", binaryPropertyName: "data", options: {} }, id: "extract-pdf", name: "อ่าน PDF โดยตรง", type: "n8n-nodes-base.extractFromFile", typeVersion: 1.1, position: [1420, 220], onError: "continueRegularOutput" },
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "has-pdf-text", leftValue: "={{ String($json.text ?? $json.data ?? '').trim().length >= 40 }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-pdf-text", name: "PDF มีข้อความ?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1640, 220] },
  { parameters: { jsCode: "const text=String($json.text??$json.data??'').trim(); return [{json:{text,ocr_used:false,ocr_provider:'native_pdf',ocr_confidence:null,ocr_page_count:Number($json.numpages||0)||null},pairedItem:{item:0}}];" }, id: "format-native-pdf", name: "จัดผล PDF โดยตรง", type: "n8n-nodes-base.code", typeVersion: 2, position: [1860, 180] },
  { parameters: { jsCode: "const src=$('คืนชื่อไฟล์ต้นฉบับ').item; if(!src.binary||!src.binary.data) throw new Error('ไม่พบไฟล์ PDF ต้นฉบับสำหรับ OCR'); return [{json:{},binary:src.binary,pairedItem:{item:0}}];" }, id: "restore-pdf-binary", name: "เตรียม PDF สำหรับ OCR", type: "n8n-nodes-base.code", typeVersion: 2, position: [1860, 280] },
  driveHttp("google-drive-ocr-upload", "Google Drive OCR: แปลง PDF", [2080, 280], {
    method: "POST", url: "https://www.googleapis.com/upload/drive/v2/files", authentication: "predefinedCredentialType", nodeCredentialType: "googleDriveOAuth2Api",
    sendQuery: true, queryParameters: { parameters: [{ name: "uploadType", value: "media" }, { name: "convert", value: "true" }, { name: "ocr", value: "true" }, { name: "ocrLanguage", value: "th" }] },
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/pdf" }] }, sendBody: true, contentType: "binaryData", inputDataFieldName: "data",
    options: { timeout: 180000, response: { response: { responseFormat: "json" } } },
  }),
  driveHttp("google-drive-ocr-export", "Google Drive OCR: อ่านข้อความ", [2300, 280], {
    url: "=https://www.googleapis.com/drive/v2/files/{{ $json.id }}/export", authentication: "predefinedCredentialType", nodeCredentialType: "googleDriveOAuth2Api",
    sendQuery: true, queryParameters: { parameters: [{ name: "mimeType", value: "text/plain" }] }, options: { timeout: 180000, response: { response: { responseFormat: "text" } } },
  }),
  { parameters: { jsCode: "const raw=$json.data??$json.body??$json; const text=typeof raw==='string'?raw:(raw&&typeof raw==='object'&&typeof raw.data==='string'?raw.data:JSON.stringify(raw??'')); const cleaned=String(text||'').replace(/\\u0000/g,'').trim(); return [{json:{text:cleaned,ocr_used:true,ocr_provider:'google_drive',ocr_confidence:cleaned?0.8:0,ocr_page_count:null},pairedItem:{item:0}}];" }, id: "format-ocr-result", name: "จัดผล OCR", type: "n8n-nodes-base.code", typeVersion: 2, position: [2520, 280] },
  { parameters: { operation: "xlsx", binaryPropertyName: "data", options: { headerRow: false, rawData: false, readAsString: true } }, id: "extract-xlsx", name: "อ่าน Excel", type: "n8n-nodes-base.extractFromFile", typeVersion: 1.1, position: [1640, 400], onError: "continueRegularOutput" },
  { parameters: { operation: "text", binaryPropertyName: "data", destinationKey: "data", options: { encoding: "utf8" } }, id: "extract-csv", name: "อ่าน CSV", type: "n8n-nodes-base.extractFromFile", typeVersion: 1.1, position: [1640, 520], onError: "continueRegularOutput" },
  { parameters: { jsCode: normalizeCode }, id: "normalize", name: "แปลงรายการเป็นมาตรฐาน", type: "n8n-nodes-base.code", typeVersion: 2, position: [1880, 340] },
  { parameters: { jsCode: reconcileCode }, id: "reconcile", name: "กระทบยอดและสร้าง Exception", type: "n8n-nodes-base.code", typeVersion: 2, position: [980, 80] },
  http("record-parse-results", "Supabase: บันทึกผลอ่านไฟล์", [1200, 80], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/record_source_file_parse_results", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ (()=>{const x=$('กระทบยอดและสร้าง Exception').first().json;return JSON.stringify({p_job_id:x.job.id,p_results:x.files});})() }}", options: { response: { response: {} } },
  }),
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, conditions: [{ id: "quality-ok", leftValue: "={{ (()=>{const x=$('กระทบยอดและสร้าง Exception').first().json;return x.quality_errors.length === 0 && Array.isArray(x.job.missing_groups) && x.job.missing_groups.length === 0;})() }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-quality", name: "ไฟล์ผ่าน Quality Gate?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1420, 80] },
  http("insert-run", "Supabase: สร้างผลการรัน", [1640, 20], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/recon_runs", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=representation" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ (()=>{const x=$('กระทบยอดและสร้าง Exception').first().json;return JSON.stringify({ business_date:x.job.business_date,company:x.job.company,run_by:x.result.run_by,elapsed_ms:x.result.elapsed_ms,stm_count:x.result.stm_count,bo_count:x.result.bo_count,matched:x.result.matched,match_rate:x.result.match_rate,exception_count:x.exceptions.length,no_stm_count:x.result.no_stm_count,file_ids:x.result.file_ids,summary:{...x.result.summary,worker:'n8n-cloud',job_id:x.job.id} });})() }}", options: { response: { response: {} } },
  }),
  { parameters: { jsCode: "const source=$('กระทบยอดและสร้าง Exception').first().json; const run=$json; const runId=run.id; if(!runId) throw new Error('Supabase ไม่คืน run id'); const exception_rows=source.exceptions.map(e=>({...e,run_id:runId})); return [{json:{...source,run_id:runId,exception_rows},pairedItem:{item:0}}];" }, id: "prepare-save", name: "เตรียมบันทึก Exception", type: "n8n-nodes-base.code", typeVersion: 2, position: [1860, 20] },
  { ...http("insert-exceptions", "Supabase: บันทึก Exception", [2080, 20], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/exceptions", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=minimal" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify($json.exception_rows) }}", options: { response: { response: {} } },
  }), alwaysOutputData: true },
  http("finish", "Supabase: ปิดงานสำเร็จ", [2300, 20], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/finish_daily_recon_job", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ (()=>{const x=$('เตรียมบันทึก Exception').first().json;return JSON.stringify({p_job_id:x.job.id,p_run_id:x.run_id});})() }}", options: { response: { response: {} } },
  }),
  http("quality-stop", "บันทึกว่าอ่านแล้วและรอไฟล์", [1640, 160], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/finish_daily_recon_parse_only", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ (()=>{const x=$('กระทบยอดและสร้าง Exception').first().json;return JSON.stringify({p_job_id:x.job.id});})() }}", options: { response: { response: {} } },
  }),
  { parameters: { jsCode: "return [{json:{finished_at:new Date().toISOString(),message:'ประมวลผลรอบนี้เสร็จแล้ว'}}];" }, id: "summary", name: "จบรอบ Worker", type: "n8n-nodes-base.code", typeVersion: 2, position: [-140, 40] },
];

const connections = {
  "ทุก 10 นาที": { main: [[{ node: "Supabase: ตรวจไฟล์และจัดคิว", type: "main", index: 0 }]] },
  "ทดสอบด้วยมือ": { main: [[{ node: "Supabase: ตรวจไฟล์และจัดคิว", type: "main", index: 0 }]] },
  "Supabase: ตรวจไฟล์และจัดคิว": { main: [[{ node: "รวมเป็นหนึ่งรอบ", type: "main", index: 0 }]] },
  "รวมเป็นหนึ่งรอบ": { main: [[{ node: "Supabase: จองหนึ่งงาน", type: "main", index: 0 }]] },
  "Supabase: จองหนึ่งงาน": { main: [[{ node: "มีงานในคิว?", type: "main", index: 0 }]] },
  "มีงานในคิว?": { main: [[{ node: "Supabase: อ่านรายการไฟล์ของวัน", type: "main", index: 0 }], [{ node: "จบรอบ Worker", type: "main", index: 0 }]] },
  "Supabase: อ่านรายการไฟล์ของวัน": { main: [[{ node: "เลือกไฟล์ของบริษัท", type: "main", index: 0 }]] },
  "เลือกไฟล์ของบริษัท": { main: [[{ node: "วนทีละไฟล์", type: "main", index: 0 }]] },
  "วนทีละไฟล์": { main: [[{ node: "กระทบยอดและสร้าง Exception", type: "main", index: 0 }], [{ node: "ดาวน์โหลดไฟล์จาก Storage", type: "main", index: 0 }]] },
  "ดาวน์โหลดไฟล์จาก Storage": { main: [[{ node: "คืนชื่อไฟล์ต้นฉบับ", type: "main", index: 0 }]] },
  "คืนชื่อไฟล์ต้นฉบับ": { main: [[{ node: "เป็น PDF?", type: "main", index: 0 }]] },
  "เป็น PDF?": { main: [[{ node: "อ่าน PDF โดยตรง", type: "main", index: 0 }], [{ node: "เป็น Excel?", type: "main", index: 0 }]] },
  "เป็น Excel?": { main: [[{ node: "อ่าน Excel", type: "main", index: 0 }], [{ node: "อ่าน CSV", type: "main", index: 0 }]] },
  "อ่าน PDF โดยตรง": { main: [[{ node: "PDF มีข้อความ?", type: "main", index: 0 }]] },
  "PDF มีข้อความ?": { main: [[{ node: "จัดผล PDF โดยตรง", type: "main", index: 0 }], [{ node: "เตรียม PDF สำหรับ OCR", type: "main", index: 0 }]] },
  "จัดผล PDF โดยตรง": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "เตรียม PDF สำหรับ OCR": { main: [[{ node: "Google Drive OCR: แปลง PDF", type: "main", index: 0 }]] },
  "Google Drive OCR: แปลง PDF": { main: [[{ node: "Google Drive OCR: อ่านข้อความ", type: "main", index: 0 }]] },
  "Google Drive OCR: อ่านข้อความ": { main: [[{ node: "จัดผล OCR", type: "main", index: 0 }]] },
  "จัดผล OCR": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "อ่าน Excel": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "อ่าน CSV": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "แปลงรายการเป็นมาตรฐาน": { main: [[{ node: "วนทีละไฟล์", type: "main", index: 0 }]] },
  "กระทบยอดและสร้าง Exception": { main: [[{ node: "Supabase: บันทึกผลอ่านไฟล์", type: "main", index: 0 }]] },
  "Supabase: บันทึกผลอ่านไฟล์": { main: [[{ node: "ไฟล์ผ่าน Quality Gate?", type: "main", index: 0 }]] },
  "ไฟล์ผ่าน Quality Gate?": { main: [[{ node: "Supabase: สร้างผลการรัน", type: "main", index: 0 }], [{ node: "บันทึกว่าอ่านแล้วและรอไฟล์", type: "main", index: 0 }]] },
  "Supabase: สร้างผลการรัน": { main: [[{ node: "เตรียมบันทึก Exception", type: "main", index: 0 }]] },
  "เตรียมบันทึก Exception": { main: [[{ node: "Supabase: บันทึก Exception", type: "main", index: 0 }]] },
  "Supabase: บันทึก Exception": { main: [[{ node: "Supabase: ปิดงานสำเร็จ", type: "main", index: 0 }]] },
  "Supabase: ปิดงานสำเร็จ": { main: [[{ node: "จบรอบ Worker", type: "main", index: 0 }]] },
  "บันทึกว่าอ่านแล้วและรอไฟล์": { main: [[{ node: "จบรอบ Worker", type: "main", index: 0 }]] },
};

const workflow = { name: "Audit - Headless Reconciliation Worker - Hybrid PDF", nodes, connections, settings: { executionOrder: "v1", binaryMode: "separate", saveManualExecutions: true }, pinData: {}, active: false };
await writeFile(path.join(root, "n8n/audit-headless-worker.json"), JSON.stringify(workflow, null, 2) + "\n");
console.log(`built n8n/audit-headless-worker.json (${workflow.nodes.length} nodes)`);
