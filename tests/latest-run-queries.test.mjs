import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../supabase.js", import.meta.url), "utf8");
const boFirst = source.slice(source.indexOf("  async function boFirstCoverage("), source.indexOf("  async function currentExceptions("));
const current = source.slice(source.indexOf("  async function currentExceptions("), source.indexOf("  async function currentExceptionsSummary("));
const exceptions = source.slice(source.indexOf("  async function currentExceptionsSummary("), source.indexOf("  async function searchExceptions("));
const search = source.slice(source.indexOf("  async function searchExceptions("), source.indexOf("  async function exceptionDetail("));
const evidence = source.slice(source.indexOf("  const evidenceRecommendations ="), source.indexOf("  async function evidenceCaseRecommendations("));

assert.match(boFirst, /daily_recon_jobs/);
assert.match(boFirst, /last_run_id=not\.is\.null/);
assert.match(boFirst, /recon_runs\?id=in/);
assert.doesNotMatch(boFirst, /v_bo_first_daily_coverage/);
assert.match(exceptions, /is_archived=eq\.false/);
assert.doesNotMatch(exceptions, /status=eq\.completed/);
assert.match(current, /daily_recon_jobs/);
assert.match(current, /\/rest\/v1\/exceptions/);
assert.doesNotMatch(current, /v_current_exceptions/);
assert.match(search, /daily_recon_jobs/);
assert.match(search, /superseded_by_exception_id=is\.null/);
assert.doesNotMatch(search, /v_current_exceptions/);
assert.match(evidence, /\{fileId, date, from, to, company, limit = 2000\}/);
assert.match(evidence, /business_date=gte/);
assert.match(evidence, /business_date=lte/);
assert.match(evidence, /payer_company\.eq\.\$\{company\}/);

console.log("latest-run queries: bounded BO-first and needs-review visibility passed");
