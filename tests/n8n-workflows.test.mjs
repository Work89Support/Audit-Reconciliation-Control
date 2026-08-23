import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = async (name) => JSON.parse(await readFile(new URL(`../n8n/${name}`, import.meta.url), "utf8"));
const live = await load("audit-mail-ingest.json");
const backfill = await load("audit-mail-backfill.json");
const daily = await load("audit-daily-reconcile.json");
const worker = await load("audit-headless-worker.json");
const clarification = await load("audit-clarification-matcher.json");
const clarificationSql = await readFile(new URL("../supabase/20260823_clarification_auto_match.sql", import.meta.url), "utf8");

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
assert.ok(classifier.parameters.jsCode.includes("ฝากถอน"), "deposit-withdraw PDFs must be recognized as STM");
assert.match(classifier.parameters.jsCode, /รายงานหน้า\\s\*BO/, "BO attachment kind must inherit from the email subject");
assert.match(classifier.parameters.jsCode, /companyOf\(j\.file_name/, "generic BO filenames must resolve company from the attachment name");
const attachmentSplitter = live.nodes.find((node) => node.name === "แยกไฟล์แนบทีละไฟล์");
assert.match(attachmentSplitter.parameters.jsCode, /subject: src\.json\.subject/, "email subject must reach every attachment");
const sourceFileWriter = live.nodes.find((node) => node.name === "Supabase: บันทึกทะเบียนไฟล์");
assert.match(sourceFileWriter.parameters.jsonBody, /company:/, "source files must preserve their operating company");

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
assert.ok(worker.nodes.filter((node) => node.type === "n8n-nodes-base.splitInBatches").length >= 1);
assert.match(workerText, /claim_daily_recon_jobs/);
assert.match(workerText, /finish_daily_recon_job/);
assert.match(workerText, /p_limit[^}]*1/, "each execution must claim exactly one unambiguous job");
assert.equal(worker.connections["Supabase: ตรวจไฟล์และจัดคิว"].main[0][0].node, "รวมเป็นหนึ่งรอบ", "queue RPC rows must collapse before claiming");
assert.equal(worker.connections["รวมเป็นหนึ่งรอบ"].main[0][0].node, "Supabase: จองหนึ่งงาน");
assert.equal(worker.connections["Supabase: ปิดงานสำเร็จ"].main[0][0].node, "จบรอบ Worker");
assert.match(workerText, /จองหนึ่งงาน'\)\.first\(\)/, "processing must use the single claimed job");
assert.match(workerText, /pairedItem/, "code nodes must preserve n8n item linking through nested loops");
assert.doesNotMatch(workerText, /\.first\(0, \$prevNode\.runIndex\)/, "job/file references must not fall back to the first loop item");
assert.match(workerText, /pm_statement:'stm'/, "PM provider reports must be treated as the statement side");
assert.equal(worker.connections["Supabase: บันทึก Exception"].main[0][0].node, "Supabase: ทำเครื่องหมายไฟล์อ่านแล้ว");
assert.match(workerText, /n8n-cloud-worker/);
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

console.log("n8n workflows: graph, idempotency, secrets and throttling checks passed");
