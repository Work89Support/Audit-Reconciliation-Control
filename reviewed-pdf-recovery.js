/* Shared by n8n and tests. Reviewed source transcription is not case approval. */
const ReviewedPdfRecovery = (() => {
  const fail = message => { throw new Error('PDF recovery: ' + message); };
  const cents = n => {
    if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isSafeInteger(Math.round(n * 100)) || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) fail('invalid monetary value');
    return Math.round(n * 100);
  };
  const dateOK = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  function normalize(recovery, file, job) {
    if (!recovery || recovery.status !== 'approved' || !recovery.approved_by || !recovery.approved_at || !recovery.id) fail('source approval missing');
    const p = recovery.payload;
    if (!p || p.version !== 1 || p.sourceId !== file.id || p.company !== job.company || (file.company && p.company !== file.company) || p.businessDate !== job.business_date || !dateOK(p.businessDate)) fail('source/company/day mismatch');
    if (file.kind !== 'stm_pdf' || !file.checksum || p.sourceChecksum !== file.checksum || !/^[a-f0-9]{64}$/.test(p.pdfSha256 || '')) fail('source checksum missing or changed');
    if (!/^\d{8,16}$/.test(p.account || '') || !['SCB','KBANK'].includes(p.bank)) fail('unverified statement account/bank');
    if (p.coverageReviewed !== true || !p.coverageEvidence || !Array.isArray(p.rows) || !p.rows.length || !Array.isArray(p.expectedRowIds)) fail('source coverage not reviewed');
    const expected = new Set(p.expectedRowIds), seen = new Set();
    if (expected.size !== p.expectedRowIds.length || expected.size !== p.rows.length) fail('coverage count mismatch');
    const records = [], totals = {deposit:{count:0,amount:0},withdraw:{count:0,amount:0}};
    let previousBalance = null, previousStamp = '', previousPage = 0;
    for (const r of p.rows) {
      if (!/^P\d+-R\d+$/.test(r.id || '') || !expected.has(r.id) || seen.has(r.id)) fail('duplicate or unexpected source row');
      seen.add(r.id);
      const page = Number(r.id.match(/^P(\d+)/)[1]);
      if (page < previousPage) fail('source page order changed');
      previousPage = page;
      if (r.reviewed !== true || !dateOK(r.date) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(r.time || '') || !['deposit','withdraw'].includes(r.direction)) fail('unreviewed or invalid row');
      const stamp = r.date + 'T' + (r.time.length === 5 ? r.time + ':00' : r.time);
      if (previousStamp && stamp < previousStamp) fail('transaction order changed');
      previousStamp = stamp;
      const amount = cents(r.amount), balance = cents(r.balance), before = cents(r.previous);
      if (amount <= 0 || balance !== before + (r.direction === 'deposit' ? amount : -amount) || (previousBalance !== null && before !== previousBalance)) fail('running balance does not reconcile');
      previousBalance = balance;
      if (p.bank === 'SCB' && r.code !== (r.direction === 'deposit' ? 'X1' : 'X2')) fail('SCB direction/code mismatch');
      if (typeof r.description !== 'string' || !r.description.trim()) fail('original description missing');
      if ((/รับโอนจาก|โอนจาก/.test(r.description) && r.direction !== 'deposit') || (/โอนไป/.test(r.description) && r.direction !== 'withdraw')) fail('description direction mismatch');
      if (r.last4 != null && (typeof r.last4 !== 'string' || !/^\d{4}$/.test(r.last4))) fail('invalid customer suffix');
      const masked = [...r.description.matchAll(/[xX×*]+\s*(\d{4})(?!\d)/g)].map(m=>m[1]);
      if (r.last4 && (!masked.length || masked.some(s=>s !== r.last4))) fail('customer suffix not supported by description');
      if (r.date !== p.businessDate) continue;
      const t = totals[r.direction]; t.count++; t.amount += amount;
      const [h,m,s='0'] = r.time.split(':'); const sec = +h*3600 + +m*60 + +s;
      records.push({rowNo:records.length+1,source:'stm',formatCode:'stm_pdf',company:p.company,subco:p.company,
        account:p.account,bank:p.bank,channel:p.bank,date:r.date,sourceDate:r.date,sec,amount:r.amount,balance:r.balance,
        direction:r.direction,code:r.code || '',desc:r.description,raw:r.raw || r.description,
        custAccount:null,custAccountLast4:r.last4 || null,custBank:r.customerBank || null,custName:r.customerName || null,
        memberCode:null,username:null,ref:null,customerDescription:r.description,customerIdentitySource:'reviewed-pdf-description',
        minutePrecision:r.time.length===5,noTime:false,crossDay:false,lateNight:sec>=82800,
        recoveryId:recovery.id,sourceRowId:r.id,source_file_id:file.id,source_checksum:file.checksum});
    }
    for (const direction of ['deposit','withdraw']) {
      const control = p.controls?.[direction];
      if (!control || control.count !== totals[direction].count || cents(control.amount) !== totals[direction].amount) fail('daily control totals mismatch');
    }
    if (!records.length) fail('zero activity requires a separate source check');
    return {format:{source:'stm',realCode:'stm_pdf_reviewed'},records,aux:[],dropped:{},
      warnings:['ข้อมูล PDF ผ่านการยืนยันต้นฉบับ — ยังไม่ใช่การอนุมัติปิดเคส'],
      quality:{complete:true,unreadRows:[],invalidRows:[]}};
  }
  return {normalize};
})();
