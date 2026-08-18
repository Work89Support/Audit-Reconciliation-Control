import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = async (name) => JSON.parse(await readFile(new URL(`../n8n/${name}`, import.meta.url), "utf8"));
const live = await load("audit-mail-ingest.json");
const backfill = await load("audit-mail-backfill.json");
const daily = await load("audit-daily-reconcile.json");

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

console.log("n8n workflows: graph, idempotency, secrets and throttling checks passed");
