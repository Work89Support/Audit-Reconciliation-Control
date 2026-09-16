/* Read-only candidate screening. Never grants approval or closes cases. */
const PreliminaryReview = (() => {
  const fields = s => String(s || '').split('|').map(x => x.trim());
  const cents = n => n === '' || n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100);
  function candidates(data) {
    const pairs = data?.run?.summary?.match_evidence;
    if (!data?.complete || data.run?.jobStatus !== 'completed' || !Array.isArray(pairs) || pairs.length < Number(data.run.matched || 0)) return new Set();
    const cases = data.cases || [], result = new Set();
    for (const e of cases) {
      const bo = fields(e.bo_raw), stm = fields(e.stm_raw), ref = /(?:^|\s)sapan:\s*([a-f0-9]{24})(?:\s|$)/i.exec(bo[10] || '')?.[1];
      const b = e.customer_details?.bo || {}, s = e.customer_details?.stm || {};
      if (e.status !== 'open' || e.direction !== 'ถอน' || e.ex_type !== 'time_diff' || !e.company || e.run_id !== data.run.id
          || !/^\d{4}-\d{2}-\d{2}$/.test(e.bo_date || '') || e.bo_date !== e.stm_date || e.bo_date !== e.business_date
          || !Number.isFinite(e.time_diff_sec) || e.time_diff_sec < 0 || e.time_diff_sec > 3600
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
  function selectedRows(rows, selected) { return rows.filter(r => r.preliminary && selected.has(r.id)); }
  function total(rows) { return rows.reduce((n, r) => n + (cents(r.case?.system_amount) || 0), 0) / 100; }
  return { candidates, selectedRows, total };
})();
if (typeof module !== 'undefined') module.exports = PreliminaryReview;
