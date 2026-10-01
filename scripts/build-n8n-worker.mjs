import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFile(path.join(root, name), "utf8");
const WORKER_VERSION = "1.9.68-sys123-bank-time-manual";
const PARSER_VERSION = "1.9.68-sys123-bank-time-manual";
const [formats, rules, registry, engine, pdfOriginal, tmnVisualReview] = await Promise.all([
  read("formats.js"),
  read("rules.js"),
  read("registry.js"),
  read("engine.js"),
  read("pdf-stm.js"),
  read("tmn-visual-review.js"),
]);

const pdf = pdfOriginal;

const runtime = [formats, rules, registry, engine, pdf, tmnVisualReview].join("\n\n");
const settings = `({toleranceDeposit:90,toleranceWithdraw:180,exactUniqueTolerance:600,providerNearTimeTolerance:600,sys123DuplicateTimeTolerance:3600,sys123FallbackTimeTolerance:3600,diffAlert:1,rules:{crossDay:true,pmSuccessOnly:true,filterCarryForward:true}})`;

const normalizeCode = `${runtime}
const meta=$('วนทีละไฟล์').item.json;
const file=meta.file, job=meta.job, ext=file.ext;
const input=$input.all();
let norm, rawRows=[], extractedText='';
let parseError=null;
let acceptedEmptyPm=false;
const storedOcr=Array.isArray(file.source_file_ocr)?file.source_file_ocr[0]:file.source_file_ocr;
const usedManualTmnReview=ext==='pdf'&&storedOcr?.provider==='tmn_visual_review_v1';
const upstreamError=input.map(x=>x&&x.json&&x.json.error).find(Boolean);
if(upstreamError&&!usedManualTmnReview){
  parseError='อ่านไฟล์ไม่สำเร็จ ('+file.file_name+'): '+String(upstreamError.message||upstreamError.description||upstreamError).slice(0,500);
}
try{
  if(usedManualTmnReview){
    norm=TmnVisualReview.normalize(storedOcr,file,job);
  }else if(parseError){
    norm={format:{source:'unknown',realCode:null},records:[],aux:[],warnings:[],dropped:{}};
  }else if(ext==='pdf'||ext==='docx'){
    extractedText=input.map(x=>String((x&&x.json&&x.json.text)||'').trim()).filter(Boolean).join('\\n---OCR_IMAGE---\\n');
    norm=PdfStm.parseStructuredOcr(file.file_name,storedOcr,extractedText,job.business_date)
      || await PdfStm.parseText(file.file_name,extractedText,job.business_date);
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
const isCandidateRow=r=>!!(r&&(r.ocrDateCandidateOnly||r.ktbNextDayCandidateOnly));
const usableRows=(norm.records||[]).filter(r=>!isCandidateRow(r)).length+(norm.aux||[]).length;
const candidateRows=(norm.records||[]).filter(isCandidateRow).length;
const attemptedRows=usableRows+candidateRows;
const priorRowCount=Math.max(0,Number(file.row_count||0));
const ocrMeta=(input[0]&&input[0].json)||{};
const ocrInputCount=Math.max(0,Number(ocrMeta.ocr_input_count||0));
const ocrPageCount=Math.max(0,Number(ocrMeta.ocr_page_count||0));
const ocrErrors=Math.max(0,Number(ocrMeta.ocr_errors||0));
const nonEmptyRows=rawRows.filter(r=>Array.isArray(r)&&r.some(v=>String(v??'').trim()!=='')).length;
// XB uses AT/AZ/CP/M for every company and LOCALPAY for 3XB. QPAY files may
// arrive before admin activation; record them as inactive, not corrupt.
const outsideProviderReason='Provider นอกขอบเขต Audit เครือ XB (ใช้ AT/AZ/CP/M และ LOCALPAY เฉพาะ 3XB)';
const inactiveQpayReason='QPAY ยังไม่เปิดใช้โดยแอดมิน จึงไม่นำมากระทบยอด';
const dropEntries=Object.entries(norm.dropped||{}).filter(([,count])=>Number(count||0)>0);
const outsideProviderRows=Number((norm.dropped||{})[outsideProviderReason]||0);
const inactiveQpayRows=Number((norm.dropped||{})[inactiveQpayReason]||0);
const intentionallyInactiveRows=outsideProviderRows+inactiveQpayRows;
const acceptedOutOfScopePm=file.kind==='pm_statement'&&detectedSource==='stm'&&usableRows===0&&nonEmptyRows>0&&intentionallyInactiveRows>0&&dropEntries.every(([reason])=>reason===outsideProviderReason||reason===inactiveQpayReason);
// A recognized PM workbook whose body rows are all explicitly non-successful
// (Fail/Failed/Cancelled/etc.) is a readable control file with zero eligible
// reconciliation rows.  Treating it as a corrupt file blocks the whole
// company-day even though the parser has positively classified every row.
// This acceptance changes only file quality; it never creates a transaction
// and therefore cannot close a BO row from a failed provider entry.
const nonSuccessPmRows=dropEntries
  .filter(([reason])=>String(reason).startsWith('รายการไม่สำเร็จ (PM:'))
  .reduce((sum,[,count])=>sum+Number(count||0),0);
const acceptedNonSuccessPm=file.kind==='pm_statement'&&detectedSource==='stm'&&usableRows===0&&nonSuccessPmRows>0&&dropEntries.every(([reason])=>String(reason).startsWith('รายการไม่สำเร็จ (PM:'));
const outsideDayPmRows=Number((norm.dropped||{})['วันที่ไม่ตรงกับวันที่ตรวจ']||0);
// A correctly structured PM export can be attached to the next operating-day
// mail even though every eligible transaction belongs to the adjacent day.
// Treat it as readable zero activity for this job, but only when every dropped
// row is either outside the job date or a non-success PM status.  Parser errors
// and malformed rows remain blocking quality errors.
const acceptedOutsideDayPm=file.kind==='pm_statement'&&detectedSource==='stm'&&norm.format.realCode==='pm_provider'&&usableRows===0&&outsideDayPmRows>0&&dropEntries.every(([reason])=>{
  const value=String(reason);
  return value==='วันที่ไม่ตรงกับวันที่ตรวจ'||value.startsWith('รายการไม่สำเร็จ (PM:');
});
// Provider exports are often generated from a fixed Excel template even when
// the provider had no activity.  Accept zero rows only when the parser positively
// identified the PM-provider header and there are no non-empty rows below it.
// A workbook with an unreadable/dropped body still fails the quality gate.
const pmHeaderIdx=Number.isInteger(Number(norm.format.headerIdx))?Number(norm.format.headerIdx):-1;
const pmBodyRows=pmHeaderIdx>=0?rawRows.slice(pmHeaderIdx+1).filter(r=>Array.isArray(r)&&r.some(v=>String(v??'').trim()!=='')):[];
const acceptedEmptyStructuredPm=file.kind==='pm_statement'&&detectedSource==='stm'&&norm.format.realCode==='pm_provider'&&pmHeaderIdx>=0&&pmBodyRows.length===0&&usableRows===0;
// BO is the daily source of truth for which accounts were actually used.
// A header-only BO workbook is therefore valid evidence for a zero-activity day,
// not a parser failure.  Keep rejecting a truly empty/corrupt workbook.
const boHeader=Formats.detect(rawRows);
const boBodyRows=boHeader?rawRows.slice(boHeader.headerIdx+1).filter(r=>Array.isArray(r)&&r.some(v=>String(v??'').trim()!=='')):[];
const acceptedEmptyBo=file.kind==='bo_main'&&detectedSource==='bo'&&boHeader?.spec.side==='bo'&&boBodyRows.length===0&&usableRows===0;
// A bank statement can legitimately contain its account/header details but no
// transaction rows for the day.  Accept it as zero activity only when OCR/native
// extraction returned enough statement-like evidence; blank/corrupt PDFs still fail.
const pdfEvidence=extractedText.replace(/\\s+/g,' ').trim();
// A statement heading alone cannot prove zero activity: extraction may have
// lost the transaction table. Require an explicit no-activity declaration.
const explicitNoActivity=/(ไม่มีรายการเคลื่อนไหว|ไม่มีรายการธุรกรรม|ไม่พบรายการเคลื่อนไหว|no transactions|no activity)/i.test(pdfEvidence);
const hasTransactionTimestamp=/\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\s+\\d{1,2}:\\d{2}/.test(pdfEvidence);
const acceptedEmptyStmPdf=file.kind==='stm_pdf'&&usableRows===0&&pdfEvidence.length>=40&&explicitNoActivity&&!hasTransactionTimestamp;
// A statement from an adjacent day can be attached to the current batch.  If
// the PDF parser positively read transaction rows and every row was rejected
// only because its date is outside this job, record the file as readable zero
// activity.  Do not use this exception when OCR/PDF quality is incomplete or
// when any row has another parse/drop reason.
const acceptedOutsideDayStmPdf=file.kind==='stm_pdf'&&detectedSource==='stm'&&usableRows===0&&outsideDayPmRows>0&&pdfEvidence.length>=40&&hasTransactionTimestamp&&norm.quality?.complete!==false&&dropEntries.every(([reason])=>String(reason)==='วันที่ไม่ตรงกับวันที่ตรวจ');
// A TMN Word screenshot may contain only rows whose calendar heading was
// flattened from an adjacent image. They are not usable transactions yet, but
// the file is readable evidence. Engine will promote only BO-confirmed 1:1
// candidates; an unmatched candidate never creates a transaction or case.
const acceptedCandidateOnlyStm=file.kind==='stm_pdf'&&detectedSource==='stm'&&usableRows===0&&candidateRows>0&&norm.quality?.complete!==false;
// Some parsers reject a valid header-only workbook before the generic quality
// checks below run.  A BO/statement with clear evidence but zero transactions is
// still a valid daily control file, so clear semantic "no usable rows" errors.
// Never clear transport, download, or corrupt-file errors.
const fatalReadError=/^อ่านไฟล์ไม่สำเร็จ|^ไม่พบข้อความใน PDF|^ไฟล์ตารางว่าง/.test(String(parseError||''));
if(acceptedEmptyBo&&!fatalReadError) parseError=null;
if(acceptedEmptyStmPdf&&!fatalReadError) parseError=null;
if(acceptedOutsideDayStmPdf&&!fatalReadError) parseError=null;
if(acceptedEmptyStructuredPm&&!fatalReadError) parseError=null;
if(!parseError&&(ext==='pdf'||ext==='docx')&&!pdfEvidence&&!usedManualTmnReview) parseError='ไม่พบข้อความใน Statement (อาจเป็นไฟล์สแกนหรือไฟล์เสีย)';
if(!parseError&&ext==='csv'&&nonEmptyRows===0&&!acceptedEmptyPm&&Number(file.size_bytes||0)>16) parseError='ดาวน์โหลดไฟล์แล้ว แต่โหนดอ่าน CSV ไม่คืนข้อมูล (ตรวจ encoding หรือขั้นตอนส่งต่อใน n8n)';
if(!parseError&&ext!=='pdf'&&ext!=='docx'&&nonEmptyRows===0&&!acceptedEmptyPm) parseError='ไฟล์ตารางว่างหรือไม่มีหัวตาราง';
if(!parseError&&ext!=='pdf'&&ext!=='docx'&&detectedSource==='unknown'&&!acceptedEmptyBo) parseError='ไม่พบหัวตารางที่รองรับภายใน 30 แถวแรก';
if(!parseError&&usableRows===0&&!acceptedEmptyPm&&!acceptedEmptyStructuredPm&&!acceptedOutsideDayPm&&!acceptedEmptyBo&&!acceptedEmptyStmPdf&&!acceptedOutsideDayStmPdf&&!acceptedCandidateOnlyStm&&!acceptedOutOfScopePm&&!acceptedNonSuccessPm){
  const outsideDay=Number((norm.dropped||{})['วันที่ไม่ตรงกับวันที่ตรวจ']||0);
  const zeroAmountRows=Number((norm.dropped||{})['ยอดเงินเป็นศูนย์']||0);
  parseError=(ext==='pdf'||ext==='docx')&&(norm.warnings||[]).length ? norm.warnings.join(' · ')
    : file.kind==='pm_statement'&&zeroAmountRows>0 ? 'ได้รับไฟล์ PM และอ่านตารางแล้ว แต่พบรายการยอดเงินเป็นศูนย์ '+zeroAmountRows+' รายการที่นำไปจับคู่ไม่ได้ — ตรวจยอดในไฟล์ต้นฉบับหรือขอฉบับแก้ไข (ไม่ใช่ไฟล์หาย และยังไม่ยืนยันว่าไม่มีธุรกรรม)'
    : outsideDay>0 ? 'ได้รับไฟล์และอ่านได้แล้ว แต่มี '+outsideDay+' รายการคนละวันที่กับงาน '+job.business_date+' — ตรวจวันที่ในไฟล์ก่อนย้ายเข้ารอบที่ถูกต้อง (ยังไม่ถือว่าขาดไฟล์หรือไม่มียอด)'
    : 'อ่านหัวตารางได้ แต่ไม่พบรายการที่นำไปกระทบยอดได้';
}
if(!parseError&&(ext==='pdf'||ext==='docx')&&norm.quality&&!norm.quality.complete) parseError='Statement อ่านได้บางส่วน: มี '+norm.quality.unreadRows.length+' บรรทัดที่อ่านไม่ได้ และ '+norm.quality.invalidRows.length+' รายการที่ต้องยืนยัน (ยังไม่นำไปกระทบยอด)';
// TMN statements arrive as Word files containing many screenshots. Google
// Drive OCR can occasionally return only a subset without failing the entire
// n8n node. Never let that partial attempt replace a prior accepted parse.
if(!parseError&&ext==='docx'&&(ocrErrors>0||(ocrInputCount>0&&ocrPageCount<ocrInputCount))){
  parseError='OCR Word อ่านภาพไม่ครบ: ได้ข้อความ '+ocrPageCount+' จาก '+ocrInputCount+' ภาพ และพบข้อผิดพลาด '+ocrErrors+' รายการ — เก็บผลรอบก่อนและรอรันใหม่';
}
if(!parseError&&ext==='docx'&&priorRowCount>0&&attemptedRows<priorRowCount){
  parseError='OCR Word อ่านรายการลดลงจากรอบก่อน: รอบนี้ '+attemptedRows+' รายการ รอบก่อน '+priorRowCount+' รายการ — ไม่ยอมให้ผลที่ขาดทับข้อมูลเดิม';
}
// DOCX attachments are immutable evidence. Once a run has observed a higher
// usable-row count, a later OCR attempt (successful or not) must never lower
// that stored completeness baseline.
const reportedRowCount=ext==='docx'&&priorRowCount>0
  ? (parseError?priorRowCount:Math.max(priorRowCount,usableRows))
  : usableRows;
let tag=Registry.matchFile(file.file_name).match;
const fallbackCompany=job.company||file.company||'';
const fallbackAccount=(tag&&tag.account)||'';
const fallbackBank=(tag&&tag.bank)||'';
const kindSource={stm_pdf:'stm',pm_statement:'stm',bo_main:'bo',manual_credit:'bo',manual_payment:'bo',manual_bonus:'aux',comm_req:'aux',credit_out:'aux'};
if(!parseError&&kindSource[file.kind]) norm.format.source=kindSource[file.kind];
if(acceptedEmptyBo) norm.warnings=[...(norm.warnings||[]),'BO ไม่มีรายการธุรกรรมที่ใช้จับคู่ (0 รายการ)'];
if(acceptedEmptyStructuredPm) norm.warnings=[...(norm.warnings||[]),'PM Provider เป็นแม่แบบที่อ่านหัวตารางได้และไม่มีรายการธุรกรรม (0 รายการ)'];
if(acceptedOutsideDayPm) norm.warnings=[...(norm.warnings||[]),'อ่านไฟล์ PM สำเร็จ แต่ไม่นำ '+outsideDayPmRows+' รายการคนละวันที่มาปนกับรอบ '+job.business_date];
if(acceptedEmptyStmPdf) norm.warnings=[...(norm.warnings||[]),'Statement ไม่มีรายการธุรกรรม (0 รายการ)'];
if(acceptedOutsideDayStmPdf) norm.warnings=[...(norm.warnings||[]),'อ่าน Statement สำเร็จ แต่ไม่นำ '+outsideDayPmRows+' รายการคนละวันที่มาปนกับรอบ '+job.business_date];
if(acceptedOutOfScopePm) norm.warnings=[...(norm.warnings||[]),'ข้ามไฟล์ PM '+intentionallyInactiveRows+' รายการ: Provider ยังไม่เปิดใช้สำหรับบริษัทนี้'];
if(acceptedNonSuccessPm) norm.warnings=[...(norm.warnings||[]),'อ่านไฟล์ PM สำเร็จ แต่ไม่นำรายการสถานะไม่สำเร็จ '+nonSuccessPmRows+' รายการมากระทบยอด'];
for(const r of (norm.records||[])){
  const pmKey=Formats.canonicalPm(r.channel||r.account||'');
  if(pmKey){r.account=pmKey;r.channel=pmKey;}
  if((!r.account||r.account==='UNKNOWN')&&fallbackAccount) r.account=Registry.normalizeAccount(fallbackAccount,fallbackBank||r.bank);
  else if(r.account&&/\\d/.test(String(r.account))) r.account=Registry.normalizeAccount(r.account,fallbackBank||r.bank);
  // The account number is the authoritative statement identity. Counterparty
  // text such as KTB เอกพล inside KB กิตติ must not create a phantom account.
  const registered=r.account&&/\d/.test(String(r.account))?Registry.byAccount(r.account):null;
  if(registered&&registered.source==='bank'){
    r.account=Registry.normalizeAccount(registered.account,registered.bank);
    r.bank=registered.bank;
    r.channel=registered.bank;
    r.statementHolder=registered.name||'';
  }else if(!r.bank&&fallbackBank) r.bank=fallbackBank;
  r.subco=fallbackCompany;
  r.company=fallbackCompany;
  // Some BO filenames omit the company token. Re-apply the System 123 bank
  // timestamp policy after the authoritative job company is assigned.
  if(r.formatCode==='bo_main'&&['AT4','FR8','SK8'].includes(String(fallbackCompany).toUpperCase())
      && !r.isPmChannel&&!['BBL','GSB'].includes(String(r.channel||r.bank||'').toUpperCase())
      && r.bankDate&&Number.isFinite(Number(r.bankSec))){
    r.date=r.bankDate;r.sec=Number(r.bankSec);r.matchTimeColumn='วันที่ธนาคาร';
  }
}
for(const r of (norm.aux||[])){ if(!r.company) r.company=fallbackCompany; r.subco=fallbackCompany; }
return [{json:{job,file,format:norm.format,detected_source:detectedSource,records:norm.records||[],aux:norm.aux||[],parsed:!parseError,row_count:reportedRowCount,attempted_row_count:attemptedRows,candidate_row_count:candidateRows,ocr_input_count:ocrInputCount,ocr_page_count:ocrPageCount,ocr_errors:ocrErrors,extracted_row_count:usedManualTmnReview?attemptedRows:(ext==='pdf'||ext==='docx')?extractedText.split(/\\r?\\n/).filter(s=>s.trim()).length:nonEmptyRows,parse_error:parseError,pdf_quality:norm.quality||null,warnings:norm.warnings||[],dropped:norm.dropped||{},parser_version:'${PARSER_VERSION}'},pairedItem:{item:0}}];`;

