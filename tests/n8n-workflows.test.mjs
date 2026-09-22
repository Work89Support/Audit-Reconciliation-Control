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
assert.equal(worker.connections["เป็น PDF?"].main[0][0].node, "อ่าน PDF โดยตรง", "PDFs must enter the native parser first");
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
const formatOcr = new AsyncFunction('$json',worker.nodes.find(node => node.name === "จัดผล OCR").parameters.jsCode);
assert.equal((await formatOcr({data:'text'}))[0].json.ocr_confidence,null,'no fabricated OCR confidence');
assert.equal((await formatOcr({error:'OCR unavailable'}))[0].json.error,'OCR unavailable');
assert.equal((await formatOcr({unexpected:'error object'}))[0].json.text,'','JSON/error output must not be interpreted as statement text');
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
assert.doesNotMatch(restoreManualRerun.parameters.jsonBody, /rerun_requested_at: null/, "manual rerun priority must survive until the newest request is claimed");
assert.equal(restoreManualRerun.retryOnFail, true, "bulk historical reruns must retry a transient Supabase timeout");
assert.ok(restoreManualRerun.maxTries >= 3, "manual rerun recovery needs enough retry attempts under queue load");
assert.ok(restoreManualRerun.waitBetweenTries >= 3000, "manual rerun recovery must pause before retrying Supabase");
assert.equal(worker.connections["รวมเป็นหนึ่งรอบ"].main[0][0].node, "Supabase: จองหนึ่งงาน");
assert.equal(worker.connections["Supabase: ปิดงานสำเร็จ"].main[0][0].node, "จบรอบ Worker");
assert.match(workerText, /จองหนึ่งงาน'\)\.first\(\)/, "processing must use the single claimed job");
assert.match(workerText, /pairedItem/, "code nodes must preserve n8n item linking through nested loops");
assert.doesNotMatch(workerText, /\.first\(0, \$prevNode\.runIndex\)/, "job/file references must not fall back to the first loop item");
assert.match(workerText, /pm_statement:'stm'/, "PM provider reports must be treated as the statement side");
assert.match(workerText, /reconKinds=new Set/, "damage and clarification files must not enter reconciliation quality gate");
assert.match(workerText, /ไม่พบหัวตารางที่รองรับภายใน 30 แถวแรก/, "unsupported headers must fail the parse quality gate");
assert.match(workerText, /acceptedEmptyPm/, "tiny empty PM exports must be accepted as zero transactions");
assert.match(workerText, /acceptedOutOfScopePm/, "XB PM exports containing only providers outside AT\/AZ\/CP\/M must not block the quality gate");
assert.match(workerText, /ไฟล์ PM ไม่มีรายการ \(0 รายการ\)/, "empty PM exports must have a clear operator message");
assert.match(workerText, /size_bytes/, "the worker must use source size to distinguish empty exports from broken handoff");
assert.match(workerText, /โหนดอ่าน CSV ไม่คืนข้อมูล/, "large CSV handoff failures must remain visible errors");
assert.match(workerText, /row_count:usableRows/, "row_count must contain usable transaction rows, not raw sheet rows");
assert.match(workerText, /record_source_file_parse_results/, "every file parse result must be persisted atomically");
assert.equal(worker.connections["กระทบยอดและสร้าง Exception"].main[0][0].node, "Supabase: บันทึกผลอ่านไฟล์");
assert.equal(worker.connections["Supabase: บันทึกผลอ่านไฟล์"].main[0][0].node, "ไฟล์ผ่าน Quality Gate?");
assert.equal(worker.connections["ไฟล์ผ่าน Quality Gate?"].main[0][0].node, "เตรียมข้อมูลผลการรัน");
assert.equal(worker.connections["ไฟล์ผ่าน Quality Gate?"].main[1][0].node, "บันทึกว่าอ่านแล้วและรอไฟล์");
assert.match(workerText, /finish_daily_recon_parse_only/, "an incomplete file set must finish parsing without creating a reconciliation run");
assert.match(workerText, /missing_groups/, "the reconciliation gate must require both file sides before creating a run");
assert.equal(worker.connections["Supabase: บันทึก Exception"].main[0][0].node, "Supabase: ปิดงานสำเร็จ");
assert.ok(!worker.nodes.some((node) => node.name === "Supabase: ทำเครื่องหมายไฟล์อ่านแล้ว"));
assert.match(workerText, /n8n-cloud-worker/);
assert.match(workerText, /matchedBoKeys/, "worker must suppress rule exceptions for BO rows already matched by the engine");
assert.match(workerText, /resolvedRuleExceptions/, "worker must keep only unresolved business-rule exceptions");
assert.match(workerText, /worker_version:'1\.5\.19-audit-manual-parity'/, "worker version must identify the Audit manual parity release");
assert.match(workerText, /cp2_provider_alias:true/, "worker summary must identify the CP2 provider alias");
assert.match(workerText, /bank_signed_amount_normalized:true/, "worker summary must identify signed bank amount normalization");
assert.match(workerText, /statement_fee_rows_filtered:true/, "worker summary must identify statement fee filtering");
assert.match(workerText, /bo_split_rows_preserved:true/, "worker summary must identify BO split payout preservation");
assert.match(workerText, /seven_m_provider_identity_rule:true/, "worker summary must identify the 7M Ref/User/Amount rule");
assert.match(workerText, /seven_m_pm_near_time_safe_close:true/, "worker summary must identify the safe 7M PM amount/time fallback");
assert.match(workerText, /provider_near_time_tolerance_sec:600/, "worker summary must record the 10-minute PM fallback window");
assert.match(workerText, /seven_m_tmn_split_tabs:true/, "worker summary must identify the 7M TMN split-tab layout");
assert.match(workerText, /source_file_ocr\(provider,confidence,page_count,line_count,extracted_text,rows,updated_at\)/, "worker must load stored structured OCR evidence with the source file");
assert.match(workerText, /parseStructuredOcr/, "worker must verify structured OCR rows against the current PDF text");
assert.match(workerText, /duplicate_statement_rows_removed/, "worker must report whole-statement duplicate rows removed");
assert.match(workerText, /reciprocal_nearest_any_time:true/, "worker summary must identify any-time unique reciprocal matching");
assert.match(workerText, /bo_transaction_time_primary:true/, "worker summary must identify BO transaction-time matching");
assert.match(workerText, /xb_provider_scope_at_az_cp_m:true/, "worker summary must identify the XB AT/AZ/CP/M scope");
assert.match(workerText, /xb_localpay_3xb_enabled:true/, "worker summary must identify 3XB LOCALPAY activation");
assert.match(workerText, /xb_qpay_inactive:true/, "worker summary must retain QPAY as inactive");
assert.match(workerText, /xb_provider_column_policy:true/, "worker run summary must identify the XB provider column policy");
assert.match(workerText, /audit_visible_case_policy:true/, "worker run summary must identify the Audit-visible case policy");
assert.match(workerText, /isInformationalAuditException/, "worker must not persist informational large-amount alerts for the five XB companies");
const normalizeNode = worker.nodes.find(node => node.parameters?.jsCode?.includes('const detectedSource=norm.format.source'));
const qualityCode = normalizeNode.parameters.jsCode.split("const detectedSource=norm.format.source")[1].split('let tag=Registry.matchFile')[0];
const qualityGate = new Function('norm','rawRows','file','extractedText','parseError','ext','acceptedEmptyPm','Formats',
  "const detectedSource=norm.format.source" + qualityCode + '; return {parseError, acceptedEmptyBo, acceptedEmptyStmPdf, acceptedOutOfScopePm};');
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
