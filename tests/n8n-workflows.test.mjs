import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = async (name) => JSON.parse(await readFile(new URL(`../n8n/${name}`, import.meta.url), "utf8"));
const live = await load("audit-mail-ingest.json");
const backfill = await load("audit-mail-backfill.json");
const daily = await load("audit-daily-reconcile.json");
const worker = await load("audit-headless-worker.json");
const xbHistoryRerun = await load("audit-xb-history-rerun-20260915-20.json");
const clarification = await load("audit-clarification-matcher.json");
const telegram = await load("audit-telegram-notifications.json");
const clarificationSql = await readFile(new URL("../supabase/20260823_clarification_auto_match.sql", import.meta.url), "utf8");
const parserQualitySql = await readFile(new URL("../supabase/20260823_parser_quality_gate.sql", import.meta.url), "utf8");
const persistenceGuardSql = await readFile(new URL("../supabase/20260927_recon_persistence_guard.sql", import.meta.url), "utf8");
const reclassifySql = await readFile(new URL("../supabase/20260825_manual_file_reclassify.sql", import.meta.url), "utf8");
const replacementSql = await readFile(new URL("../supabase/20260830_source_file_replacement.sql", import.meta.url), "utf8");
const directionSql = await readFile(new URL("../supabase/20260827_filename_direction_detection.sql", import.meta.url), "utf8");
const mailDateSql = await readFile(new URL("../supabase/20260829_mail_subject_date_normalization.sql", import.meta.url), "utf8");
const templateKindSql = await readFile(new URL("../supabase/20260829_template_file_classification.sql", import.meta.url), "utf8");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const docxSource = await readFile(new URL("../docx-reader.js", import.meta.url), "utf8");
const supabaseSource = await readFile(new URL("../supabase.js", import.meta.url), "utf8");

function validateGraph(workflow) {
  const names = new Set(workflow.nodes.map((node) => node.name));
  assert.equal(names.size, workflow.nodes.length, `${workflow.name}: node names must be unique`);
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    assert.ok(names.has(source), `${workflow.name}: missing source node ${source}`);
    for (const lane of outputs.main || []) {
      for (const edge of lane) assert.ok(names.has(edge.node), `${workflow.name}: missing target node ${edge.node}`);
    }
  }
}

validateGraph(live);
validateGraph(backfill);
validateGraph(daily);
validateGraph(worker);
validateGraph(xbHistoryRerun);
const xbHistoryText = JSON.stringify(xbHistoryRerun);
assert.ok(xbHistoryRerun.nodes.some(node => node.type === "n8n-nodes-base.manualTrigger"), "historical rerun must require an explicit manual start");
assert.ok(!xbHistoryRerun.nodes.some(node => node.type === "n8n-nodes-base.scheduleTrigger"), "historical rerun must never create a second schedule");
assert.match(xbHistoryText, /business_date=gte\.2026-09-15/);
assert.match(xbHistoryText, /business_date=lte\.2026-09-20/);
assert.match(xbHistoryText, /company=in\.\(3XB,MC8,MR9,PS8,UR9\)/);
assert.match(xbHistoryText, /retry_daily_recon_job/, "historical jobs must use the audited retry RPC");
assert.equal(worker.nodes.find(node => node.name === "อ่าน Excel").parameters.options.rawData, true,
  "Excel must preserve raw serial dates, not locale-dependent m/d/yy displays");
validateGraph(clarification);
validateGraph(telegram);

