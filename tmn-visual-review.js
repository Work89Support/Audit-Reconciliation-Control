/* Explicitly reviewed TMN phone screenshots. This is source transcription,
   not an approval to close reconciliation exceptions. */
const TmnVisualReview = (() => {
  const fail = message => { throw new Error('TMN visual review: ' + message); };
  const money = value => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 ||
        !Number.isSafeInteger(Math.round(value * 100)) ||
        Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) fail('invalid amount');
    return Math.round(value * 100);
  };
  const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  function normalize(evidence, file, job) {
    if (evidence?.provider !== 'tmn_visual_review_v1') fail('review provider missing');
    const p = evidence.rows;
    if (!p || p.version !== 1 || !file.checksum || p.sourceFileId !== file.id || p.sourceChecksum !== file.checksum ||
        p.company !== job.company || p.businessDate !== job.business_date || !isoDate(p.businessDate)) fail('source identity changed');
    if (!/^[a-f0-9]{64}$/.test(p.sourceSha256 || '') ||
        (/^[a-f0-9]{64}$/.test(file.checksum) && p.sourceSha256 !== file.checksum)) fail('PDF hash missing or changed');
    const expectedAccount = p.company === 'UFABET7M' && /รุ่งฟ้า/.test(file.file_name || '') ? '0812792075' :
      p.company === 'UFABET7M' && /สรวิศา/.test(file.file_name || '') ? '0639274201' : '';
    if (file.kind !== 'stm_pdf' || !/(?:^|[_\s-])TMN(?:[_\s-]|$)/i.test(file.file_name || '') ||
        !expectedAccount || p.account !== expectedAccount ||
        !/^\d{10}$/.test(p.account || '') || !Array.isArray(p.pagesReviewed) ||
        !Number.isInteger(p.pageCount) || p.pageCount < 1 || p.pageCount > 500) fail('statement identity invalid');
    if (p.pageCount !== evidence.page_count || p.pagesReviewed.length !== p.pageCount ||
        p.pagesReviewed.some((n, i) => n !== i + 1)) fail('page coverage incomplete');
    if (!Array.isArray(p.rows) || !p.rows.length || p.rows.length > 10000 ||
        typeof p.coverageEvidence !== 'string' || p.coverageEvidence.trim().length < 20 ||
        typeof p.transcribedBy !== 'string' || !p.transcribedBy.trim()) fail('row coverage not reviewed');
    const records = [], ids = new Set(), controls = {deposit:{count:0,cents:0},withdraw:{count:0,cents:0}};
    for (const row of p.rows) {
      if (!/^P\d+-R\d+$/.test(row.id || '') || ids.has(row.id) || row.reviewed !== true) fail('duplicate or unreviewed row');
      ids.add(row.id);
      const page = Number(row.id.match(/^P(\d+)/)[1]);
      if (page < 1 || page > p.pageCount || row.date !== p.businessDate ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time || '') ||
          !['deposit','withdraw'].includes(row.direction) ||
          typeof row.description !== 'string' || !row.description.trim()) fail('invalid source row');
      const amountCents = money(row.amount);
      if (row.internalTransfer && row.direction !== 'withdraw') fail('internal transfer direction invalid');
      controls[row.direction].count++;
      controls[row.direction].cents += amountCents;
      const [hour, minute] = row.time.split(':').map(Number);
      records.push({rowNo:records.length+1,source:'stm',formatCode:'stm_pdf',company:p.company,subco:p.company,
        account:p.account,bank:'TMN',channel:'TMN',date:p.businessDate,sourceDate:p.businessDate,
        sec:hour*3600+minute*60,amount:amountCents/100,balance:null,direction:row.direction,
        username:null,ref:null,code:row.direction==='deposit'?'เงินเข้า':'เงินออก',desc:row.description,
        raw:`${p.businessDate} ${row.time} ${row.direction} ${(amountCents/100).toFixed(2)} ${row.description} [${row.id}]`,
        minutePrecision:true,noTime:false,crossDay:false,lateNight:hour===23,
        internalTransferHint:!!row.internalTransfer,ocrWalletScreenshot:false,
        visualReviewSourceRowId:row.id,visualReviewPage:page,source_file_id:file.id,source_checksum:file.checksum});
    }
    for (const direction of ['deposit','withdraw']) {
      const expected = p.controls?.[direction];
      if (!expected || expected.count !== controls[direction].count || moneyOrZero(expected.amount) !== controls[direction].cents)
        fail('daily control totals mismatch');
    }
    if (p.controls?.excludedFeeCount != null &&
        (!Number.isInteger(p.controls.excludedFeeCount) || p.controls.excludedFeeCount < 0)) fail('fee control invalid');
    return {format:{source:'stm',bank:'TMN',realCode:'stm_pdf_visual_review'},records,aux:[],dropped:{},
      warnings:['TMN read from page-linked visual transcription; reconciliation exceptions remain subject to review'],
      quality:{complete:true,parsedRows:records.length,unreadRows:[],invalidRows:[],visualReview:true,
        sourceFileId:file.id,pageCount:p.pageCount,transcribedBy:p.transcribedBy}};
  }
  function moneyOrZero(value) { return value === 0 ? 0 : money(value); }
  return {normalize};
})();