const reconcileCode = `${formats}\n\n${rules}\n\n${registry}\n\n${engine}
const files=$input.all().map(x=>x.json).filter(x=>x&&x.file);
if(!files.length) throw new Error('ไม่พบไฟล์ที่อ่านได้ในงานนี้');
const job=files[0].job;
const parserVersionErrors=files.filter(f=>f.parser_version!=='${PARSER_VERSION}').map(f=>({id:f.file.id,file_name:f.file.file_name,parse_error:'เวอร์ชันตัวอ่านไฟล์ไม่ตรงกับ Worker: ได้ '+String(f.parser_version||'ไม่ระบุ')+' ต้องเป็น ${PARSER_VERSION}',row_count:f.row_count||0}));
const qualityErrors=files.filter(f=>f.parse_error).map(f=>({id:f.file.id,file_name:f.file.file_name,parse_error:f.parse_error,row_count:f.row_count||0})).concat(parserVersionErrors);
const parseResults=files.map(f=>({id:f.file.id,file_name:f.file.file_name,parsed:!f.parse_error&&f.parser_version==='${PARSER_VERSION}',row_count:f.row_count||0,attempted_row_count:f.attempted_row_count||0,candidate_row_count:f.candidate_row_count||0,ocr_input_count:f.ocr_input_count||0,ocr_page_count:f.ocr_page_count||0,ocr_errors:f.ocr_errors||0,parse_error:f.parse_error||null,parser_version:f.parser_version||null,dropped:f.dropped||{}}));
if(qualityErrors.length) return [{json:{job,result:null,exceptions:[],files:parseResults,quality_errors:qualityErrors},pairedItem:{item:0}}];
const stm=[],bo=[];
for(const f of files){
  if(f.format&&f.format.source==='aux') continue;
  const records=(f.records||[]).map(r=>({...r,source_file:f.file.file_name,source_file_id:f.file.id,source_checksum:f.file.checksum||null}));
  if(f.format&&f.format.source==='bo') bo.push(...records);
  else stm.push(...records);
}
// เมลอาจแนบไฟล์ STM/PM ชุดเดิมซ้ำต่างเวลา หรือส่งเนื้อหาเดียวกันมาโดยเปลี่ยนชื่อ
// Provider ผิด (เช่น AZPAY ถูกตั้งชื่อเป็น MYPAY). ถ้าชุดธุรกรรมทั้งไฟล์ตรงกัน
// ทุก tuple ให้เก็บเพียงฉบับแรก ไม่หักรายการจริงที่บังเอิญยอด/เวลาเท่ากันบางแถว.
const sourceGroups=new Map();
for(const row of stm){
  if(!row.source_file_id) continue;
  const group=sourceGroups.get(row.source_file_id)||[];
  group.push(row); sourceGroups.set(row.source_file_id,group);
}
const duplicateSourceFileIds=new Set(),sourceFingerprints=new Map();
for(const [fileId,rows] of sourceGroups){
  const tuples=rows.map(r=>[String(r.formatCode||''),String(r.date||''),Number(r.sec||0),String(r.direction||''),Number(r.amount||0),r.balance===null||r.balance===undefined?null:Number(r.balance),String(r.account||''),String(r.memberCode||r.username||''),String(r.transactionRef||r.ref||''),String(r.status||'')]);
  const fingerprint=JSON.stringify(tuples.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if(rows.length&&sourceFingerprints.has(fingerprint)) duplicateSourceFileIds.add(fileId);
  else if(rows.length) sourceFingerprints.set(fingerprint,fileId);
}
const duplicateSourceRowsRemoved=stm.filter(r=>duplicateSourceFileIds.has(r.source_file_id)).length;
if(duplicateSourceRowsRemoved){
  const unique=stm.filter(r=>!duplicateSourceFileIds.has(r.source_file_id));
  stm.length=0; stm.push(...unique);
}
if(bo.some(r=>r.formatCode)){const merged=Formats.merge(bo);bo.length=0;merged.sort((a,b)=>(a.sec||0)-(b.sec||0)).forEach(r=>bo.push(r));}
// COREPAY ฝากของ 7M บางไฟล์คงสถานะ pending ไว้ก่อน settlement. รายการเหล่านี้
// ใช้เป็นหลักฐานได้ก็ต่อเมื่อ BO ยืนยันครบ Ref + User + Amount แบบหนึ่งต่อหนึ่ง
// เท่านั้น; pending ที่ยังไม่มี BO ไม่ใช่ธุรกรรมสำเร็จและต้องไม่เพิ่ม denominator
// หรือเปิด missing_bo เทียม. เมื่อ BO มาภายหลัง การรันรอบใหม่จะรับแถวเดิมเข้าเอง.
const idText=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const refText=value=>String(value||'').trim().toLowerCase().replace(/\\s+/g,' ');
const pendingExact=(s,b)=>{
  if(!s||!b||String(s.account||'').toUpperCase()!=='COREPAY'||String(b.account||'').toUpperCase()!=='COREPAY') return false;
  if(s.direction!=='deposit'||b.direction!=='deposit'||Number(s.amount)!==Number(b.amount)) return false;
  const su=idText(s.memberCode),bu=idText(b.memberCode);
  if(!su||su!==bu) return false;
  const sr=refText(s.transactionRef||s.ref),hay=[b.ref,b.note,b.raw].map(refText).join(' | ');
  return !!sr&&hay.includes(sr);
};
const pendingRows=stm.filter(r=>String(r.subco||r.company||'').toUpperCase()==='UFABET7M'
  &&String(r.account||'').toUpperCase()==='COREPAY'&&r.direction==='deposit'
  &&String(r.status||'').trim().toLowerCase()==='pending');
const pendingCandidates=new Map(),pendingPeers=new Map();
for(const s of pendingRows){
  const rows=[];
  for(let i=0;i<bo.length;i++) if(pendingExact(s,bo[i])){rows.push(i);const peers=pendingPeers.get(i)||[];peers.push(s);pendingPeers.set(i,peers);}
  pendingCandidates.set(s,rows);
}
const confirmedPending=new Set(pendingRows.filter(s=>{
  const rows=pendingCandidates.get(s)||[];
  return rows.length===1&&(pendingPeers.get(rows[0])||[]).length===1;
}));
const sevenMUnconfirmedPendingRowsSuppressed=pendingRows.length-confirmedPending.size;
if(sevenMUnconfirmedPendingRowsSuppressed){
  const eligible=stm.filter(r=>!pendingRows.includes(r)||confirmedPending.has(r));
  stm.length=0;stm.push(...eligible);
}
const parsed=files.filter(f=>f.format&&(f.format.source==='bo'||f.format.source==='aux')).map(f=>({records:f.format.source==='bo'?(f.records||[]):[],aux:f.aux||[]}));
const biz=Rules.run(parsed,${settings});
const boFirstCoverage=(()=>{
  const clean=v=>String(v||'').trim().toUpperCase();
  const companyOf=r=>{const raw=clean(r&&(r.subco||r.company));if(raw==='3X')return'3XB';if(raw==='7M')return'UFABET7M';return raw||'ไม่ระบุบริษัท'};
  const systemOf=c=>['3XB','MR9','MC8','UR9','PS8'].includes(c)?'XXX':['FR8','AT4','SK8'].includes(c)?'123':c==='UFABET7M'?'7M':'ไม่ระบุระบบ';
  const dir=r=>r&&r.direction==='withdraw'?'withdraw':r&&r.direction==='deposit'?'deposit':'unknown';
  const ident=r=>{const raw=r&&(r.channel||r.account||r.bank)||'';const pm=Formats.canonicalPm?Formats.canonicalPm(raw):'';if(pm||(r&&r.isPmChannel))return{kind:'PM',id:pm||clean(raw),label:pm||clean(raw)};const account=String(r&&r.account||'').replace(/\\D/g,'');const bank=clean(r&&(r.bank||r.channel));return{kind:'STM',id:account||bank,label:[bank,account?'••'+account.slice(-4):''].filter(Boolean).join(' ')}};
  const collect=records=>{const map=new Map();for(const r of records||[]){const x=ident(r);if(!x.id||x.id==='UNKNOWN')continue;const company=companyOf(r),system=systemOf(company),d=dir(r),key=system+'|'+company+'|'+x.kind+'|'+x.id+'|'+d,item=map.get(key)||{key,system,company,kind:x.kind,identity:x.id,label:x.label,direction:d,rows:0,amount:0,source_files:[],source_labels:[]};item.rows++;item.amount=Math.round((item.amount+Number(r.amount||0))*100)/100;const sourceFile=String(r.source_file||r.fileName||'').trim();if(sourceFile&&!item.source_files.includes(sourceFile))item.source_files.push(sourceFile);const sourceLabel=String(r.boIdentityRaw||'').trim();if(sourceLabel&&!item.source_labels.includes(sourceLabel))item.source_labels.push(sourceLabel);map.set(key,item)}return[...map.values()].sort((a,b)=>a.key.localeCompare(b.key))};
  const required=collect(bo),received=collect(stm),have=new Set(received.map(x=>x.key)),missing=required.filter(x=>!have.has(x.key));
  return{method:'BO_FIRST',registry_source:'https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',required,received,missing,complete:required.length>0&&missing.length===0};
})();
boFirstCoverage.parser_version='${PARSER_VERSION}';
boFirstCoverage.worker_version='${WORKER_VERSION}';
boFirstCoverage.source_parse=parseResults.map(f=>({id:f.id,file_name:f.file_name,row_count:f.row_count,candidate_row_count:f.candidate_row_count,parser_version:f.parser_version,dropped:f.dropped}));
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
const auditCompanies=new Set(['3XB','MC8','MR9','PS8','UR9','AT4','FR8','SK8']);
const auditCompany=String(job.company||'').trim().toUpperCase()==='3X'?'3XB':String(job.company||'').trim().toUpperCase();
const isInformationalAuditException=e=>auditCompanies.has(auditCompany)&&['large_amount','time_diff'].includes(String(e?.type||'').trim().toLowerCase().replace(/[\\s-]+/g,'_'));
// Rules and Engine inspect the same BO rows independently. Once Engine has
// matched a BO row, no Rules exception for that exact source row is still
// actionable (not only cross_day). Keeping it would create a green matched
// pair and an open BO-only case for the same transaction in one run.
const resolvedRuleExceptions=(biz.exceptions||[]).filter(e=>!isInformationalAuditException(e)&&!(e.sourceKey&&matchedBoKeys.has(e.sourceKey)));
const best=new Map();
for(const e of (result.exceptions||[]).concat(resolvedRuleExceptions).filter(e=>!isInformationalAuditException(e))){
  const k=[e.type,e.account,e.time,e.systemAmount??''].join('|');
  const old=best.get(k); if(!old||(!old.detail&&e.detail)) best.set(k,e);
}
const exceptions=[...best.values()].sort((a,b)=>(a.sortSec||0)-(b.sortSec||0)).map((e,i)=>({
  code:'EX-'+String(3001+i),business_date:e.date||job.business_date,occurred_at:e.time||'00:00:00',company:e.company||job.company,
  bo_date:e.boDate||null,bo_time:e.boTime&&e.boTime!=='-'?e.boTime:null,
  stm_date:e.stmDate||null,stm_time:e.stmTime&&e.stmTime!=='-'?e.stmTime:null,
  bank:e.bank||null,account:e.account||null,direction:e.direction||null,member_code:e.member||null,ex_type:e.type,type_name:e.typeName||e.type,
  severity:['critical','high','medium','low'].includes(e.severity)?e.severity:'medium',status:e.status||'open',track:e.track||null,
  system_amount:e.systemAmount??null,bank_amount:e.bankAmount??null,amount_diff:e.amountDiff??0,risk_amount:e.riskAmount??0,time_diff_sec:e.timeDiffSec??0,
  customer_details:e.customerDetails||{},
  employee:e.employee||null,shift:e.shift||null,cause:e.cause||null,detail:e.detail||null,stm_raw:String(e.stmRaw||'').slice(0,4000),bo_raw:String(e.boRaw||'').slice(0,4000)
}));
const fileIds=files.map(f=>f.file.id).filter(Boolean);
return [{json:{job,result:{run_by:'n8n-cloud-worker',elapsed_ms:result.elapsedMs||Date.now()-started,stm_count:result.stmCount||0,bo_count:result.boCount||0,matched:result.matched||0,match_rate:Number((result.matchRate||0).toFixed(3)),no_stm_count:result.noStmCount||0,file_ids:fileIds,summary:{match_evidence:result.matchEvidence||[],match_evidence_version:1,rules_only:!!result.rulesOnly,rule_exceptions:resolvedRuleExceptions.length,worker:'n8n-cloud',job_id:job.id,worker_version:'1.9.29-seven-m-source-parity',source_parser_completion:true,non_success_pm_zero_eligible:true,xb_provider_column_policy:true,xb_provider_scope_at_az_cp_m:true,xb_provider_id_note_rule:true,xb_provider_id_note_unique:true,xb_provider_id_raw_recovery:true,xb_provider_signed_amount_close:true,xb_localpay_3xb_enabled:true,xb_qpay_inactive:true,sys123_provider_identity_rule:true,sys123_provider_amount_policy:true,sys123_received_amount_deposit:true,sys123_pending_evidence:true,sys123_pending_partial_identity_fallback:true,sys123_generic_provider_inference:true,sys123_short_provider_tokens:true,sys123_account_tail_fallback:true,sys123_partial_identity_reciprocal_near_time:true,sys123_fallback_time_tolerance_sec:3600,sys123_cross_day_reciprocal_nearest:true,sys123_cyber_withdraw_two_point:true,sys123_duplicate_reciprocal_nearest:true,sys123_duplicate_time_tolerance_sec:3600,sys123_statement_split_tabs:true,sys123_normal_bank_time_column:true,sys123_ktb_next_day_candidate:true,sys123_manual_bank_safe_close:true,sys123_manual_bank_time_amount:true,sys123_customer_identity_tags:true,fr8_bank_name_reciprocal_near_time:true,seven_m_provider_identity_rule:true,seven_m_pm_near_time_safe_close:true,seven_m_internal_transfer_reciprocal:true,seven_m_provider_scope_at_cp_cy_az_m_local:true,seven_m_tmn_split_tabs:true,seven_m_tmn_screenshot_completeness:true,seven_m_tmn_ocr_reciprocal_repair:true,seven_m_tmn_offdate_reciprocal:true,seven_m_docx_ocr_regression_gate:true,seven_m_unconfirmed_pending_suppressed:sevenMUnconfirmedPendingRowsSuppressed,cp2_provider_alias:true,seven_m_cp2_pending_deposit:true,bank_signed_amount_normalized:true,statement_fee_rows_filtered:true,tmn_non_customer_rows_filtered:true,tmn_fundout_preserved:true,bo_split_rows_preserved:true,audit_visible_case_policy:true,time_variance_auto_pass:true,statement_source_account_trusted:true,structured_ocr_current_text_verified:true,duplicate_source_files:[...duplicateSourceFileIds],duplicate_source_rows_removed:duplicateSourceRowsRemoved,duplicate_statement_files:[...duplicateSourceFileIds],duplicate_statement_rows_removed:duplicateSourceRowsRemoved,reciprocal_nearest_rescue:true,reciprocal_nearest_any_time:true,bo_transaction_time_primary:true,exact_unique_tolerance_sec:600,provider_near_time_tolerance_sec:600,internal_transfer_tolerance_sec:300,pm_master_account_guard:true,bo_first:boFirstCoverage}},exceptions,files:parseResults,quality_errors:[]},pairedItem:{item:0}}];`;

