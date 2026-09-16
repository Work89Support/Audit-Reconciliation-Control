/* Explicit Audit approval only; selection itself never changes a case. */
const BulkCaseReview = (() => {
  const fingerprint = row => JSON.stringify([
    row.id, row.company, row.business_date, row.run_id, row.status,
    row.bo_raw, row.stm_raw, row.system_amount, row.bank_amount,
    row.bo_date, row.stm_date, row.time_diff_sec, row.customer_details || {},
  ]);
  async function run(rows, scope, deps) {
    const results = [], seen = new Set();
    for (const selected of rows) {
      if (seen.has(selected.id)) continue;
      seen.add(selected.id);
      const result = {id:selected.id, code:selected.code || selected.id, status:'skipped'};
      try {
        if (deps.cancelled?.()) throw Error('หยุดรายการที่เหลือแล้ว');
        if (!deps.allowed()) throw Error('ไม่มีสิทธิ์อนุมัติ');
        if (selected.company !== scope.company || selected.business_date !== scope.date) throw Error('บริษัทหรือวันที่ไม่ตรงกับชุดที่เลือก');
        const data = await deps.load(scope.company, scope.date);
        const current = data.cases?.find(row => row.id === selected.id);
        if (!current || fingerprint(current) !== fingerprint(selected)) throw Error('ข้อมูลหรือสถานะเปลี่ยน กรุณาตรวจใหม่');
        if (!deps.candidates(data).has(current.id)) throw Error('ไม่ผ่านเกณฑ์ปิดเคสล่าสุด');
        const links = await deps.links(current.id);
        if (!Array.isArray(links) || links.length) throw Error('มีหลักฐานเชื่อมโยง ต้องตรวจทีละเคส');
        if (deps.cancelled?.() || !deps.allowed()) throw Error('หยุดก่อนบันทึก');
        if (!await deps.save(current)) throw Error('ยังยืนยันผลบันทึกไม่ได้ กรุณารีเฟรชก่อนลองใหม่');
        result.status = 'closed';
        result.amount = Number(current.system_amount);
      } catch (error) { result.reason = error.message; }
      results.push(result);
      deps.progress?.(results.length, rows.length);
    }
    return results;
  }
  return {run, fingerprint};
})();
if (typeof module !== 'undefined') module.exports = BulkCaseReview;
