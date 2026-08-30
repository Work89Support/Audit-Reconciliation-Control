import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = async (name) => JSON.parse(await readFile(new URL(`../n8n/${name}`, import.meta.url), "utf8"));
const live = await load("audit-mail-ingest.json");
const backfill = await load("audit-mail-backfill.json");
const daily = await load("audit-daily-reconcile.json");
const worker = await load("audit-headless-worker.json");
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
assert.match(workerText, /p_limit[^}]*1/, "each execution must claim exactly one unambiguous job");
assert.match(workerText, /startOf\('month'\)/, "automatic catch-up must prioritize the current operating month");
assert.equal(worker.connections["Supabase: ตรวจไฟล์และจัดคิว"].main[0][0].node, "รวมเป็นหนึ่งรอบ", "queue RPC rows must collapse before claiming");
assert.equal(worker.connections["รวมเป็นหนึ่งรอบ"].main[0][0].node, "Supabase: จองหนึ่งงาน");
assert.equal(worker.connections["Supabase: ปิดงานสำเร็จ"].main[0][0].node, "จบรอบ Worker");
assert.match(workerText, /จองหนึ่งงาน'\)\.first\(\)/, "processing must use the single claimed job");
assert.match(workerText, /pairedItem/, "code nodes must preserve n8n item linking through nested loops");
assert.doesNotMatch(workerText, /\.first\(0, \$prevNode\.runIndex\)/, "job/file references must not fall back to the first loop item");
assert.match(workerText, /pm_statement:'stm'/, "PM provider reports must be treated as the statement side");
assert.match(workerText, /reconKinds=new Set/, "damage and clarification files must not enter reconciliation quality gate");
assert.match(workerText, /ไม่พบหัวตารางที่รองรับภายใน 30 แถวแรก/, "unsupported headers must fail the parse quality gate");
assert.match(workerText, /acceptedEmptyPm/, "tiny empty PM exports must be accepted as zero transactions");
assert.match(workerText, /ไฟล์ PM ไม่มีรายการ \(0 รายการ\)/, "empty PM exports must have a clear operator message");
assert.match(workerText, /size_bytes/, "the worker must use source size to distinguish empty exports from broken handoff");
assert.match(workerText, /โหนดอ่าน CSV ไม่คืนข้อมูล/, "large CSV handoff failures must remain visible errors");
assert.match(workerText, /row_count:usableRows/, "row_count must contain usable transaction rows, not raw sheet rows");
assert.match(workerText, /record_source_file_parse_results/, "every file parse result must be persisted atomically");
assert.equal(worker.connections["กระทบยอดและสร้าง Exception"].main[0][0].node, "Supabase: บันทึกผลอ่านไฟล์");
assert.equal(worker.connections["Supabase: บันทึกผลอ่านไฟล์"].main[0][0].node, "ไฟล์ผ่าน Quality Gate?");
assert.equal(worker.connections["ไฟล์ผ่าน Quality Gate?"].main[0][0].node, "Supabase: สร้างผลการรัน");
assert.equal(worker.connections["ไฟล์ผ่าน Quality Gate?"].main[1][0].node, "หยุดรอตรวจไฟล์");
assert.equal(worker.connections["Supabase: บันทึก Exception"].main[0][0].node, "Supabase: ปิดงานสำเร็จ");
assert.ok(!worker.nodes.some((node) => node.name === "Supabase: ทำเครื่องหมายไฟล์อ่านแล้ว"));
assert.match(workerText, /n8n-cloud-worker/);
assert.match(workerText, /matchedBoKeys/, "worker must suppress rule exceptions for BO rows already matched by the engine");
assert.match(workerText, /resolvedRuleExceptions/, "worker must keep only unresolved business-rule exceptions");
assert.match(workerText, /worker_version:'1\.2\.3'/, "worker version must identify the cross-day false-positive fix");
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
assert.match(appSource, /Sb\.quality\(\{ from: date, to: date, company, limit: 50 \}\)/, "daily summary must load only the selected company and day");
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
assert.match(appSource, /ไฟล์ใหม่พร้อมบันทึก/, "replacement preview must explain that the new file is waiting for save-and-retry");
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
assert.match(appSource, /f\.kind !== "unknown" && !f\.parse_error/, "the automatic browser worker must exclude problem files");
assert.match(appSource, /isEmptyPmFile/, "the UI must distinguish a valid empty PM export from a failed file");
assert.match(appSource, /ไม่มีรายการ \(0\)/, "valid empty PM exports must have a clear status");

const telegramHourly = telegram.nodes.find((node) => node.name === "สร้างข้อความเมลใหม่");
const telegramDaily = telegram.nodes.find((node) => node.name === "สร้างสรุปรอบวัน");
assert.doesNotThrow(() => new Function(telegramHourly.parameters.jsCode));
assert.doesNotThrow(() => new Function(telegramDaily.parameters.jsCode));
assert.match(telegramHourly.parameters.jsCode, /รายการที่ต้องดำเนินการ/, "hourly alert must lead with an actionable summary");
assert.match(telegramHourly.parameters.jsCode, /อ่านไฟล์ไม่ได้/, "parse failures must be explained in plain Thai");
assert.match(telegramHourly.parameters.jsCode, /ต้องตามไฟล์เพิ่ม/, "missing evidence must be separate from parse failures");
assert.match(telegramHourly.parameters.jsCode, /ฐานข้อมูลล่าสุดก่อนส่งข้อความนี้/, "message must state that counts were checked before sending");
assert.match(telegramDaily.parameters.jsCode, /ผลตรวจเดือนนี้/, "daily alert must scope reconciliation counts to the current month");
assert.match(JSON.stringify(telegram), /is_archived=eq\.false/, "Telegram must exclude archived operating periods");

console.log("n8n workflows: graph, idempotency, secrets and throttling checks passed");