const cred = { supabaseApi: { id: "dGndiinLb7AKnjIu", name: "Supabase account" } };
const deployedReconcileCode = reconcileCode
  .replace(
    "worker_version:'1.9.29-seven-m-source-parity'",
    `worker_version:'${WORKER_VERSION}'`,
  )
  .replace(
    "1.9.2-xb-sapan-raw-id-recovery",
    "1.9.21-xb-no-stale-duplicate",
  )
  .replace(
    "1.9.21-xb-no-stale-duplicate",
    "1.9.22-xb-sapan-all-case-close",
  )
  .replace(
    "1.9.22-xb-sapan-all-case-close",
    "1.9.23-xb-sapan-company-scope",
  )
  .replace(
    "1.9.23-xb-sapan-company-scope",
    "1.9.24-xb-sapan-type-pagination",
  )
  .replace(
    "xb_provider_signed_amount_close:true,",
    "xb_provider_signed_amount_close:true,xb_provider_duplicate_rows_suppressed:result.xbProviderDuplicateRowsSuppressed||0,",
  )
  .replace(
    "seven_m_tmn_ocr_reciprocal_repair:true,",
    "seven_m_tmn_ocr_reciprocal_repair:true,seven_m_tmn_exact_amount_first:true,seven_m_tmn_duplicate_rows_suppressed:result.tmnOcrDuplicateRowsSuppressed||0,",
  )
  .replace(
    "non_success_pm_zero_eligible:true,",
    "non_success_pm_zero_eligible:true,pending_only_pm_zero_eligible:true,",
  );
