/* Read-only candidate screening. Never grants approval or closes cases. */
const PreliminaryReview = (() => {
  const fields = s => String(s || '').split('|').map(x => x.trim());
  const cents = n => n === '' || n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100);
  function candidates(data, { auditApproval = false } = {}) {
    const pairs = data?.run?.summary?.match_evidence;
    if (!data?.complete || data.run?.jobStatus !== 'completed' || !Array.isArray(pairs) || pairs.length < Number(data.run.matched || 0)) return new Set();
    const cases = data.cases || [], result = new Set();
    for (const e of cases) {
      const bo = fields(e.bo_raw), stm = fields(e.stm_raw), ref = /(?:^|\s)sapan:\s*([a-f0-9]{24})(?:\s|$)/i.exec(bo[10] || '')?.[1];
      const b = e.customer_details?.bo || {}, s = e.customer_details?.stm || {};
      if (e.status !== 'open' || e.direction !== 'ถอน' || !(auditApproval ? ['time_diff','cross_day'].includes(e.ex_type) : e.ex_type === 'time_diff') || !e.company || e.run_id !== data.run.id
          || !/^\d{4}-\d{2}-\d{2}$/.test(e.bo_date || '') || !/^\d{4}-\d{2}-\d{2}$/.test(e.stm_date || '')
          || (!auditApproval && (e.bo_date !== e.stm_date || e.bo_date !== e.business_date
            || !Number.isFinite(e.time_diff_sec) || e.time_diff_sec < 0 || e.time_diff_sec > 3600))
          || !/^\d{6,12}$/.test(bo[0] || '') || !ref || !stm.includes(bo[0]) || !stm.includes(ref)
          || bo[3] !== 'ออโต้' || stm[3] !== 'SUCCESSED' || !stm[0]
          || !e.account || e.account.toLowerCase() !== (stm[2] || '').toLowerCase()
          || !(cents(e.system_amount) > 0) || [e.bank_amount, bo[6], stm[1]].some(n => cents(n) !== cents(e.system_amount))
          || (s.user && String(s.user).toLowerCase() !== String(b.user || '').toLowerCase())
          || (b.account && s.account && b.account !== s.account)) continue;
      if (cases.some(other => other.id !== e.id && (fields(other.bo_raw)[0] === bo[0] || fields(other.stm_raw)[0] === stm[0]))) continue;
      if (pairs.some(p => p.customer?.bo?.reference === bo[0] || p.customer?.stm?.reference === stm[0])) continue;
      result.add(e.id);
    }
    return result;
  }
  // Explicit human approval is distinct from automatic screening. Time and day
  // differences are not a veto; source identity, amounts and uniqueness still are.
  function manualCandidates(data) {
    const result = candidates(data, {auditApproval:true});
    const pairs = data?.run?.summary?.match_evidence;
    if (!data?.complete || data.run?.jobStatus !== 'completed' || !Array.isArray(pairs)
        || pairs.length < Number(data.run.matched || 0)) return result;
    const norm = value => String(value || '').trim().toLowerCase();
    const real = value => !!norm(value) && !/^[—–-]|ไม่พบรายการ|ไม่ต้องใช้\s*statement|ตรวจจากรายงานหลังบ้าน/i.test(norm(value));
    const same = (a,b) => !!norm(a) && norm(a) === norm(b);
    for (const e of data.cases || []) {
      const b=e.customer_details?.bo || {}, s=e.customer_details?.stm || {};
      if(e.status!=='open' || !['time_diff','cross_day'].includes(e.ex_type) || e.run_id!==data.run.id
        || !e.company || !e.account || !['ฝาก','ถอน'].includes(e.direction)
        || !real(e.bo_raw) || !real(e.stm_raw) || /\b(?:PARTIAL|FAILED|PENDING|CANCELLED)\b/i.test(e.stm_raw)
        || !e.bo_date || !e.stm_date || !(cents(e.system_amount)>0)
        || cents(e.system_amount)!==cents(e.bank_amount)) continue;
      if ((b.user && s.user && !same(b.user,s.user)) || (b.account && s.account && !same(b.account,s.account))) continue;
      const identity = same(b.reference,s.reference)
        || (same(b.user,s.user) && same(b.account,s.account) && norm(b.account).replace(/\D/g,'').length>=6);
      if(!identity) continue;
      const duplicate = (data.cases || []).some(o => o.id!==e.id && (
        same(o.bo_raw,e.bo_raw) || same(o.stm_raw,e.stm_raw)
        || (b.reference && same(o.customer_details?.bo?.reference,b.reference))
        || (s.reference && same(o.customer_details?.stm?.reference,s.reference))));
      const used = pairs.some(p => (b.reference && same(p.customer?.bo?.reference,b.reference))
        || (s.reference && same(p.customer?.stm?.reference,s.reference)));
      // Without unique per-source references we cannot exclude a reused row in
      // already matched evidence, even if account/user/amount happen to agree.
      if(!b.reference || !s.reference || duplicate || used) continue;
      result.add(e.id);
    }
    return result;
  }
  function selectedRows(rows, selected) { return rows.filter(r => r.preliminary && selected.has(r.id)); }
  function total(rows) { return rows.reduce((n, r) => n + (cents(r.case?.system_amount) || 0), 0) / 100; }
  return { candidates, manualCandidates, selectedRows, total };
})();
if (typeof module !== 'undefined') module.exports = PreliminaryReview;