const liveText = JSON.stringify(live);
assert.ok(live.nodes.some((node) => node.type === "n8n-nodes-base.executeWorkflowTrigger"));
assert.ok(!live.nodes.some((node) => node.type === "n8n-nodes-base.crypto"));
assert.match(liveText, /Storage path แบบ ASCII-safe/);
assert.deepEqual(live.connections["เดาชนิดไฟล์และตั้ง path"].main[0][0].node, "Supabase Storage: อัปไฟล์");
assert.ok(live.nodes.some((node) => node.name === "Gmail: ติด label ingested"));
assert.match(liveText, /gmail_message_id/);
assert.match(liveText, /on_conflict=gmail_message_id/);
assert.match(liveText, /on_conflict=storage_path/);
assert.doesNotMatch(liveText, /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, "must not embed a JWT/service key");
const subjectParser = live.nodes.find((node) => node.name === "แกะบริษัทและวันที่จากหัวข้อ");
assert.ok(subjectParser.parameters.jsCode.includes("[-/]"), "subject date parser must accept hyphens and slashes");
const classifier = live.nodes.find((node) => node.name === "เดาชนิดไฟล์และตั้ง path");
assert.doesNotThrow(() => new Function(classifier.parameters.jsCode), "attachment classifier must contain valid JavaScript");
assert.ok(classifier.parameters.jsCode.includes("ฝากถอน"), "deposit-withdraw PDFs must be recognized as STM");
assert.match(classifier.parameters.jsCode, /BANK_TOKENS/, "bank PDFs with a holder name and one direction must be recognized as STM");
assert.match(classifier.parameters.jsCode, /toks\.includes\('dw'\)/, "short D/W/DW direction codes must be recognized");
assert.match(classifier.parameters.jsCode, /direction: directionOf/, "the detected direction must follow the attachment into storage metadata");
assert.match(classifier.parameters.jsCode, /รายงานหน้า\\s\*BO/, "BO attachment kind must inherit from the email subject");
assert.match(classifier.parameters.jsCode, /companyOf\(j\.file_name/, "generic BO filenames must resolve company from the attachment name");
assert.match(classifier.parameters.jsCode, /SK8\?/, "the field alias SK must resolve to canonical company SK8");
assert.match(classifier.parameters.jsCode, /CPXM/, "CPXM spreadsheets must be recognized as PM statements");
assert.match(classifier.parameters.jsCode, /\(pdf\|docx\)/, "explicit Word statements must enter statement classification");
const attachmentSplitter = live.nodes.find((node) => node.name === "แยกไฟล์แนบทีละไฟล์");
assert.match(attachmentSplitter.parameters.jsCode, /subject: src\.json\.subject/, "email subject must reach every attachment");
const sourceFileWriter = live.nodes.find((node) => node.name === "Supabase: บันทึกทะเบียนไฟล์");
assert.match(sourceFileWriter.parameters.jsonBody, /company:/, "source files must preserve their operating company");
for (const name of [
  "Supabase: บันทึกทะเบียนเมล",
  "Supabase Storage: อัปไฟล์",
  "Supabase: บันทึกทะเบียนไฟล์",
  "Supabase: อัปเดตสถานะเมล",
]) {
  const node = live.nodes.find((item) => item.name === name);
  assert.equal(node.parameters.options.batching.batch.batchSize, 1, `${name} must not overload Supabase with concurrent requests`);
  assert.ok(node.parameters.options.batching.batch.batchInterval >= 500, `${name} must pause between requests`);
  assert.equal(node.retryOnFail, true, `${name} must retry transient Supabase failures`);
  assert.ok(node.maxTries >= 3, `${name} must allow transient failures to recover`);
}
const mailSummary = live.nodes.find((node) => node.name === "สรุปครั้งเดียวต่อเมล");
assert.ok(mailSummary, "ingest must collapse file results to one status update per email");
assert.match(mailSummary.parameters.jsCode, /new Map\(\)/, "mail status updates must be deduplicated by Gmail message ID");
assert.equal(live.connections["Supabase: บันทึกทะเบียนไฟล์"].main[0][0].node, "สรุปครั้งเดียวต่อเมล");
assert.equal(live.connections["สรุปครั้งเดียวต่อเมล"].main[0][0].node, "Supabase: อัปเดตสถานะเมล");

const listNode = backfill.nodes.find((node) => node.name === "Gmail: ค้นเมลสูงสุด 20 ฉบับ");
assert.equal(listNode.parameters.limit, 20);
assert.match(listNode.parameters.filters.q, /BACKFILL_AFTER/);
assert.match(listNode.parameters.filters.q, /BACKFILL_BEFORE/);
assert.ok(backfill.nodes.some((node) => node.type === "n8n-nodes-base.splitInBatches" && node.parameters.batchSize === 1));
assert.ok(backfill.nodes.some((node) => node.type === "n8n-nodes-base.wait" && node.parameters.amount === 2));

const dailyText = JSON.stringify(daily);
assert.ok(daily.nodes.some((node) => node.type === "n8n-nodes-base.scheduleTrigger"));
assert.match(dailyText, /queue_due_daily_recon_jobs/);
assert.doesNotMatch(dailyText, /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, "daily workflow must not embed a JWT/service key");

const workerText = JSON.stringify(worker);
assert.ok(worker.nodes.some((node) => node.type === "n8n-nodes-base.scheduleTrigger"));
assert.ok(worker.nodes.some((node) => node.type === "n8n-nodes-base.extractFromFile"));
assert.ok(worker.nodes.some((node) => node.name === "อ่าน PDF โดยตรง" && node.parameters.operation === "pdf"), "text PDFs must use native extraction before OCR");
assert.equal(worker.connections["เป็น PDF?"].main[0][0].node, "TMN ตรวจภาพครบแล้ว?", "PDFs must check narrowly scoped visual-review evidence");
assert.equal(worker.connections["TMN ตรวจภาพครบแล้ว?"].main[1][0].node, "อ่าน PDF โดยตรง", "ordinary PDFs must enter the native parser first");
assert.equal(worker.connections["TMN ตรวจภาพครบแล้ว?"].main[0][0].node, "ใช้รายการ TMN ที่ตรวจภาพ", "only verified TMN PDFs may skip OCR");
assert.equal(worker.connections["ใช้รายการ TMN ที่ตรวจภาพ"].main[0][0].node, "แปลงรายการเป็นมาตรฐาน");
assert.match(worker.nodes.find(node => node.name === "เป็น PDF?").parameters.conditions.conditions[0].leftValue, /docx/, "Word statements must enter document OCR");
assert.match(worker.nodes.find(node => node.name === "เลือกไฟล์ของบริษัท").parameters.jsCode, /'docx'/, "worker must select classified Word statements");
assert.match(worker.nodes.find(node => node.name === "Supabase: อ่านรายการไฟล์ของวัน").parameters.url, /business_date=gte/, "worker must read the job day as the lower source boundary");
assert.match(worker.nodes.find(node => node.name === "Supabase: อ่านรายการไฟล์ของวัน").parameters.url, /plus\(\{days:1\}\)/, "worker must inspect one adjacent batch for late KTB statements");
assert.match(worker.nodes.find(node => node.name === "เลือกไฟล์ของบริษัท").parameters.jsCode, /adjacent&&!\(sys123\.has\(jobCompany\)&&ktbStatement\)/, "worker must limit adjacent-day evidence to System 123 KTB statements");
assert.equal(worker.connections["PDF มีข้อความ?"].main[1][0].node, "เตรียม PDF สำหรับ OCR", "scanned PDFs must fall back to OCR");
assert.equal(worker.connections["อ่าน PDF โดยตรง"].main[0][0].node, "ตรวจรายการ PDF ก่อน OCR");
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
const probeCode = worker.nodes.find(node => node.name === "ตรวจรายการ PDF ก่อน OCR").parameters.jsCode;
const probe = new AsyncFunction('$json', '$', probeCode);
const metaForPdf = () => ({item:{json:{file:{file_name:'3XB_STM_SCB.pdf'},job:{business_date:'2026-09-04'}}}});
const pdfHeader = 'SIAM COMMERCIAL BANK\nAccount No. 1234567890\n';
const validPdfText = pdfHeader + '04/09/26 10:00 X1 ENET 100.00 1100.00\nรับโอนจาก KBANK x1234 TEST CUSTOMER';
assert.equal((await probe({text:validPdfText},metaForPdf))[0].json.pdf_readable, true);
assert.equal((await probe({text:pdfHeader+'04/09/26 10:00 X1 ENET 100.00 1100.00'},metaForPdf))[0].json.pdf_readable, true, 'optional SCB counterparty text must not force a complete core transaction through OCR');
const sevenMScanMeta = () => ({item:{json:{file:{file_name:'UFABET7M_STM_SCB_สมภพ_DW_2026-09-23.pdf',kind:'stm_pdf'},job:{business_date:'2026-09-23'}}}});
assert.equal((await probe({text:validPdfText},sevenMScanMeta))[0].json.pdf_readable, true, '7M bank statements with a complete native parse must not be degraded by OCR');
const testedPdfParser = (await readFile(new URL('../pdf-stm.js', import.meta.url), 'utf8')).trim();
for (const workflow of [worker, await load('audit-round-worker.json')]) {
  for (const node of workflow.nodes.filter(n => n.parameters?.jsCode?.includes('const PdfStm'))) {
    assert.ok(node.parameters.jsCode.includes(testedPdfParser), 'embedded PDF parser must match the tested browser parser');
  }
}
for(const text of [pdfHeader.repeat(4), validPdfText+'\n04/09/26 10:01 unreadable', 'scanned']) {
  assert.equal((await probe({text},metaForPdf))[0].json.pdf_readable, false, 'unreadable/partial text must reach OCR even when over 40 characters');
}
assert.equal((await probe({text:validPdfText,error:'extract failed'},metaForPdf))[0].json.pdf_readable, false);
const formatOcr = new AsyncFunction('$input',worker.nodes.find(node => node.name === "จัดผล OCR").parameters.jsCode);
const ocrInput = (...rows) => ({ all: () => rows.map((json) => ({ json })) });
assert.equal((await formatOcr(ocrInput({data:'text'})))[0].json.ocr_confidence,null,'no fabricated OCR confidence');
assert.equal((await formatOcr(ocrInput({error:'OCR unavailable'})))[0].json.error,'OCR unavailable');
assert.equal((await formatOcr(ocrInput({unexpected:'error object'})))[0].json.text,'','JSON/error output must not be interpreted as statement text');
assert.equal((await formatOcr(ocrInput({data:'page 1'},{data:'page 2'})))[0].json.ocr_page_count,2,'all embedded DOCX screenshots must be preserved');
assert.match((await formatOcr(ocrInput({data:'page 1'},{data:'page 2'})))[0].json.text,/page 1\fpage 2/,'embedded DOCX screenshots must remain separate parser pages');
assert.equal(worker.connections["ดาวน์โหลดไฟล์จาก Storage"].main[0][0].node, "คืนชื่อไฟล์ต้นฉบับ", "downloaded binaries must restore the original attachment name");
const originalNameNode = worker.nodes.find((node) => node.name === "คืนชื่อไฟล์ต้นฉบับ");
assert.ok(originalNameNode, "worker must preserve the original Gmail attachment name");
assert.match(originalNameNode.parameters.jsCode, /meta\.file\.file_name/, "the displayed binary name must come from source_files.file_name");
for (const name of ["อ่าน Excel", "อ่าน CSV"]) {
  assert.equal(worker.nodes.find((node) => node.name === name).onError, "continueRegularOutput", `${name} must not stop the entire job when one file is malformed`);
}
assert.match(workerText, /upstreamError/, "extractor failures must become per-file quality errors");
assert.match(workerText, /อ่านไฟล์ไม่สำเร็จ \('/, "quality errors must identify the original attachment name");
assert.ok(worker.nodes.some((node) => node.name === "Google Drive OCR: แปลง PDF"), "Google Drive OCR fallback must remain available for scanned PDFs");
for (const name of ["Google Drive OCR: แปลง PDF", "Google Drive OCR: อ่านข้อความ"]) {
  const node = worker.nodes.find((item) => item.name === name);
  assert.equal(node.parameters.options.batching.batch.batchSize, 1, `${name} must serialize screenshot OCR requests`);
  assert.ok(node.parameters.options.batching.batch.batchInterval >= 1500, `${name} must pause between screenshot OCR requests`);
  assert.equal(node.retryOnFail, true, `${name} must retry transient Google OCR failures`);
  assert.ok(node.maxTries >= 6, `${name} must allow quota and conversion delays to recover`);
  assert.ok(node.waitBetweenTries >= 5000, `${name} must back off before retrying Google OCR`);
}
assert.ok(worker.nodes.filter((node) => node.type === "n8n-nodes-base.splitInBatches").length >= 1);
assert.match(workerText, /claim_daily_recon_jobs/);
assert.match(workerText, /finish_daily_recon_job/);
assert.match(workerText, /create_recon_run_with_timeout/, "large audit evidence must use the transaction-local timeout RPC");
assert.ok(worker.nodes.some((node) => node.name === "เตรียมข้อมูลผลการรัน"), "large run payload must be assembled in a code node, not a complex n8n JSON expression");
assert.equal(worker.connections["ไฟล์ผ่าน Quality Gate?"].main[0][0].node, "เตรียมข้อมูลผลการรัน");
assert.equal(worker.connections["เตรียมข้อมูลผลการรัน"].main[0][0].node, "Supabase: สร้างผลการรัน");
assert.match(workerText, /p_limit[^}]*1/, "each execution must claim exactly one unambiguous job");
assert.match(workerText, /startOf\('month'\)/, "automatic catch-up must prioritize the current operating month");
const queueDueJobs = worker.nodes.find((node) => node.name === "Supabase: ตรวจไฟล์และจัดคิว");
assert.equal(queueDueJobs.retryOnFail, true, "the idempotent queue refresh must retry transient Supabase timeouts");
assert.ok(queueDueJobs.maxTries >= 3, "the queue refresh needs enough retry attempts under load");
assert.ok(queueDueJobs.waitBetweenTries >= 3000, "the queue refresh must pause before retrying Supabase");
assert.equal(worker.connections["Supabase: ตรวจไฟล์และจัดคิว"].main[0][0].node, "Supabase: คืนคิวที่สั่งรันใหม่", "manual reruns must be restored after the automatic quality refresh");
assert.equal(worker.connections["Supabase: คืนคิวที่สั่งรันใหม่"].main[0][0].node, "รวมเป็นหนึ่งรอบ", "queue RPC rows must collapse before claiming");
const restoreManualRerun = worker.nodes.find((node) => node.name === "Supabase: คืนคิวที่สั่งรันใหม่");
assert.equal(restoreManualRerun.parameters.method, "PATCH");
assert.match(restoreManualRerun.parameters.url, /rerun_requested_at=not\.is\.null/);
assert.match(restoreManualRerun.parameters.jsonBody, /rerun_requested_at: null/, "consumed rerun requests must not be restored on every worker tick");
assert.equal(restoreManualRerun.retryOnFail, true, "bulk historical reruns must retry a transient Supabase timeout");
assert.ok(restoreManualRerun.maxTries >= 3, "manual rerun recovery needs enough retry attempts under queue load");
assert.ok(restoreManualRerun.waitBetweenTries >= 3000, "manual rerun recovery must pause before retrying Supabase");
assert.equal(worker.connections["รวมเป็นหนึ่งรอบ"].main[0][0].node, "Supabase: จองหนึ่งงาน");
assert.equal(worker.connections["Supabase: ปิดงานสำเร็จ"].main[0][0].node, "จบรอบ Worker");
assert.match(workerText, /จองหนึ่งงาน'\)\.first\(\)/, "processing must use the single claimed job");
assert.match(workerText, /pairedItem/, "code nodes must preserve n8n item linking through nested loops");
assert.doesNotMatch(workerText, /\.first\(0, \$prevNode\.runIndex\)/, "job/file references must not fall back to the first loop item");
assert.match(workerText, /pm_statement:'stm'/, "PM provider reports must be treated as the statement side");
assert.match(workerText, /healthyNames/, "a healthy later copy must supersede an unreadable file with the same name");
assert.match(workerText, /created_at/, "duplicate attachments must prefer the newest source copy");
assert.match(workerText, /const seenNames=new Set\(\)/, "only the newest readable attachment with a logical file name may enter reconciliation");
assert.match(workerText, /const key=keyOf\(f\.file_name\)/, "a corrected later copy must replace the earlier copy even when its size or checksum changed");
assert.match(workerText, /reconKinds=new Set/, "damage and clarification files must not enter reconciliation quality gate");
assert.match(workerText, /ไม่พบหัวตารางที่รองรับภายใน 30 แถวแรก/, "unsupported headers must fail the parse quality gate");
assert.match(workerText, /acceptedEmptyPm/, "tiny empty PM exports must be accepted as zero transactions");
assert.match(workerText, /acceptedOutOfScopePm/, "XB PM exports containing only providers outside AT\/AZ\/CP\/M must not block the quality gate");
assert.match(workerText, /ไฟล์ PM ไม่มีรายการ \(0 รายการ\)/, "empty PM exports must have a clear operator message");
assert.match(workerText, /size_bytes/, "the worker must use source size to distinguish empty exports from broken handoff");
assert.match(workerText, /โหนดอ่าน CSV ไม่คืนข้อมูล/, "large CSV handoff failures must remain visible errors");
assert.match(workerText, /const attemptedRows=usableRows\+candidateRows/, "DOCX completeness must compare parsed evidence rows, not raw sheet rows");
assert.match(workerText, /parser_version:'1\.9\.69-sys123-last4-primary'/, "every normalized file must identify the parser build that produced it");
assert.match(workerText, /candidate_row_count:candidateRows/, "TMN off-date OCR candidates must be reported separately from usable rows");
assert.match(workerText, /ocr_input_count:items\.length/, "DOCX OCR must report how many embedded images entered OCR");
assert.match(workerText, /OCR Word อ่านภาพไม่ครบ/, "partial DOCX image OCR must fail the quality gate");
assert.match(workerText, /OCR Word อ่านรายการลดลงจากรอบก่อน/, "a DOCX parse regression must preserve the previous accepted result");
assert.match(workerText, /row_count:reportedRowCount/, "a failed DOCX regression must not overwrite the prior accepted row count");
assert.match(workerText, /parserVersionErrors/, "a partially deployed workflow must stop when normalize and reconcile parser versions differ");
assert.match(workerText, /boFirstCoverage\.source_parse=parseResults\.map/, "the run summary must retain per-file parser version, usable rows and dropped controls");
assert.match(workerText, /boFirstCoverage\.worker_version='1\.9\.69-sys123-last4-primary'/,
  "the auditable BO-first summary must identify the complete workflow build");
assert.equal(worker.connections["เตรียม PDF สำหรับ OCR"].main[0][0].node, "เป็น Word ภาพรายการ?");
assert.equal(worker.connections["เป็น Word ภาพรายการ?"].main[0][0].node, "เตรียม Word เป็น ZIP");
assert.equal(worker.connections["เลือกภาพรายการ TMN"].main[0][0].node, "Google Drive OCR: แปลง PDF");
assert.match(workerText, /word\[\\\\\/\]media/, "DOCX statements must OCR their embedded transaction screenshots");
assert.match(workerText, /record_source_file_parse_results/, "every file parse result must be persisted atomically");
assert.equal(worker.connections["กระทบยอดและสร้าง Exception"].main[0][0].node, "Supabase: บันทึกผลอ่านไฟล์");
assert.equal(worker.connections["Supabase: บันทึกผลอ่านไฟล์"].main[0][0].node, "ไฟล์ผ่าน Quality Gate?");
assert.equal(worker.connections["ไฟล์ผ่าน Quality Gate?"].main[0][0].node, "เตรียมข้อมูลผลการรัน");
assert.equal(worker.connections["ไฟล์ผ่าน Quality Gate?"].main[1][0].node, "บันทึกว่าอ่านแล้วและรอไฟล์");
assert.match(workerText, /finish_daily_recon_parse_only/, "an incomplete file set must finish parsing without creating a reconciliation run");
assert.match(workerText, /missing_groups/, "the reconciliation gate must require both file sides before creating a run");
assert.equal(worker.connections["Supabase: บันทึก Exception"].main[0][0].node, "Supabase: ตรวจว่า Exception บันทึกครบ");
assert.equal(worker.connections["Supabase: ตรวจว่า Exception บันทึกครบ"].main[0][0].node, "แบ่งอ่านเคส Sapan ตามประเภท");
assert.match(workerText, /verify_recon_run_exception_count/, "the worker must verify native exception persistence before lifecycle carry-forward");
assert.equal(worker.nodes.find(node => node.name === "Supabase: บันทึก Exception").alwaysOutputData, undefined,
  "an exception insert failure must stop the run instead of being treated as an empty success");
assert.equal(worker.connections["แบ่งอ่านเคส Sapan ตามประเภท"].main[0][0].node, "Supabase: อ่านเคส Sapan รอบก่อน");
assert.equal(worker.connections["Supabase: อ่านเคส Sapan รอบก่อน"].main[0][0].node, "เตรียมปิดเคส Sapan รอบก่อน");
assert.equal(worker.connections["เตรียมปิดเคส Sapan รอบก่อน"].main[0][0].node, "มีเคส Sapan ต้องปิด?");
assert.equal(worker.connections["Supabase: ปิดเคส Sapan รอบก่อน"].main[0][0].node, "Supabase: บันทึก Audit ปิด Sapan");
assert.equal(worker.connections["Supabase: บันทึก Audit ปิด Sapan"].main[0][0].node, "Supabase: ปิดงานสำเร็จ");
assert.ok(!worker.nodes.some((node) => node.name === "Supabase: ทำเครื่องหมายไฟล์อ่านแล้ว"));
assert.match(workerText, /n8n-cloud-worker/);
assert.match(workerText, /matchedBoKeys/, "worker must suppress rule exceptions for BO rows already matched by the engine");
assert.match(workerText, /resolvedRuleExceptions/, "worker must keep only unresolved business-rule exceptions");
assert.match(workerText, /!\(e\.sourceKey&&matchedBoKeys\.has\(e\.sourceKey\)\)/, "every Rules exception for an Engine-matched BO row must be suppressed");
assert.doesNotMatch(workerText, /e\.type==='cross_day'&&e\.sourceKey&&matchedBoKeys/, "matched BO suppression must not be limited to cross-day warnings");
assert.match(workerText, /worker_version:'1\.9\.69-sys123-last4-primary'/, "worker version must identify the deployed reconciliation release");
assert.match(workerText, /sys123_normal_bank_time_column:true/, "worker summary must identify the System 123 bank-time column rule");
assert.match(workerText, /sys123_ktb_next_day_candidate:true/, "worker summary must identify guarded KTB next-day candidates");
assert.match(workerText, /sys123_manual_bank_safe_close:true/, "worker summary must identify approved manual bank auto-close accounts");
assert.match(workerText, /sys123_manual_bank_time_amount:true/, "worker summary must identify bank-time manual matching");
assert.match(workerText, /sys123_customer_identity_tags:true/, "worker summary must identify last-four and customer-name evidence");
assert.match(appSource, /ท้าย 4 \/ ชื่อลูกค้า/, "System 123 exception search must advertise customer identity tags");
assert.match(appSource, /sys123CustomerTags/, "System 123 exception search must include customer identity evidence");
assert.match(workerText, /seven_m_tmn_offdate_reciprocal:true/, "worker summary must record the guarded TMN off-date recovery policy");
assert.match(workerText, /seven_m_docx_ocr_regression_gate:true/, "worker summary must record the DOCX OCR regression guard");
assert.match(workerText, /source_parser_completion:true/, "worker summary must record the source-parser completion release");
assert.match(workerText, /non_success_pm_zero_eligible:true/, "worker summary must record failed-only PM zero-eligible handling");
assert.match(workerText, /pending_only_pm_zero_eligible:true/, "worker summary must record pending-only PM zero-eligible handling");
assert.match(workerText, /sys123_pending_evidence:true/, "worker summary must record the System 123 pending-evidence policy");
assert.match(workerText, /sys123_pending_partial_identity_fallback:true/, "worker summary must record pending partial-identity fallback");
assert.match(workerText, /sys123_generic_provider_inference:true/, "worker summary must record generic System 123 provider inference");
assert.match(workerText, /sys123_short_provider_tokens:true/, "worker summary must record short provider filename tokens");
assert.match(workerText, /fr8_bank_name_reciprocal_near_time:true/, "worker summary must record the FR8 normal-bank name rescue rule");
assert.match(workerText, /xb_provider_duplicate_rows_suppressed:result\.xbProviderDuplicateRowsSuppressed\|\|0/, "worker summary must expose suppressed duplicate provider rows");
assert.match(workerText, /business_date=eq\./, "Sapan lifecycle must search all open cases from the same business date");
assert.match(workerText, /company=in\.\(/, "3XB Sapan history query must include equivalent legacy company labels without consuming the API row cap on unrelated companies");
assert.match(workerText, /run_id=neq\./, "Sapan lifecycle must include orphan cases from failed prior runs while excluding the current run");
assert.doesNotMatch(workerText, /exceptions\?run_id=eq\.'\+old/, "Sapan lifecycle must not be limited to job.last_run_id");
assert.match(workerText, /xb-exact-sapan-provider-id/, "worker must close prior false-open cases using the exact Sapan provider id rule");
assert.match(workerText, /exception_auto_closed_by_exact_provider_id/, "worker must write an audit event when an exact Sapan provider id closes an old case");
assert.match(workerText, /const exactPair=\/\^6aa/, "Sapan lifecycle must use exact provider ids on both matched sides even when another deterministic matcher won");
assert.match(workerText, /strictCovered\.length===sides\.length/, "non-time-diff lifecycle closure must retain strict company and direction safeguards");
assert.match(workerText, /currentExactTimePair=clean\(row\.ex_type\)==='time_diff'&&equalAmount&&sameAmountCovered\.length>0/, "an equal-amount legacy time_diff must close when the new run proves an exact provider-id and amount despite corrupted legacy metadata");
assert.match(workerText, /\['3x','3xb','3xbet'\]\.includes\(c\)\?'3xb':c/, "Sapan lifecycle must normalize equivalent 3XB company labels before closing a matched legacy case");
assert.match(workerText, /select=id,company,direction,ex_type,system_amount,bank_amount/, "Sapan lifecycle must load exception type before applying the time-diff closure rule");
assert.match(workerText, /\['time_diff','missing_stm','missing_bo','cross_day','amount_diff'\]\.map/, "exact Sapan lifecycle closure must split reads by exception class so no class is hidden by the API row cap");
assert.match(workerText, /ex_type=eq\.'\+encodeURIComponent\(\$json\.ex_type\)/, "each Sapan history request must read one exception class at a time");
assert.match(workerText, /onError\":\"continueRegularOutput\"/, "an audit-log write failure must not leave the daily reconciliation job running");
assert.match(workerText, /xb_provider_id_raw_recovery:true/, "worker summary must identify raw XB provider-id recovery");
assert.match(workerText, /xb_provider_signed_amount_close:true/, "worker summary must identify exact Sapan matching across signed BO amounts");
assert.match(workerText, /cp2_provider_alias:true/, "worker summary must identify the CP2 provider alias");
assert.match(workerText, /bank_signed_amount_normalized:true/, "worker summary must identify signed bank amount normalization");
assert.match(workerText, /statement_fee_rows_filtered:true/, "worker summary must identify statement fee filtering");
assert.match(workerText, /tmn_non_customer_rows_filtered:true/, "worker summary must identify TMN fee and balance-row filtering");
assert.match(persistenceGuardSql, /v_saved<>v_expected/, "the persistence guard must reject a partial exception batch");
assert.match(persistenceGuardSql, /not \(e\.previous_exception_id is not null and e\.code like '%-C%'\)/,
  "current exception totals must exclude lifecycle carry copies while retaining linked native current exceptions");
assert.doesNotMatch(persistenceGuardSql, /delete\s+from\s+public\.exceptions/i);
assert.match(workerText, /seven_m_unconfirmed_pending_suppressed:sevenMUnconfirmedPendingRowsSuppressed/, "worker summary must expose excluded unconfirmed 7M COREPAY pending rows");
assert.match(workerText, /const pendingExact=\(s,b\)=>/, "worker must validate pending COREPAY deposits against BO before including them");
assert.match(workerText, /replace\(\/\\\\s\+\/g,' '\)/, "pending COREPAY Ref comparison must normalize whitespace in the deployed worker");
assert.match(workerText, /rows\.length===1&&\(pendingPeers\.get\(rows\[0\]\)\|\|\[\]\)\.length===1/, "pending COREPAY confirmation must remain one-to-one");
assert.match(workerText, /seven_m_internal_transfer_reciprocal:true/, "worker summary must identify reciprocal 7M internal-transfer matching");
assert.match(workerText, /tmn_fundout_preserved:true/, "worker summary must identify preserved TMN fundout evidence");
assert.match(workerText, /internal_transfer_tolerance_sec:300/, "worker summary must record the internal-transfer time window");
assert.match(workerText, /bo_split_rows_preserved:true/, "worker summary must identify BO split payout preservation");
assert.match(workerText, /seven_m_provider_identity_rule:true/, "worker summary must identify the 7M Ref/User/Amount rule");
assert.match(workerText, /sys123_provider_identity_rule:true/, "worker summary must identify the 123 member/account/amount rule");
assert.match(workerText, /sys123_provider_amount_policy:true/, "worker summary must identify provider-specific System 123 amount selection");
assert.match(workerText, /sys123_received_amount_deposit:true/, "worker summary must identify received-amount matching for System 123 deposits");
assert.match(workerText, /sys123_account_tail_fallback:true/, "worker summary must identify the 123 account-tail fallback");
assert.match(workerText, /sys123_partial_identity_reciprocal_near_time:true/, "worker summary must identify the 123 partial-identity reciprocal fallback");
assert.match(workerText, /sys123_fallback_time_tolerance_sec:3600/, "worker summary must expose the safe 60-minute partial-identity window");
assert.match(workerText, /sys123_cyber_withdraw_two_point:true/, "worker summary must identify the 123 Cyberplus withdrawal exception");
assert.match(workerText, /sys123_duplicate_reciprocal_nearest:true/, "worker summary must identify the safe duplicate matcher");
assert.match(workerText, /sys123_duplicate_time_tolerance_sec:3600/, "worker summary must expose the duplicate time window");
assert.match(workerText, /sys123_statement_split_tabs:true/, "worker summary must identify the 123 bank D/W split layout");
assert.match(workerText, /seven_m_pm_near_time_safe_close:true/, "worker summary must identify the safe 7M PM amount/time fallback");
assert.match(workerText, /provider_near_time_tolerance_sec:600/, "worker summary must record the 10-minute PM fallback window");
assert.match(workerText, /seven_m_tmn_split_tabs:true/, "worker summary must identify the 7M TMN split-tab layout");
assert.match(workerText, /seven_m_tmn_screenshot_completeness:true/, "worker summary must identify complete TMN screenshot parsing");
assert.match(workerText, /seven_m_tmn_ocr_reciprocal_repair:true/, "worker summary must identify auditable TMN OCR repair");
assert.match(workerText, /seven_m_tmn_exact_amount_first:true/, "worker summary must prove exact TMN amounts own BO rows before OCR repair");
assert.match(workerText, /seven_m_tmn_duplicate_rows_suppressed:result\.tmnOcrDuplicateRowsSuppressed\|\|0/, "worker summary must expose suppressed duplicate TMN screenshot rows");
assert.match(workerText, /source_file_ocr\(provider,confidence,page_count,line_count,extracted_text,rows,updated_at\)/, "worker must load stored structured OCR evidence with the source file");
assert.match(workerText, /parseStructuredOcr/, "worker must verify structured OCR rows against the current PDF text");
assert.match(workerText, /duplicate_statement_rows_removed/, "worker must report whole-statement duplicate rows removed");
assert.match(workerText, /duplicate_source_rows_removed/, "worker must report duplicate STM or PM rows removed even when file names differ");
assert.match(workerText, /const sourceGroups=new Map\(\)/, "whole-file duplicate detection must cover every STM and PM source, not PDF statements only");
assert.doesNotMatch(workerText, /row\.formatCode!=='stm_pdf'/, "PM files with duplicate content under different names must enter whole-file duplicate detection");
assert.match(workerText, /reciprocal_nearest_any_time:true/, "worker summary must identify any-time unique reciprocal matching");
assert.match(workerText, /bo_transaction_time_primary:true/, "worker summary must identify BO transaction-time matching");
assert.match(workerText, /xb_provider_scope_at_az_cp_m:true/, "worker summary must identify the XB AT/AZ/CP/M scope");
assert.match(workerText, /xb_provider_id_note_rule:true/, "worker summary must identify the XB _id/Sapan note rule");
assert.match(workerText, /xb_provider_id_note_unique:true/, "worker summary must identify the XB one-to-one provider-id guard");
assert.match(workerText, /xb_localpay_3xb_enabled:true/, "worker summary must identify 3XB LOCALPAY activation");
assert.match(workerText, /xb_qpay_inactive:true/, "worker summary must retain QPAY as inactive");
assert.match(workerText, /xb_provider_column_policy:true/, "worker run summary must identify the XB provider column policy");
assert.match(workerText, /audit_visible_case_policy:true/, "worker run summary must identify the Audit-visible case policy");
assert.match(workerText, /isInformationalAuditException/, "worker must not persist informational large-amount alerts for the five XB companies");
const normalizeNode = worker.nodes.find(node => node.parameters?.jsCode?.includes('const detectedSource=norm.format.source'));
const qualityCode = normalizeNode.parameters.jsCode.split("const detectedSource=norm.format.source")[1].split('let tag=Registry.matchFile')[0];
const qualityGate = new Function('norm','rawRows','file','extractedText','parseError','ext','acceptedEmptyPm','Formats',
  "const job={business_date:'2026-09-26'}; const input=[{json:file.ocrMeta||{}}]; const detectedSource=norm.format.source" + qualityCode + '; return {parseError, reportedRowCount, acceptedEmptyStructuredPm, acceptedOutsideDayPm, acceptedEmptyBo, acceptedEmptyStmPdf, acceptedOutsideDayStmPdf, acceptedOutOfScopePm, acceptedNonSuccessPm};');
const checkEmpty = (rows, source, header, text='', kind='bo_main', ext='xlsx') => qualityGate(
  {format:{source},records:[],aux:[]},rows,{kind},text,null,ext,false,{detect:()=>header});
const boHeaderFixture = {headerIdx:0,spec:{side:'bo'}};
const zeroPm = qualityGate({format:{source:'stm'},records:[],aux:[],dropped:{'ยอดเงินเป็นศูนย์':7}}, [['header'],['row']], {kind:'pm_statement'}, '', null, 'xlsx', false, {detect:()=>null});
assert.match(zeroPm.parseError, /ยอดเงินเป็นศูนย์ 7 รายการ/);
assert.match(zeroPm.parseError, /ยังไม่ยืนยันว่าไม่มีธุรกรรม/);
const outsideProviderReason = 'Provider นอกขอบเขต Audit เครือ XB (ใช้ AT/AZ/CP/M และ LOCALPAY เฉพาะ 3XB)';
const localPayOnly = qualityGate({format:{source:'stm'},records:[],aux:[],dropped:{[outsideProviderReason]:12}}, [['id','provider'],['1','localpay']], {kind:'pm_statement'}, '', null, 'xlsx', false, {detect:()=>null});
assert.equal(localPayOnly.parseError, null, 'inactive provider-only XB exports are valid attachments');
assert.equal(localPayOnly.acceptedOutOfScopePm, true);
const inactiveQpayReason = 'QPAY ยังไม่เปิดใช้โดยแอดมิน จึงไม่นำมากระทบยอด';
const qpayOnly = qualityGate({format:{source:'stm'},records:[],aux:[],dropped:{[inactiveQpayReason]:4}}, [['id','provider'],['1','qpay']], {kind:'pm_statement'}, '', null, 'xlsx', false, {detect:()=>null});
assert.equal(qpayOnly.parseError, null, 'QPAY-only export is accepted while admin activation is pending');
assert.equal(qpayOnly.acceptedOutOfScopePm, true);
const mixedPmDrops = qualityGate({format:{source:'stm'},records:[],aux:[],dropped:{[outsideProviderReason]:12,'ไม่มีเวลาที่อ่านได้':1}}, [['id','provider'],['1','localpay']], {kind:'pm_statement'}, '', null, 'xlsx', false, {detect:()=>null});
assert.ok(mixedPmDrops.parseError, 'mixed PM parse failures must still block the quality gate');
const failedPmOnly = qualityGate({format:{source:'stm'},records:[],aux:[],dropped:{'รายการไม่สำเร็จ (PM: fail)':1}}, [['วันเวลา','สถานะ'],['2026-09-24 22:03:06','Fail']], {kind:'pm_statement'}, '', null, 'xlsx', false, {detect:()=>null});
assert.equal(failedPmOnly.parseError, null, 'recognized failed-only PM exports are readable zero-eligible control files');
assert.equal(failedPmOnly.acceptedNonSuccessPm, true);
const emptyPmTemplate = qualityGate(
  {format:{source:'stm',realCode:'pm_provider',headerIdx:1},records:[],aux:[],dropped:{}},
  [['UFABET123'],['Ref Id','User','จำนวนเงิน','สถานะ']],
  {kind:'pm_statement'},'',null,'xlsx',false,{detect:()=>null});
assert.equal(emptyPmTemplate.parseError, null, 'recognized header-only PM template is valid zero activity');
assert.equal(emptyPmTemplate.acceptedEmptyStructuredPm, true);
const unreadablePmBody = qualityGate(
  {format:{source:'stm',realCode:'pm_provider',headerIdx:1},records:[],aux:[],dropped:{'ไม่มีเวลาที่อ่านได้':1}},
  [['UFABET123'],['Ref Id','User','จำนวนเงิน','สถานะ'],['bad','member','100','success']],
  {kind:'pm_statement'},'',null,'xlsx',false,{detect:()=>null});
assert.ok(unreadablePmBody.parseError, 'PM template with a body row that cannot be parsed must still fail');
const outsideDayPm = qualityGate(
  {format:{source:'stm',realCode:'pm_provider',headerIdx:0},records:[],aux:[],dropped:{'วันที่ไม่ตรงกับวันที่ตรวจ':50,'รายการไม่สำเร็จ (PM: create_failed)':4}},
  [['requestTime','status','amount'],['2026-09-25 23:08:15','successed','200']],
  {kind:'pm_statement'},'',null,'csv',false,{detect:()=>null});
assert.equal(outsideDayPm.parseError, null, 'structured PM rows from an adjacent date are readable zero activity for the current job');
assert.equal(outsideDayPm.acceptedOutsideDayPm, true);
const outsideDayWithParserFailure = qualityGate(
  {format:{source:'stm',realCode:'pm_provider',headerIdx:0},records:[],aux:[],dropped:{'วันที่ไม่ตรงกับวันที่ตรวจ':50,'ไม่มีเวลาที่อ่านได้':1}},
  [['requestTime','status','amount'],['bad','successed','200']],
  {kind:'pm_statement'},'',null,'csv',false,{detect:()=>null});
assert.ok(outsideDayWithParserFailure.parseError, 'outside-day control must not hide an unreadable PM row');
const outsideDayStmPdf = qualityGate(
  {format:{source:'stm',realCode:'bbl_pdf'},records:[],aux:[],warnings:[],dropped:{'วันที่ไม่ตรงกับวันที่ตรวจ':79},quality:{complete:true,unreadRows:[],invalidRows:[]}},
  [],{kind:'stm_pdf'},'Statement SCB account 1234 25/09/2026 12:30 รายการ 100.00 balance 900.00',null,'pdf',false,{detect:()=>null});
assert.equal(outsideDayStmPdf.parseError, null, 'fully parsed adjacent-day statement PDF is readable zero activity for the current job');
assert.equal(outsideDayStmPdf.acceptedOutsideDayStmPdf, true);
const docxRegression = qualityGate(
  {format:{source:'stm',realCode:'tmn'},records:[{},{},{}],aux:[],warnings:[],dropped:{},quality:{complete:true,unreadRows:[],invalidRows:[]}},
  [],{kind:'stm_pdf',parsed:true,row_count:5,ocrMeta:{ocr_input_count:2,ocr_page_count:2,ocr_errors:0}},
  'TMN statement 26/09/2026 12:30 amount 100',null,'docx',false,{detect:()=>null});
assert.match(docxRegression.parseError, /อ่านรายการลดลงจากรอบก่อน/);
assert.equal(docxRegression.reportedRowCount, 5, 'a short OCR attempt must retain the previous accepted row count');
const docxPartialImages = qualityGate(
  {format:{source:'stm',realCode:'tmn'},records:[{},{},{},{}],aux:[],warnings:[],dropped:{},quality:{complete:true,unreadRows:[],invalidRows:[]}},
  [],{kind:'stm_pdf',parsed:true,row_count:3,ocrMeta:{ocr_input_count:3,ocr_page_count:2,ocr_errors:1}},
  'TMN statement 26/09/2026 12:30 amount 100',null,'docx',false,{detect:()=>null});
assert.match(docxPartialImages.parseError, /อ่านภาพไม่ครบ/);
assert.equal(docxPartialImages.reportedRowCount, 3, 'a failed OCR attempt must not raise or lower the accepted baseline');
const outsideDayStmPdfIncomplete = qualityGate(
  {format:{source:'stm',realCode:'bbl_pdf'},records:[],aux:[],warnings:[],dropped:{'วันที่ไม่ตรงกับวันที่ตรวจ':79},quality:{complete:false,unreadRows:['bad'],invalidRows:[]}},
  [],{kind:'stm_pdf'},'Statement SCB account 1234 25/09/2026 12:30 รายการ 100.00 balance 900.00',null,'pdf',false,{detect:()=>null});
assert.ok(outsideDayStmPdfIncomplete.parseError, 'outside-day statement control must not hide incomplete PDF extraction');
const failedPmMixed = qualityGate({format:{source:'stm'},records:[],aux:[],dropped:{'รายการไม่สำเร็จ (PM: fail)':1,'ไม่มีเวลาที่อ่านได้':1}}, [['วันเวลา','สถานะ'],['bad','Fail']], {kind:'pm_statement'}, '', null, 'xlsx', false, {detect:()=>null});
assert.ok(failedPmMixed.parseError, 'failed rows mixed with parser errors must still block the quality gate');
assert.ok(checkEmpty([['unsupported']], 'unknown', null).parseError, 'unknown nonempty BO must not become a successful empty file');
assert.equal(checkEmpty([['valid header']], 'bo', boHeaderFixture).parseError, null, 'recognized header-only BO is valid');
assert.ok(checkEmpty([['valid header'],['unreadable transaction']], 'bo', boHeaderFixture).parseError, 'dropped BO rows must not become zero activity');
assert.ok(checkEmpty([], 'stm', null, 'Bank statement account 1234567890 balance 100.00', 'stm_pdf','pdf').parseError, 'statement heading does not prove no transactions');
assert.equal(checkEmpty([], 'stm', null, 'Bank statement account 1234567890 no transactions for this period', 'stm_pdf','pdf').parseError, null);
assert.ok(checkEmpty([], 'stm', null, 'Bank statement no transactions 31/08/2026 12:00 unreadable row', 'stm_pdf','pdf').parseError, 'transaction-like content requires review even with an empty marker');
assert.match(workerText, /source_labels:\[\]/, "BO-first summary must retain full source labels for rechecking");
assert.match(workerText, /acceptedEmptyStmPdf/, "zero-activity STM PDFs must be handled explicitly");
assert.match(workerText, /key=system\+'\|'\+company\+'\|'\+x\.kind/, "BO-first keys must include system and company before provider/account");
assert.match(workerText, /source_file:f\.file\.file_name/, "worker must retain the source filename for each BO-first group");
assert.match(workerText, /method:'BO_FIRST'/, "worker must derive daily requirements from BO records");
assert.match(workerText, /bo_first:boFirstCoverage/, "worker must persist BO-first coverage in the run summary");
assert.doesNotMatch(workerText, /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, "headless worker must not embed a JWT/service key");

const clarificationText = JSON.stringify(clarification);
assert.ok(clarification.nodes.some((node) => node.type === "n8n-nodes-base.scheduleTrigger"));
const clarificationSchedule = clarification.nodes.find((node) => node.type === "n8n-nodes-base.scheduleTrigger");
assert.deepEqual(clarificationSchedule.parameters.rule.interval, [{
  field: "days",
  daysInterval: 1,
  triggerAtHour: 9,
  triggerAtMinute: 30,
}], "clarification matching must run only once daily at 09:30");
assert.ok(clarification.nodes.some((node) => node.type === "n8n-nodes-base.splitInBatches"));
assert.ok(clarification.nodes.some((node) => node.type === "n8n-nodes-base.extractFromFile"));
assert.match(clarificationText, /pending_clarification_files/);
assert.match(clarificationText, /apply_clarification_match/);
assert.match(clarificationText, /p_actor/);
assert.doesNotMatch(clarificationText, /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, "clarification workflow must not embed a JWT/service key");
assert.match(clarificationSql, /e\.business_date = v_date/, "clarification matching must stay within the same business date");
assert.match(clarificationSql, /upper\(coalesce\(e\.company/, "clarification matching must stay within the same company");
assert.match(clarificationSql, /tie_count > 1/, "ambiguous matches must not auto-close");
assert.match(clarificationSql, /v_has_resolution/, "auto-close must require an explicit resolution phrase");
assert.match(clarificationSql, /clarification_auto_close/, "auto-close must write an audit log");
assert.match(parserQualitySql, /record_source_file_parse_results/, "parser quality RPC must be deployed with the worker");
assert.match(parserQualitySql, /error_count > 0/, "parse failures must stay outside the automatic queue");
assert.match(parserQualitySql, /อ่านไฟล์ไม่ผ่าน Quality Gate/, "operators must receive a clear parse failure notification");
assert.match(reclassifySql, /auth\.uid\(\) is null/, "manual reclassification must require an authenticated user");
assert.match(reclassifySql, /parse_error=null/, "manual reclassification must clear the stale parser error");
assert.match(reclassifySql, /jsonb_array_length\(v_job\.missing_groups\)=0/, "retry must wait until the required file groups are complete");
assert.match(reclassifySql, /'reclassify_and_retry'/, "manual reclassification must be written to the audit log");
assert.match(replacementSql, /source_file_replacements/, "file replacement must preserve an immutable audit history");
assert.match(replacementSql, /auth\.uid\(\) is null/, "file replacement must require an authenticated user");
assert.match(replacementSql, /replace_source_file_and_retry/, "file replacement must write an audit event");
assert.match(replacementSql, /old_storage_path/, "file replacement history must preserve the original storage object");
assert.match(directionSql, /audit_file_direction/, "the database must recognize compact D/W/DW direction codes");
assert.match(directionSql, /audit_is_bank_statement_pdf/, "legacy single-direction bank PDFs must be classified as STM");
assert.match(directionSql, /PS8/, "the newest database normalizer must preserve all canonical operating companies");
assert.match(mailDateSql, /normalize_mail_batch_business_date/, "mail dates must be normalized before every database write");
assert.match(mailDateSql, /\(\?:19\|20\)/, "mail dates must recognize ISO subjects before Thai short-year dates");
assert.match(mailDateSql, /y := y \+ 1957/, "Thai two-digit Buddhist years must convert to Gregorian years");
assert.match(templateKindSql, /PM_\[A-Z0-9\]\+_\(D\|W\|DW\)_/, "generic PM templates must work for providers not hard-coded in n8n");
assert.match(templateKindSql, /MANUAL_\(PAYMENT\|CREDIT\|BONUS\)_/, "manual file templates must be reclassified without preview");
assert.match(templateKindSql, /COMMISSION_\(WITHDRAW\|EVIDENCE\)_/, "commission templates must be reclassified without preview");
assert.match(supabaseSource, /reclassifySourceFile/, "the browser client must expose the reclassification RPC");
assert.match(supabaseSource, /replaceSourceFile/, "the browser client must expose safe file replacement");
assert.match(supabaseSource, /method:\s*"DELETE"/, "a failed replacement RPC must remove its orphaned Storage upload");
assert.match(supabaseSource, /ระบบแทนที่ไฟล์ยังตั้งค่าไม่ครบ/, "missing replacement RPC must show a short Thai recovery message");
assert.match(supabaseSource, /function rangedView/, "summary views must support server-side date and company filters");
assert.match(supabaseSource, /Promise\.all\(offsets\.map\(fetchPage\)\)/, "exception pages must load concurrently after the first page");
assert.match(supabaseSource, /daily_recon_jobs\?\$\{jobFilters\.join\("&"\)\}/, "exception summary must resolve current run ids without materializing the slow current-exceptions view");
assert.match(supabaseSource, /rest\/v1\/exceptions\?\$\{filters\.join\("&"\)\}/, "exception summary must read current-run rows directly from the indexed table");
assert.match(appSource, /Sb\.quality\(\{ from: date, to: date, limit: 500 \}\)/, "daily summary must load the selected day for every company in the audit sheet");
assert.match(appSource, /const core = await Promise\.allSettled/, "a slow daily-summary section must not blank the whole report");
assert.match(appSource, /Sb\.currentExceptionsSummary\(\{ from: date, to: date, company, limit: 250 \}\)/, "daily summary must load only a fast first page for the selected company");
assert.match(appSource, /limit: 5000[\s\S]+exportDailyCompanySummary/, "full exception details must be loaded only when the auditor exports");
assert.match(appSource, /id="fileKindSelect"/, "file preview must let the auditor choose the file type");
assert.match(appSource, /id="fileKindHelp"/, "file preview must explain the selected file type");
assert.match(appSource, /Statement หรือรายการเดินบัญชีธนาคาร/, "STM guidance must be visible in file preview");
assert.match(appSource, /id="fileReclassify"/, "file preview must provide a save-and-retry action");
assert.match(appSource, /id="fileReplaceUpload"/, "file preview must let the auditor upload a corrected replacement");
assert.match(appSource, /id="fileReplacementInput"/, "replacement upload must use an explicit local file input");
assert.match(appSource, /pendingReplacementFile = file/, "replacement upload must be staged for auditor review before saving");
assert.match(appSource, /ไฟล์ใหม่พร้อมตรวจ/, "replacement preview must explain that the new file is staged for review");
assert.match(appSource, /file-replacement-compare/, "replacement preview must show old and new files in a readable comparison");
assert.doesNotMatch(appSource, /window\.confirm\([\s\S]{0,250}เตรียมแทนที่ไฟล์/, "replacement review must not use the browser's unstyled confirm dialog");
assert.match(appSource, /replacement\s*\? await Sb\.replaceSourceFile/, "save-and-retry must commit the staged replacement file");
assert.match(appSource, /next-action-bar/, "every operational page must show a recommended next action");
assert.match(appSource, /data-report-date/, "daily report rows must link to their operating-day summary");
assert.match(appSource, /data-scroll-daily="dailyReconcileResult"/, "daily reconciliation status must open the result section");
assert.match(appSource, /updateSourceFileCaches/, "manual file correction must update visible data immediately");
assert.doesNotMatch(appSource, /await Promise\.all\(refreshes\)/, "manual file correction must not block on every page reload");
assert.match(appSource, /DocxReader\.render/, "file preview must render Word documents inside the audit modal");
assert.match(docxSource, /word\/document\.xml/, "DOCX reader must extract the main Word document part");
assert.match(docxSource, /textContent/, "DOCX preview must build safe text nodes instead of trusting document HTML");
assert.doesNotMatch(docxSource, /innerHTML\s*=/, "DOCX reader must not inject document content as HTML");
assert.match(appSource, /pendingCloudInbox/, "the recommended action must open the complete Cloud Inbox before individual files");
assert.match(appSource, /id="cReviewIssues"/, "the complete file list must provide a separate problem-by-problem review action");
assert.match(appSource, /id="problemFileSummary"/, "all problem files must be summarized before individual review starts");
assert.match(appSource, /ไฟล์ที่พบปัญหาทั้งหมด/, "the problem summary must have a clear Thai heading");
assert.match(appSource, /data-cloud-file-view/, "Cloud Inbox must separate ready, waiting and problem files");
assert.match(appSource, /queueableFiles/, "manual processing must only select eligible files");
assert.match(appSource, /ไม่ส่งไปรันจนกว่าจะแก้/, "problem files must be clearly excluded from processing");
assert.match(appSource, /พักไฟล์ปัญหา/, "processing must explicitly hold problem files instead of running them");
assert.doesNotMatch(appSource, /Sb\.claimJob\(/, "browsers must never claim Cloud automatic jobs");
assert.match(appSource, /isEmptyPmFile/, "the UI must distinguish a valid empty PM export from a failed file");
assert.match(appSource, /ไม่มีรายการ \(0\)/, "valid empty PM exports must have a clear status");

const telegramRound = telegram.nodes.find((node) => node.name === "สร้างข้อความสรุปรอบงาน");
const telegramDaily = telegram.nodes.find((node) => node.name === "สร้างสรุปรอบวัน");
const telegramRoundSchedule = telegram.nodes.find((node) => node.name === "รอบงาน 08:15 · 17:05 · 19:15");
const telegramLegacyDaily = telegram.nodes.find((node) => node.name === "ทุกวัน 23:30");
assert.doesNotThrow(() => new Function(telegramRound.parameters.jsCode));
assert.doesNotThrow(() => new Function(telegramDaily.parameters.jsCode));
assert.deepEqual(
  telegramRoundSchedule.parameters.rule.interval.map((rule) => [rule.triggerAtHour, rule.triggerAtMinute]),
  [[8, 15], [17, 5], [19, 15]],
  "Telegram must only summarize at the three operating rounds",
);
assert.equal(telegramLegacyDaily.disabled, true, "legacy 23:30 summary must stay disabled");
assert.match(telegramRound.parameters.jsCode, /รายการที่ต้องดำเนินการ/, "round alert must lead with an actionable summary");
assert.match(telegramRound.parameters.jsCode, /อ่านไฟล์ไม่ได้/, "parse failures must be explained in plain Thai");
assert.match(telegramRound.parameters.jsCode, /ต้องตามไฟล์เพิ่ม/, "missing evidence must be separate from parse failures");
assert.match(telegramRound.parameters.jsCode, /ฐานข้อมูลล่าสุดก่อนส่งข้อความนี้/, "message must state that counts were checked before sending");
assert.match(telegramDaily.parameters.jsCode, /ผลตรวจเดือนนี้/, "daily alert must scope reconciliation counts to the current month");
assert.match(JSON.stringify(telegram), /is_archived=eq\.false/, "Telegram must exclude archived operating periods");

console.log("n8n workflows: graph, idempotency, secrets and throttling checks passed");