const http = (id, name, position, parameters) => ({ parameters, id, name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position, credentials: cred });
const driveCred = { googleDriveOAuth2Api: { id: "wYcR0wVZktx3BmP0", name: "Google Drive account" } };
const driveHttp = (id, name, position, parameters) => ({
  parameters: {
    ...parameters,
    options: {
      ...(parameters.options || {}),
      // DOCX statements can contain 17-18 screenshots.  Sending every image
      // to Drive OCR concurrently intermittently drops the final 1-2 images.
      // Serialize the requests so all source pages reach the quality gate.
      batching: { batch: { batchSize: 1, batchInterval: 1500 } },
    },
  },
  id,
  name,
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position,
  credentials: driveCred,
  retryOnFail: true,
  maxTries: 6,
  waitBetweenTries: 5000,
  onError: "continueRegularOutput",
});

const nativePdfProbe = `${runtime}
const meta=$('วนทีละไฟล์').item.json;
const source=$json;
const text=typeof source.text==='string'?source.text:typeof source.data==='string'?source.data:'';
let readable=false, diagnostics=null;
try {
  if(!source.error) {
    const result=await PdfStm.parseText(meta.file.file_name,text,meta.job.business_date);
    diagnostics=result.quality;
    const explicitEmpty=/(ไม่มีรายการเคลื่อนไหว|ไม่มีรายการธุรกรรม|ไม่พบรายการเคลื่อนไหว|no transactions|no activity)/i.test(text);
    // Trust complete native statement extraction for every company, including
    // 7M. Image-only or incomplete PDFs still fail these checks and continue
    // to OCR, but a complete native parse must not be replaced by a noisier OCR
    // version (which previously created false partial-read cases on KBANK).
    readable=!!result.header.bank && !!result.header.account && result.quality.complete && (result.quality.parsedRows>0 || explicitEmpty);
  }
} catch(error) { diagnostics={error:String(error.message||error)}; }
return [{json:{text,pdf_readable:readable,native_quality:diagnostics,numpages:source.numpages||null},pairedItem:{item:0}}];`;

