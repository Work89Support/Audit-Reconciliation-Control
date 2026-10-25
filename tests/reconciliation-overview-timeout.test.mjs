import assert from 'node:assert/strict';
import fs from 'node:fs';

const supabase = fs.readFileSync(new URL('../supabase.js', import.meta.url), 'utf8');
const start = supabase.indexOf('  async function reconciliationOverview(');
const end = supabase.indexOf('  /* ไฟล์ประกอบของเคส', start);
const overview = supabase.slice(start, end);
const primaryStart = supabase.indexOf('  async function readManualPrimary(');
const primaryEnd = supabase.indexOf('  const manualPrimaryCasesPreview', primaryStart);
const primary = supabase.slice(primaryStart, primaryEnd);
const liveSheets = fs.readFileSync(new URL('../mc8-live-sheets.js', import.meta.url), 'utf8');

assert.match(overview, /customer_details->>waiting_source=eq\.true/);
assert.match(overview, /\{includeHistorical:true,recoverRead:true\}/,
  'waiting history must read the indexed base table instead of the active-case projection');
assert.equal((overview.match(/\{includeHistorical:true,recoverRead:true\}/g)||[]).length, 3,
  'current-run, manual-primary case-set and waiting-history reads must avoid the expensive active-case projection');
assert.match(overview, /catch\(error\)\{waitingHistoryError=error\.message;\}/,
  'auxiliary waiting history must not block the committed reconciliation result');
assert.match(overview, /return \{ run, cases, waitingHistory, waitingHistoryError, complete: true/);
assert.match(liveSheets, /ประวัติเคส BO รอ STM บางส่วนยังโหลดไม่ได้/);
assert.match(primary, /manual_primary_results\?company=eq\./,
  'large accepted manual results need an indexed read-only fallback');
assert.match(primary, /sourceCheckError:error\.message/);
assert.match(primary, /ห้ามยืนยันหรือปิดงานจากหน้านี้จนตรวจไฟล์สำเร็จ/);
assert.match(overview, /complete:!run\.primaryResult\.sourceCheckError/,
  'an unverified source snapshot must remain visibly incomplete');
assert.match(overview, /Number\(run\.matched\|\|0\)>1000/,
  'large accepted results must not scan all historical company-day cases');
assert.match(overview, /exceptions\?id=in\.\(/,
  'large accepted results must load only their current case-set IDs');
assert.match(overview, /caseHistoryDeferred=true/);
assert.match(liveSheets, /ประวัติเคสเดิมยังไม่โหลดในหน้านี้/);

console.log('reconciliation overview keeps large committed results visible when waiting history times out');
