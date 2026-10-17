// Approved, page-linked SCB transcription. No matching or case writes occur here.
const ScbVisualReview = (() => {
 const fail=m=>{throw new Error('SCB visual review: '+m);};
 const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const integer=(n,positive=false)=>Number.isSafeInteger(n)&&(positive?n>0:n>=0);
 function normalize(evidence,file,job){
  const p=evidence?.rows;
  if(evidence?.provider!=='scb_visual_review_v1'||p?.version!==1)fail('provider/version missing');
  if(file.kind!=='stm_pdf'||file.ext!=='pdf'||!/(?:^|[_\s-])SCB(?:[_\s-]|$)/i.test(file.file_name||''))fail('not an SCB PDF');
  if(!job.id||p.company!==job.company||p.businessDate!==job.business_date||!day(p.businessDate))fail('job scope changed');
  if(!/^[a-f0-9]{64}$/.test(file.downloadSha256||'')||p.sourceSha256!==file.downloadSha256||p.sourceFileId!==file.id||p.sourceStoragePath!==file.storage_path||
     (/^[a-f0-9]{64}$/.test(file.checksum||'')&&p.sourceSha256!==file.checksum))fail('source identity/hash changed');
  if(p.approvedForRead!==true||!p.approvedBy||!p.approvalReference||!Number.isFinite(Date.parse(p.approvedAt)))fail('read approval missing');
  if(!/^\d{10}$/.test(p.account||'')||!p.coverageEvidence||!Array.isArray(p.pages)||!p.pages.length||p.pages.length!==evidence.page_count)fail('page/account coverage missing');
  if(!Array.isArray(p.rows)||!p.rows.length||p.rows.length>10000||p.expectedTotalRows!==p.rows.length)fail('row coverage incomplete');
  const pages=new Set(),ids=new Set(),records=[],totals={},seenDates=new Set();let at=0,previous=null,outside=0;
  for(const page of p.pages){
   if(!Number.isInteger(page.page)||page.page<1||pages.has(page.page)||!integer(page.rowCount,true)||!integer(page.openingCents)||!integer(page.closingCents))fail('invalid/duplicate page');
   pages.add(page.page);
   if(previous!==null&&previous!==page.openingCents)fail('page continuity mismatch');
   previous=page.openingCents;let debit=0,credit=0;
   for(let row=1;row<=page.rowCount;row++){
    const r=p.rows[at++];
    if(!r||r.page!==page.page||r.printedRow!==row||r.id!==`P${page.page}-R${row}`||ids.has(r.id)||r.reviewed!==true)fail('missing/duplicate/unreviewed row');
    ids.add(r.id);if(!day(r.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time||'')||!['deposit','withdraw'].includes(r.direction)||!integer(r.amountCents,true)||!integer(r.balanceCents)||r.channel!=='ENET'||r.code!==(r.direction==='deposit'?'X1':'X2'))fail('invalid financial row');
    if(r.date>p.businessDate||r.date<p.businessDate.slice(0,8)+'01')fail('unexpected statement date');
    seenDates.add(r.date);const amount=r.amountCents,signed=r.direction==='deposit'?amount:-amount;
    if(previous+signed!==r.balanceCents)fail('running balance mismatch');
    previous=r.balanceCents;if(r.direction==='deposit')credit+=amount;else debit+=amount;
    const t=totals[r.date]||(totals[r.date]={count:0,depositCents:0,withdrawCents:0});t.count++;t[r.direction==='deposit'?'depositCents':'withdrawCents']+=amount;
    if(r.date!==p.businessDate){outside++;continue;}
    const [h,m]=r.time.split(':').map(Number);
    records.push({rowNo:at,source:'stm',formatCode:'stm_pdf',company:p.company,subco:p.company,account:p.account,bank:'SCB',channel:'SCB',
     date:r.date,sourceDate:r.date,sec:h*3600+m*60,amount:amount/100,balance:r.balanceCents/100,direction:r.direction,
     username:null,ref:null,code:r.code,desc:`SCB ${r.code} ENET [${r.id}]`,raw:`${r.date} ${r.time} ${r.code} ENET ${(amount/100).toFixed(2)} ${(r.balanceCents/100).toFixed(2)} [${r.id}]`,
     minutePrecision:true,noTime:false,crossDay:false,lateNight:h===23,page:r.page,visualReviewSourceRowId:r.id,
     visualReviewDescriptionsCertified:false,source_file_id:file.id,source_checksum:p.sourceSha256});
   }
   if(previous!==page.closingCents||page.depositCents!==credit||page.withdrawCents!==debit)fail('printed page controls mismatch');
  }
  if(at!==p.rows.length||!records.length||!p.controls||Object.keys(p.controls).length!==seenDates.size)fail('statement coverage mismatch');
  for(const [d,t] of Object.entries(totals)){const c=p.controls[d];if(!c||c.count!==t.count||c.depositCents!==t.depositCents||c.withdrawCents!==t.withdrawCents)fail('daily controls mismatch');}
  return {format:{source:'stm',bank:'SCB',realCode:'stm_pdf_visual_review'},records,aux:[],
   dropped:outside?{'วันที่ไม่ตรงกับวันที่ตรวจ':outside}:{},
   warnings:[`SCB ใช้ผลอ่านที่ยืนยันตามภาพ ${p.rows.length} แถว; วันตรวจ ${records.length} แถว; แยกวันข้างเคียง ${outside} แถว`,
    'ผลอ่านนี้ยืนยันวันที่ เวลา รหัส ทิศทาง จำนวนเงิน และยอดคงเหลือ ไม่เติมรหัสลูกค้าหรือข้อความคู่โอนที่ยังไม่รับรอง; ผลกระทบยอดต้องรอหัวหน้า/Admin ยืนยัน'],
   quality:{complete:true,parsedRows:p.rows.length,unreadRows:[],invalidRows:[],visualReview:true,sourceFileId:file.id,sourceSha256:p.sourceSha256,
    pageCount:p.pages.length,pageContinuityVerified:true,runningBalancesVerified:true,readApprovalReference:p.approvalReference,descriptionsCertified:false}};
 }
 return {normalize};
})();
if(typeof module!=='undefined')module.exports=ScbVisualReview;
