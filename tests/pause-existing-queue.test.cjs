const assert=require('node:assert/strict');
const fs=require('node:fs');
const ui=require('../file-run-management.js');

const queued=ui.runNotice({
 job:{status:'queued',last_run_id:'accepted-run'},
 hold:{paused:true,reason:'พบไฟล์ส่งผิดวันหลังปิดเคสแล้ว'},
 manualOnly:false,
});
assert.equal(queued.title,'พักบอทแล้ว · คิวเดิมหยุดรอตรวจ');
assert.equal(queued.blocked,false);
assert.match(queued.next,/ผลหลักเดิมและเคสที่ปิดแล้วไม่เปลี่ยน/);

const running=ui.runNotice({
 job:{status:'running',last_run_id:'accepted-run'},
 hold:{paused:true,reason:'พักก่อนรอบวันถัดไป'},
 manualOnly:false,
});
assert.match(running.title,/คิวเดิมหยุดรอตรวจ/);

const guide=ui.fieldGuideHtml('MR9','2026-11-17');
assert.match(guide,/MR9 · 2026-11-17/);
assert.match(guide,/ไม่ลบผลกระทบยอด ไม่เปิดเคสที่ปิดแล้ว และไม่แก้ยอด/);
assert.match(guide,/รอบวันถัดไปเดินแยกกัน/);

const sql=fs.readFileSync('supabase/20261119_pause_existing_queue_on_hold.sql','utf8');
assert.match(sql,/status=case when status='completed' then 'completed' else 'needs_review' end/);
assert.match(sql,/claimed_at=null,claimed_by=null,rerun_requested_at=null/);
assert.match(sql,/create trigger audit_hold_daily_job_queue/);
assert.match(sql,/accepted_result_preserved',true,'cases_unchanged',true/);
assert.doesNotMatch(sql,/update public\.(recon_runs|exceptions|case_evidence)|delete from public\./i);

const transport=fs.readFileSync('supabase.js','utf8');
assert.match(transport,/\['queued','needs_review','error','waiting_files'\]\.includes\(job\.status\)/);
assert.match(transport,/if\(!\['completed','running'\]\.includes\(jobs\[0\]\.status\)\)/);

console.log('PASS pause parks existing queue, clears rerun markers, preserves accepted results/cases, and exposes the field runbook');