const nodes = [
  { parameters: { rule: { interval: [{ field: "minutes", minutesInterval: 10 }] } }, id: "schedule", name: "ทุก 10 นาที", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [-1040, 80] },
  { parameters: {}, id: "manual", name: "ทดสอบด้วยมือ", type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-1040, 240] },
  { parameters: { inputSource: "passthrough" }, id: "a19bc85c-c123-4897-a385-c2a65bac7a15", name: "รับงานจากรอบตรวจ", type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1.1, position: [-1040, 400] },
  { ...http("queue", "Supabase: ตรวจไฟล์และจัดคิว", [-820, 160], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/queue_due_daily_recon_jobs", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ p_from: DateTime.now().setZone('Asia/Bangkok').startOf('month').toISODate(), p_to: DateTime.now().setZone('Asia/Bangkok').plus({ days: 1 }).toISODate() }) }}", options: { response: { response: {} } },
  }), retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 },
  { ...http("restore-manual-rerun", "Supabase: คืนคิวที่สั่งรันใหม่", [-600, 160], {
    method: "PATCH",
    url: "={{ $vars.SUPABASE_URL }}/rest/v1/daily_recon_jobs?rerun_requested_at=not.is.null&status=in.(queued,needs_review,error,waiting_files,completed)&is_archived=eq.false&business_date=gte.{{ DateTime.now().setZone('Asia/Bangkok').startOf('month').toISODate() }}&business_date=lte.{{ DateTime.now().setZone('Asia/Bangkok').plus({ days: 1 }).toISODate() }}",
    authentication: "predefinedCredentialType",
    nodeCredentialType: "supabaseApi",
    sendHeaders: true,
    headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=minimal" }] },
    sendBody: true,
    specifyBody: "json",
    // Consume the rerun request while restoring the job. All requested jobs are
    // changed to queued in this PATCH before the claim step, so clearing the
    // marker prevents a completed needs_review job from being queued again on
    // every subsequent worker tick.
    jsonBody: "={{ JSON.stringify({ status: 'queued', attempt_count: 0, claimed_at: null, claimed_by: null, last_error: null, rerun_requested_at: null, updated_at: DateTime.now().toISO() }) }}",
    options: { response: { response: {} } },
  }), alwaysOutputData: true, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 },
  { parameters: { jsCode: "return [{json:{started_at:new Date().toISOString()}}];" }, id: "single-cycle", name: "รวมเป็นหนึ่งรอบ", type: "n8n-nodes-base.code", typeVersion: 2, position: [-380, 160] },
  http("claim", "Supabase: จองหนึ่งงาน", [-160, 160], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/claim_daily_recon_jobs", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ p_worker: 'n8n-cloud-worker', p_limit: 1 }) }}", options: { response: { response: {} } },
  }),
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "has-job", leftValue: "={{ !!$json.id }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-job", name: "มีงานในคิว?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [60, 160] },
  http("files", "Supabase: อ่านรายการไฟล์ของวัน", [300, 220], {
    // System 123 KTB can publish 23:00-23:59 statement entries under the next
    // calendar day. Read one adjacent batch as evidence, then the selector below
    // admits only KTB statements from that adjacent day (never BO or other banks).
    url: "={{ $vars.SUPABASE_URL }}/rest/v1/mail_batches?business_date=gte.{{ $json.business_date }}&business_date=lte.{{ DateTime.fromISO($json.business_date,{zone:'Asia/Bangkok'}).plus({days:1}).toISODate() }}&select=id,business_date,company,source_files(id,file_name,storage_path,kind,company,parsed,row_count,checksum,size_bytes,created_at,source_file_ocr(provider,confidence,page_count,line_count,extracted_text,rows,updated_at))", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi", options: { response: { response: {} } },
  }),
  { parameters: { jsCode: "const job=$('Supabase: จองหนึ่งงาน').first().json; const candidates=[]; const reconKinds=new Set(['stm_pdf','pm_statement','bo_main','manual_credit','manual_payment','manual_bonus','comm_req','credit_out']); const keyOf=n=>String(n||'').trim().replace(/\\s+/g,' ').toLowerCase(); const sys123=new Set(['AT4','FR8','SK8']); const jobCompany=String(job.company||'').toUpperCase(); for(const b of $input.all().map(x=>x.json)){const batchDate=String(b.business_date||'').slice(0,10); const adjacent=batchDate&&batchDate!==String(job.business_date||'').slice(0,10); for(const f of (b.source_files||[])){const company=String(f.company||b.company||'').toUpperCase(); const ext=String(f.file_name||'').split('.').pop().toLowerCase(); const ktbStatement=f.kind==='stm_pdf'&&/(?:^|[^A-Z])KTB(?:[^A-Z]|$)|กรุงไทย/i.test(String(f.file_name||'')); if(adjacent&&!(sys123.has(jobCompany)&&ktbStatement)) continue; if(company===jobCompany&&['xlsx','xlsm','xls','csv','pdf','docx'].includes(ext)&&reconKinds.has(f.kind)) candidates.push({...f,ext,batch_business_date:batchDate,adjacent_day_ktb:adjacent&&ktbStatement});}} candidates.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))); const healthyNames=new Set(candidates.filter(f=>f.parsed===true).map(f=>keyOf(f.file_name))); const readable=candidates.filter(f=>f.parsed===true||!healthyNames.has(keyOf(f.file_name))); const seenNames=new Set(); const selected=readable.filter(f=>{const key=keyOf(f.file_name); if(seenNames.has(key)) return false; seenNames.add(key); return true;}); const out=selected.map(file=>({json:{job,file},pairedItem:{item:0}})); if(!out.length) throw new Error('ไม่พบไฟล์กระทบยอดที่รองรับสำหรับ '+job.business_date+' '+job.company); return out;" }, id: "filter-files", name: "เลือกไฟล์ของบริษัท", type: "n8n-nodes-base.code", typeVersion: 2, position: [520, 220] },
  { parameters: { batchSize: 1, options: {} }, id: "file-loop", name: "วนทีละไฟล์", type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [740, 220] },
  http("download", "ดาวน์โหลดไฟล์จาก Storage", [980, 340], {
    url: "={{ $vars.SUPABASE_URL }}/storage/v1/object/audit-files/{{ $json.file.storage_path }}", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    options: { response: { response: { responseFormat: "file", outputPropertyName: "data" } }, timeout: 120000 },
  }),
  { parameters: { jsCode: "const item=$input.first(); const meta=$('วนทีละไฟล์').item.json; const binary={...(item.binary||{})}; if(!binary.data) throw new Error('ไม่พบข้อมูลไฟล์ '+meta.file.file_name); binary.data={...binary.data,fileName:meta.file.file_name,fileExtension:meta.file.ext}; return [{json:item.json,binary,pairedItem:{item:0}}];" }, id: "restore-original-file-name", name: "คืนชื่อไฟล์ต้นฉบับ", type: "n8n-nodes-base.code", typeVersion: 2, position: [1090, 340] },
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "is-statement-document", leftValue: "={{ ['pdf','docx'].includes($('วนทีละไฟล์').item.json.file.ext) }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-pdf", name: "เป็น PDF?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1200, 340] },
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "has-reviewed-tmn-pdf", leftValue: "={{ (()=>{const f=$('วนทีละไฟล์').item.json.file;const o=Array.isArray(f.source_file_ocr)?f.source_file_ocr[0]:f.source_file_ocr;return f.ext==='pdf'&&o?.provider==='tmn_visual_review_v1';})() }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-reviewed-tmn", name: "TMN ตรวจภาพครบแล้ว?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1310, 220] },
  { parameters: { jsCode: "return [{json:{text:'',manual_visual_review:true},pairedItem:{item:0}}];" }, id: "use-reviewed-tmn", name: "ใช้รายการ TMN ที่ตรวจภาพ", type: "n8n-nodes-base.code", typeVersion: 2, position: [1420, 120] },
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "is-excel", leftValue: "={{ ['xlsx','xlsm','xls'].includes($('วนทีละไฟล์').item.json.file.ext) }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-excel", name: "เป็น Excel?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1420, 440] },
  { parameters: { operation: "pdf", binaryPropertyName: "data", options: {} }, id: "extract-pdf", name: "อ่าน PDF โดยตรง", type: "n8n-nodes-base.extractFromFile", typeVersion: 1.1, position: [1420, 220], onError: "continueRegularOutput" },
  { parameters: { jsCode: nativePdfProbe }, id: "probe-native-pdf", name: "ตรวจรายการ PDF ก่อน OCR", type: "n8n-nodes-base.code", typeVersion: 2, position: [1530, 220] },
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "has-pdf-text", leftValue: "={{ $json.pdf_readable === true }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-pdf-text", name: "PDF มีข้อความ?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1640, 220] },
  { parameters: { jsCode: "const text=String($json.text??$json.data??'').trim(); return [{json:{text,ocr_used:false,ocr_provider:'native_pdf',ocr_confidence:null,ocr_page_count:Number($json.numpages||0)||null},pairedItem:{item:0}}];" }, id: "format-native-pdf", name: "จัดผล PDF โดยตรง", type: "n8n-nodes-base.code", typeVersion: 2, position: [1860, 180] },
  { parameters: { jsCode: "const src=$('คืนชื่อไฟล์ต้นฉบับ').item; if(!src.binary||!src.binary.data) throw new Error('ไม่พบไฟล์ PDF ต้นฉบับสำหรับ OCR'); return [{json:{},binary:src.binary,pairedItem:{item:0}}];" }, id: "restore-pdf-binary", name: "เตรียม PDF สำหรับ OCR", type: "n8n-nodes-base.code", typeVersion: 2, position: [1860, 280] },
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "is-docx", leftValue: "={{ $('วนทีละไฟล์').item.json.file.ext === 'docx' }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-docx", name: "เป็น Word ภาพรายการ?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1970, 280] },
  { parameters: { jsCode: "const item=$input.first(); const binary={...(item.binary||{})}; if(!binary.data) throw new Error('ไม่พบ binary ของ DOCX'); binary.data={...binary.data,fileExtension:'zip',fileName:'tmn-statement.zip',mimeType:'application/zip'}; return [{json:item.json,binary,pairedItem:{item:0}}];" }, id: "docx-as-zip", name: "เตรียม Word เป็น ZIP", type: "n8n-nodes-base.code", typeVersion: 2, position: [2080, 380] },
  { parameters: { operation: "decompress", binaryPropertyName: "data", outputPrefix: "docx_" }, id: "unzip-docx-images", name: "แตกภาพจาก Word", type: "n8n-nodes-base.compression", typeVersion: 1.1, position: [2190, 380] },
  { parameters: { jsCode: "const out=[]; for(const item of $input.all()){ for(const [key,bin] of Object.entries(item.binary||{})){ const name=String(bin.fileName||key); const path=[bin.directory,name].filter(Boolean).join('/'); if(!/word[\\/]media[\\/]/i.test(path)||!/[.](png|jpe?g|webp|tiff?)$/i.test(name)) continue; const ext=(name.match(/[.]([a-z0-9]+)$/i)||[])[1]?.toLowerCase()||'png'; const mime=/jpe?g/.test(ext)?'image/jpeg':ext==='webp'?'image/webp':/^tiff?$/.test(ext)?'image/tiff':'image/png'; out.push({json:{docx_image:path},binary:{data:{...bin,mimeType:mime,fileExtension:ext}},pairedItem:{item:0}}); }} if(!out.length) throw new Error('ไม่พบภาพรายการใน Word'); return out;" }, id: "select-docx-images", name: "เลือกภาพรายการ TMN", type: "n8n-nodes-base.code", typeVersion: 2, position: [2300, 380] },
  driveHttp("google-drive-ocr-upload", "Google Drive OCR: แปลง PDF", [2080, 280], {
    method: "POST", url: "https://www.googleapis.com/upload/drive/v2/files", authentication: "predefinedCredentialType", nodeCredentialType: "googleDriveOAuth2Api",
    sendQuery: true, queryParameters: { parameters: [{ name: "uploadType", value: "media" }, { name: "convert", value: "true" }, { name: "ocr", value: "true" }, { name: "ocrLanguage", value: "th" }] },
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "={{ $binary.data.mimeType || 'application/pdf' }}" }] }, sendBody: true, contentType: "binaryData", inputDataFieldName: "data",
    options: { timeout: 180000, response: { response: { responseFormat: "json" } } },
  }),
  driveHttp("google-drive-ocr-export", "Google Drive OCR: อ่านข้อความ", [2300, 280], {
    url: "=https://www.googleapis.com/drive/v2/files/{{ $json.id }}/export", authentication: "predefinedCredentialType", nodeCredentialType: "googleDriveOAuth2Api",
    sendQuery: true, queryParameters: { parameters: [{ name: "mimeType", value: "text/plain" }] }, options: { timeout: 180000, response: { response: { responseFormat: "text" } } },
  }),
  { parameters: { jsCode: "const items=$input.all(); const errors=items.map(x=>x.json&&x.json.error).filter(Boolean); const texts=items.map(x=>{const raw=x.json&&(x.json.data??x.json.body??x.json.text); return typeof raw==='string'?raw.trim():'';}).filter(Boolean); if(!texts.length&&errors.length) return [{json:{error:errors[0],text:'',ocr_used:true,ocr_provider:'google_drive',ocr_confidence:null,ocr_input_count:items.length,ocr_page_count:0,ocr_errors:errors.length},pairedItem:{item:0}}]; return [{json:{text:texts.join('\\f'),ocr_used:true,ocr_provider:'google_drive',ocr_confidence:null,ocr_input_count:items.length,ocr_page_count:texts.length,ocr_errors:errors.length},pairedItem:{item:0}}];" }, id: "format-ocr-result", name: "จัดผล OCR", type: "n8n-nodes-base.code", typeVersion: 2, position: [2520, 280] },
  { parameters: { operation: "xlsx", binaryPropertyName: "data", options: { headerRow: false, rawData: true, readAsString: true } }, id: "extract-xlsx", name: "อ่าน Excel", type: "n8n-nodes-base.extractFromFile", typeVersion: 1.1, position: [1640, 400], onError: "continueRegularOutput" },
  { parameters: { operation: "text", binaryPropertyName: "data", destinationKey: "data", options: { encoding: "utf8" } }, id: "extract-csv", name: "อ่าน CSV", type: "n8n-nodes-base.extractFromFile", typeVersion: 1.1, position: [1640, 520], onError: "continueRegularOutput" },
  { parameters: { jsCode: normalizeCode }, id: "normalize", name: "แปลงรายการเป็นมาตรฐาน", type: "n8n-nodes-base.code", typeVersion: 2, position: [1880, 340] },
  { parameters: { jsCode: deployedReconcileCode }, id: "reconcile", name: "กระทบยอดและสร้าง Exception", type: "n8n-nodes-base.code", typeVersion: 2, position: [980, 80] },
  http("record-parse-results", "Supabase: บันทึกผลอ่านไฟล์", [1200, 80], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/record_source_file_parse_results", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ (()=>{const x=$('กระทบยอดและสร้าง Exception').first().json;return JSON.stringify({p_job_id:x.job.id,p_results:x.files});})() }}", options: { response: { response: {} } },
  }),
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 }, conditions: [{ id: "quality-ok", leftValue: "={{ (()=>{const x=$('กระทบยอดและสร้าง Exception').first().json;return x.quality_errors.length === 0 && Array.isArray(x.job.missing_groups) && x.job.missing_groups.length === 0;})() }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-quality", name: "ไฟล์ผ่าน Quality Gate?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [1420, 80] },
  { parameters: { jsCode: "const x=$('กระทบยอดและสร้าง Exception').first().json; return [{json:{p_run:{business_date:x.job.business_date,company:x.job.company,run_by:x.result.run_by,elapsed_ms:x.result.elapsed_ms,stm_count:x.result.stm_count,bo_count:x.result.bo_count,matched:x.result.matched,match_rate:x.result.match_rate,exception_count:x.exceptions.length,no_stm_count:x.result.no_stm_count,file_ids:x.result.file_ids,summary:x.result.summary}},pairedItem:{item:0}}];" }, id: "prepare-run-payload", name: "เตรียมข้อมูลผลการรัน", type: "n8n-nodes-base.code", typeVersion: 2, position: [1640, 20] },
  http("insert-run", "Supabase: สร้างผลการรัน", [1860, 20], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/create_recon_run_with_timeout", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=representation" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify($json) }}", options: { timeout: 180000, response: { response: {} } },
  }),
  { parameters: { jsCode: "const source=$('กระทบยอดและสร้าง Exception').first().json; const run=$json; const runId=run.id; if(!runId) throw new Error('Supabase ไม่คืน run id'); const rows=source.exceptions.map(e=>({...e,run_id:runId})); const size=200; if(!rows.length) return [{json:{...source,run_id:runId,exception_rows:[]},pairedItem:{item:0}}]; const out=[]; for(let i=0;i<rows.length;i+=size) out.push({json:{...source,exceptions:[],run_id:runId,exception_rows:rows.slice(i,i+size),batch_no:Math.floor(i/size)+1,batch_total:Math.ceil(rows.length/size)},pairedItem:{item:0}}); return out;" }, id: "prepare-save", name: "เตรียมบันทึก Exception", type: "n8n-nodes-base.code", typeVersion: 2, position: [2080, 20] },
  { ...http("insert-exceptions", "Supabase: บันทึก Exception", [2080, 20], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/exceptions", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=minimal" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify($json.exception_rows) }}", options: { response: { response: {} } },
  }) },
  { ...http("verify-exception-count", "Supabase: ตรวจว่า Exception บันทึกครบ", [2190, 20], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/verify_recon_run_exception_count", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({p_run_id:$('เตรียมบันทึก Exception').first().json.run_id}) }}", options: { response: { response: {} } },
  }), executeOnce: true },
  { parameters: { jsCode: "const run=$('เตรียมบันทึก Exception').first().json.run_id; return ['time_diff','missing_stm','missing_bo','cross_day','amount_diff'].map(ex_type=>({json:{ex_type,run_id:run},pairedItem:{item:0}}));" }, id: "prepare-read-previous-sapan-types", name: "แบ่งอ่านเคส Sapan ตามประเภท", type: "n8n-nodes-base.code", typeVersion: 2, position: [2190, 20] },
  { ...http("read-previous-sapan-exceptions", "Supabase: อ่านเคส Sapan รอบก่อน", [2300, 20], {
    url: "={{ (()=>{const j=$('กระทบยอดและสร้าง Exception').first().json.job;const aliases=['3XB','3X','3xbet','3xb'];const company=aliases.includes(String(j.company||'').trim())?'&company=in.('+aliases.map(encodeURIComponent).join(',')+')':'&company=eq.'+encodeURIComponent(j.company);return $vars.SUPABASE_URL+'/rest/v1/exceptions?business_date=eq.'+encodeURIComponent(j.business_date)+'&run_id=neq.'+encodeURIComponent($json.run_id)+company+'&status=in.(open,clarifying,answered)&superseded_by_exception_id=is.null&ex_type=eq.'+encodeURIComponent($json.ex_type)+'&select=id,company,direction,ex_type,system_amount,bank_amount,stm_raw,bo_raw';})() }}",
    authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi", options: { response: { response: {} } },
  }), alwaysOutputData: true },
  { parameters: { jsCode: `const source=$('กระทบยอดและสร้าง Exception').first().json;
const runId=$('เตรียมบันทึก Exception').first().json.run_id;
const evidence=(source.result?.summary?.match_evidence||[]);
const exact=/\\b6aa[a-f0-9]{21}\\b/ig;
const clean=v=>String(v||'').trim().toLowerCase();
const dir=v=>/ถอน|withdraw/i.test(String(v||''))?'withdraw':/ฝาก|deposit/i.test(String(v||''))?'deposit':clean(v);
const companyKey=v=>{const c=clean(v).replace(/[^a-z0-9]/g,'');return ['3x','3xb','3xbet'].includes(c)?'3xb':c;};
const byId=new Map();
for(const e of evidence){
  const stm=clean(e?.customer?.stm?.providerReference),bo=clean(e?.customer?.bo?.providerReference);
  // The pair may have been selected earlier by another deterministic rule
  // (for example a unique amount/time pair).  Lifecycle closure must depend on
  // the evidence itself, not on the label of the matcher that happened to win.
  // Require the exact provider id on both sides, except for pairs explicitly
  // produced by the dedicated XB provider-id matcher.
  const exactPair=/^6aa[a-f0-9]{21}$/.test(stm)&&stm===bo;
  const ids=exactPair?[stm]:(e?.method==='xb-provider-_id-note-amount'||e?.xbProviderRefMatched)
    ?[stm,bo].filter(id=>/^6aa[a-f0-9]{21}$/.test(id)):[];
  for(const id of new Set(ids)){
    const rows=byId.get(id)||[];
    rows.push({id,company:clean(e.company),direction:dir(e.direction),amount:Number(e.amount)});
    byId.set(id,rows);
  }
}
const oldRows=$input.all().flatMap(x=>Array.isArray(x.json)?x.json:[x.json]).filter(x=>x&&x.id);
const closing=[];
for(const row of oldRows){
  const stmIds=String(row.stm_raw||'').toLowerCase().match(exact)||[];
  const boIds=String(row.bo_raw||'').toLowerCase().match(exact)||[];
  const sides=[];
  for(const id of new Set(stmIds)) sides.push({id,amount:Number(row.bank_amount)});
  for(const id of new Set(boIds)) sides.push({id,amount:Number(row.system_amount)});
  const strictCovered=sides.filter(side=>Number.isFinite(side.amount)&&(byId.get(side.id)||[]).some(ev=>
    ev.direction===dir(row.direction)&&ev.amount===side.amount&&(!row.company||!ev.company||companyKey(ev.company)===companyKey(row.company))
  ));
  const sameAmountCovered=sides.filter(side=>Number.isFinite(side.amount)&&(byId.get(side.id)||[]).some(ev=>
    ev.amount===side.amount
  ));
  const equalAmount=Number.isFinite(Number(row.bank_amount))&&Number(row.bank_amount)===Number(row.system_amount);
  // Older time_diff rows can contain a corrupted cross-pair in one raw side.
  // When the new run proves an exact provider-id pair at the same equal amount,
  // the stale warning must close even if the unrelated legacy side is not covered.
  const currentExactTimePair=clean(row.ex_type)==='time_diff'&&equalAmount&&sameAmountCovered.length>0;
  const closureEvidence=currentExactTimePair?sameAmountCovered:strictCovered;
  if(sides.length&&(strictCovered.length===sides.length||currentExactTimePair)) closing.push({id:row.id,provider_id:closureEvidence[0].id,provider_ids:[...new Set(closureEvidence.map(x=>x.id))],run_id:runId});
}
return closing.length?closing.map(json=>({json,pairedItem:{item:0}})):[{json:{skip:true,run_id:runId},pairedItem:{item:0}}];` }, id: "prepare-close-previous-sapan", name: "เตรียมปิดเคส Sapan รอบก่อน", type: "n8n-nodes-base.code", typeVersion: 2, position: [2300, 20] },
  { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "has-sapan-closure", leftValue: "={{ !!$json.id }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, id: "if-close-previous-sapan", name: "มีเคส Sapan ต้องปิด?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [2410, 20] },
  http("close-previous-sapan", "Supabase: ปิดเคส Sapan รอบก่อน", [2520, -40], {
    method: "PATCH", url: "={{ $vars.SUPABASE_URL }}/rest/v1/exceptions?id=eq.{{ $json.id }}", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=representation" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({status:'closed',auto_closed:true,resolved_at:DateTime.now().toISO(),resolved_by:'system:xb-sapan-id-v1',closing_run_id:$json.run_id,closure_rule:'xb-exact-sapan-provider-id',resolution_note:'ปิดอัตโนมัติเมื่อรอบใหม่จับคู่ด้วยรหัส Provider หลัง Sapan: ตรงกันแบบ exact พร้อมทิศทางและยอดตรงกัน',updated_at:DateTime.now().toISO()}) }}", options: { response: { response: {} } },
  }),
  { ...http("audit-close-previous-sapan", "Supabase: บันทึก Audit ปิด Sapan", [2630, -40], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/audit_log", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }, { name: "Prefer", value: "return=minimal" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ (()=>{const run=$('เตรียมบันทึก Exception').first().json.run_id;return JSON.stringify({actor:'system:xb-sapan-id-v1',action:'exception_auto_closed_by_exact_provider_id',entity:'exception',target:String($json.id||''),detail:'รอบใหม่จับคู่ exact Sapan provider id จึงปิดเคสเดิมโดยเก็บประวัติ',meta:{closing_run_id:run,rule:'xb-exact-sapan-provider-id'}});})() }}", options: { response: { response: {} } },
  }), alwaysOutputData: true, onError: "continueRegularOutput" },
  { ...http("finish", "Supabase: ปิดงานสำเร็จ", [2300, 20], {
    method: "POST", url: "={{ $vars.SUPABASE_URL }}/rest/v1/rpc/finish_daily_recon_job", authentication: "predefinedCredentialType", nodeCredentialType: "supabaseApi",
    sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json",
    jsonBody: "={{ (()=>{const x=$('เตรียมบันทึก Exception').first().json;return JSON.stringify({p_job_id:x.job.id,p_run_id:x.run_id});})() }}", options: { response: { response: {} } },
  }), executeOnce: true },
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
  "รับงานจากรอบตรวจ": { main: [[{ node: "รวมเป็นหนึ่งรอบ", type: "main", index: 0 }]] },
  "Supabase: ตรวจไฟล์และจัดคิว": { main: [[{ node: "Supabase: คืนคิวที่สั่งรันใหม่", type: "main", index: 0 }]] },
  "Supabase: คืนคิวที่สั่งรันใหม่": { main: [[{ node: "รวมเป็นหนึ่งรอบ", type: "main", index: 0 }]] },
  "รวมเป็นหนึ่งรอบ": { main: [[{ node: "Supabase: จองหนึ่งงาน", type: "main", index: 0 }]] },
  "Supabase: จองหนึ่งงาน": { main: [[{ node: "มีงานในคิว?", type: "main", index: 0 }]] },
  "มีงานในคิว?": { main: [[{ node: "Supabase: อ่านรายการไฟล์ของวัน", type: "main", index: 0 }], [{ node: "จบรอบ Worker", type: "main", index: 0 }]] },
  "Supabase: อ่านรายการไฟล์ของวัน": { main: [[{ node: "เลือกไฟล์ของบริษัท", type: "main", index: 0 }]] },
  "เลือกไฟล์ของบริษัท": { main: [[{ node: "วนทีละไฟล์", type: "main", index: 0 }]] },
  "วนทีละไฟล์": { main: [[{ node: "กระทบยอดและสร้าง Exception", type: "main", index: 0 }], [{ node: "ดาวน์โหลดไฟล์จาก Storage", type: "main", index: 0 }]] },
  "ดาวน์โหลดไฟล์จาก Storage": { main: [[{ node: "คืนชื่อไฟล์ต้นฉบับ", type: "main", index: 0 }]] },
  "คืนชื่อไฟล์ต้นฉบับ": { main: [[{ node: "เป็น PDF?", type: "main", index: 0 }]] },
  "เป็น PDF?": { main: [[{ node: "TMN ตรวจภาพครบแล้ว?", type: "main", index: 0 }], [{ node: "เป็น Excel?", type: "main", index: 0 }]] },
  "TMN ตรวจภาพครบแล้ว?": { main: [[{ node: "ใช้รายการ TMN ที่ตรวจภาพ", type: "main", index: 0 }], [{ node: "อ่าน PDF โดยตรง", type: "main", index: 0 }]] },
  "ใช้รายการ TMN ที่ตรวจภาพ": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "เป็น Excel?": { main: [[{ node: "อ่าน Excel", type: "main", index: 0 }], [{ node: "อ่าน CSV", type: "main", index: 0 }]] },
  "อ่าน PDF โดยตรง": { main: [[{ node: "ตรวจรายการ PDF ก่อน OCR", type: "main", index: 0 }]] },
  "ตรวจรายการ PDF ก่อน OCR": { main: [[{ node: "PDF มีข้อความ?", type: "main", index: 0 }]] },
  "PDF มีข้อความ?": { main: [[{ node: "จัดผล PDF โดยตรง", type: "main", index: 0 }], [{ node: "เตรียม PDF สำหรับ OCR", type: "main", index: 0 }]] },
  "จัดผล PDF โดยตรง": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "เตรียม PDF สำหรับ OCR": { main: [[{ node: "เป็น Word ภาพรายการ?", type: "main", index: 0 }]] },
  "เป็น Word ภาพรายการ?": { main: [[{ node: "เตรียม Word เป็น ZIP", type: "main", index: 0 }], [{ node: "Google Drive OCR: แปลง PDF", type: "main", index: 0 }]] },
  "เตรียม Word เป็น ZIP": { main: [[{ node: "แตกภาพจาก Word", type: "main", index: 0 }]] },
  "แตกภาพจาก Word": { main: [[{ node: "เลือกภาพรายการ TMN", type: "main", index: 0 }]] },
  "เลือกภาพรายการ TMN": { main: [[{ node: "Google Drive OCR: แปลง PDF", type: "main", index: 0 }]] },
  "Google Drive OCR: แปลง PDF": { main: [[{ node: "Google Drive OCR: อ่านข้อความ", type: "main", index: 0 }]] },
  "Google Drive OCR: อ่านข้อความ": { main: [[{ node: "จัดผล OCR", type: "main", index: 0 }]] },
  "จัดผล OCR": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "อ่าน Excel": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "อ่าน CSV": { main: [[{ node: "แปลงรายการเป็นมาตรฐาน", type: "main", index: 0 }]] },
  "แปลงรายการเป็นมาตรฐาน": { main: [[{ node: "วนทีละไฟล์", type: "main", index: 0 }]] },
  "กระทบยอดและสร้าง Exception": { main: [[{ node: "Supabase: บันทึกผลอ่านไฟล์", type: "main", index: 0 }]] },
  "Supabase: บันทึกผลอ่านไฟล์": { main: [[{ node: "ไฟล์ผ่าน Quality Gate?", type: "main", index: 0 }]] },
  "ไฟล์ผ่าน Quality Gate?": { main: [[{ node: "เตรียมข้อมูลผลการรัน", type: "main", index: 0 }], [{ node: "บันทึกว่าอ่านแล้วและรอไฟล์", type: "main", index: 0 }]] },
  "เตรียมข้อมูลผลการรัน": { main: [[{ node: "Supabase: สร้างผลการรัน", type: "main", index: 0 }]] },
  "Supabase: สร้างผลการรัน": { main: [[{ node: "เตรียมบันทึก Exception", type: "main", index: 0 }]] },
  "เตรียมบันทึก Exception": { main: [[{ node: "Supabase: บันทึก Exception", type: "main", index: 0 }]] },
  "Supabase: บันทึก Exception": { main: [[{ node: "Supabase: ตรวจว่า Exception บันทึกครบ", type: "main", index: 0 }]] },
  "Supabase: ตรวจว่า Exception บันทึกครบ": { main: [[{ node: "แบ่งอ่านเคส Sapan ตามประเภท", type: "main", index: 0 }]] },
  "แบ่งอ่านเคส Sapan ตามประเภท": { main: [[{ node: "Supabase: อ่านเคส Sapan รอบก่อน", type: "main", index: 0 }]] },
  "Supabase: อ่านเคส Sapan รอบก่อน": { main: [[{ node: "เตรียมปิดเคส Sapan รอบก่อน", type: "main", index: 0 }]] },
  "เตรียมปิดเคส Sapan รอบก่อน": { main: [[{ node: "มีเคส Sapan ต้องปิด?", type: "main", index: 0 }]] },
  "มีเคส Sapan ต้องปิด?": { main: [[{ node: "Supabase: ปิดเคส Sapan รอบก่อน", type: "main", index: 0 }], [{ node: "Supabase: ปิดงานสำเร็จ", type: "main", index: 0 }]] },
  "Supabase: ปิดเคส Sapan รอบก่อน": { main: [[{ node: "Supabase: บันทึก Audit ปิด Sapan", type: "main", index: 0 }]] },
  "Supabase: บันทึก Audit ปิด Sapan": { main: [[{ node: "Supabase: ปิดงานสำเร็จ", type: "main", index: 0 }]] },
  "Supabase: ปิดงานสำเร็จ": { main: [[{ node: "จบรอบ Worker", type: "main", index: 0 }]] },
  "บันทึกว่าอ่านแล้วและรอไฟล์": { main: [[{ node: "จบรอบ Worker", type: "main", index: 0 }]] },
};

