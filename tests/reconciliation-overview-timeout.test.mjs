import assert from 'node:assert/strict';
import fs from 'node:fs';

const supabase = fs.readFileSync(new URL('../supabase.js', import.meta.url), 'utf8');
const start = supabase.indexOf('  async function reconciliationOverview(');
const end = supabase.indexOf('  /* ไฟล์ประกอบของเคส', start);
const overview = supabase.slice(start, end);
const liveSheets = fs.readFileSync(new URL('../mc8-live-sheets.js', import.meta.url), 'utf8');

assert.match(overview, /customer_details->>waiting_source=eq\.true/);
assert.match(overview, /\{includeHistorical:true,recoverRead:true\}/,
  'waiting history must read the indexed base table instead of the active-case projection');
assert.equal((overview.match(/\{includeHistorical:true,recoverRead:true\}/g)||[]).length, 2,
  'current-run cases and waiting history must both avoid the expensive active-case projection');
assert.match(overview, /catch\(error\)\{waitingHistoryError=error\.message;\}/,
  'auxiliary waiting history must not block the committed reconciliation result');
assert.match(overview, /return \{ run, cases, waitingHistory, waitingHistoryError, complete: true/);
assert.match(liveSheets, /ประวัติเคส BO รอ STM บางส่วนยังโหลดไม่ได้/);

console.log('reconciliation overview keeps large committed results visible when waiting history times out');
