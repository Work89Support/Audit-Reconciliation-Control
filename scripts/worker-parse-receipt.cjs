'use strict';
// A failed Quality Gate deliberately has result=null. Persist its file receipts
// without manufacturing an empty waiting-BO snapshot or dereferencing result.
function parseReceiptPayload(x) {
  if (!x?.job?.id || !Array.isArray(x.files)) throw Error('Missing parse receipt scope');
  const summary=x.result?.summary;
  const snapshot=summary && !(x.quality_errors||[]).length
    ? {company:x.job.company,business_date:x.job.business_date,waiting_bo:summary.waiting_bo||[],waiting_bo_version:1,worker_version:summary.worker_version}
    : null;
  return {p_job_id:x.job.id,p_results:x.files.map((f,i)=>i===0&&snapshot?{...f,bo_waiting_snapshot:snapshot}:f)};
}
function qualityFailureMessage(errors) {
  if (!Array.isArray(errors)||!errors.length) return null;
  return 'ไม่ผ่าน Quality Gate — ยังไม่ใช้ผล: '+errors.slice(0,10).map(e=>
    String(e.file_name||e.bank||'ไฟล์ต้นทาง').replace(/[\r\n]/g,' ').slice(0,180)+': '+
    String(e.parse_error||e.reason||'ข้อมูลไม่ครบ').replace(/[\r\n]/g,' ').slice(0,500)
  ).join(' | ');
}
module.exports={parseReceiptPayload,qualityFailureMessage};