const workflow = { name: "Audit - Headless Reconciliation Worker - Hybrid PDF", nodes, connections, settings: { executionOrder: "v1", binaryMode: "separate", saveManualExecutions: true }, pinData: {}, active: false };
await writeFile(path.join(root, "n8n/audit-headless-worker.json"), JSON.stringify(workflow, null, 2) + "\n");
// Keep the manual/round worker's embedded parser in lockstep with the tested
// browser parser.  That workflow has its own orchestration graph, so replace
// only the PdfStm source segment inside code nodes that already embed it.
const roundWorkerPath = path.join(root, "n8n/audit-round-worker.json");
const roundWorker = JSON.parse(await readFile(roundWorkerPath, "utf8"));
for (const node of roundWorker.nodes || []) {
  const code = node.parameters?.jsCode;
  if (typeof code !== "string" || !code.includes("const PdfStm")) continue;
  const declaration = code.indexOf("const PdfStm");
  const parserStart = code.lastIndexOf("/*", declaration);
  const parserEnd = code.indexOf("\nconst meta=", declaration);
  if (parserStart < 0 || parserEnd < 0) throw new Error(`หา PdfStm segment ไม่พบใน node ${node.name}`);
  node.parameters.jsCode = code.slice(0, parserStart) + pdf.trim() + code.slice(parserEnd);
}
await writeFile(roundWorkerPath, JSON.stringify(roundWorker, null, 2) + "\n");
console.log(`built n8n/audit-headless-worker.json (${workflow.nodes.length} nodes)`);
