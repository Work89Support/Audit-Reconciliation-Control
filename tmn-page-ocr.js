/* Page-linked OCR only. No network, database, case or financial writes. */
const TmnPageOcr = (() => {
  const fail = message => { throw Error('TMN page OCR: ' + message); };
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const sha = x => /^[a-f0-9]{64}$/.test(x || '');
  const iso = x => /^\d{4}-\d{2}-\d{2}$/.test(x || '') && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
  const clean = s => String(s || '').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim();
  function dateOf(s) {
    const m = s.match(new RegExp('(\\d{1,2})\\s+(' + months.join('|') + ')\\s+(\\d{4})'));
    if (!m) return null;
    let y = +m[3]; if (y > 2400) y -= 543;
    const d = y + '-' + String(months.indexOf(m[2])+1).padStart(2,'0') + '-' + m[1].padStart(2,'0');
    if (!iso(d)) fail('invalid calendar heading');
    return d;
  }
  const eventType = s => /ค่าธรรมเนียม/.test(s) ? 'fee' : /รับเงินจาก|รับโอนเงิน|เงินโอนเข้า|เติมเงินเข้า/.test(s) ? 'deposit' : /โอนเงินออก|โอนเงินให้|ส่งเงินให้|ถอนเงิน|จ่ายเงิน|ชำระเงิน/.test(s) ? 'withdraw' : null;
  const amounts = s => [...s.matchAll(/(?:^|\s)([+\-−])\s*(?:฿|B|บาท)?\s*(\d[\d,]*\.\d{2})(?=\s|$)/gi)];
  const times = s => [...s.matchAll(/(?:^|\s)((?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)(?=\s|$)/g)].map(m=>m[1]);
  const centsOf = s => {
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}$/.test(s)) fail('ambiguous amount grouping');
    const n = Math.round(Number(s.replace(/,/g,''))*100);
    if (!Number.isSafeInteger(n) || n <= 0) fail('invalid amount');
    return n;
  };
  function normalize(envelope, file, job) {
    if (envelope?.version !== 'tmn-page-ocr-v1' || file.kind !== 'stm_pdf' || job.company !== 'UFABET7M' ||
        !/(?:^|[_\s-])TMN(?:[_\s-]|$)/i.test(file.file_name || '') || !/รุ[่้]งฟ้า/.test(file.file_name || '') ||
        /สรวิศา/.test(file.file_name || '') || !file.id || envelope.sourceFileId !== file.id || !iso(job.business_date) ||
        !sha(envelope.sourceSha256) || (file.checksum && file.checksum !== envelope.sourceSha256)) fail('source identity mismatch');
    if (!Number.isInteger(envelope.pageCount) || envelope.pageCount < 1 || envelope.pageCount > 100 ||
        !Array.isArray(envelope.pages) || envelope.pages.length !== envelope.pageCount) fail('physical page coverage incomplete');
    const pages = [...envelope.pages].sort((a,b)=>a.page-b.page);
    const pageErrors=[],invalidPages=new Set();
    for (let i=0;i<pages.length;i++) {
      const p=pages[i];
      if (p.page!==i+1 || p.sourceFileId!==file.id || p.sourceSha256!==envelope.sourceSha256 ||
          p.pageCount!==envelope.pageCount || !sha(p.pageSha256) || p.error || typeof p.text!=='string' || !p.text.trim()) {
        invalidPages.add(i);
        pageErrors.push({page:i+1,message:'TMN page OCR: page '+(i+1)+' missing, duplicated, empty or failed'+(p.error?' — '+String(p.error.message||p.error):'')});
      }
    }
    const rows=[],pageAudit=[];
    let date=null;
    for (const [i,p] of pages.entries()) {
      if(invalidPages.has(i))continue;
      try {
      const lines=p.text.split(/\r?\n/).map((text,i)=>({text:clean(text),line:i+1})).filter(x=>x.text);
      const headings=lines.filter(x=>dateOf(x.text));
      // Only an absolute heading establishes the day. Do not infer from a
      // filename, BO, phone clock or relative label such as "เมื่อวานนี้".
      const firstEvent=lines.findIndex(x=>eventType(x.text));
      if (!date && headings.length && (firstEvent<0 || lines.indexOf(headings[0])<firstEvent)) date=dateOf(headings[0].text);
      if (!date) fail('page '+p.page+' has no preceding absolute date');
      const segments=[]; let segment={date,lines:[]};
      for (const l of lines) {
        const heading=dateOf(l.text);
        if (heading) { if(segment.lines.length) segments.push(segment); date=heading;segment={date,lines:[]}; }
        else segment.lines.push(l);
      }
      if(segment.lines.length) segments.push(segment);
      let ordinal=0, feeCount=0, principalCount=0;
      const auditRows=[];
      for (const segment of segments) {
        const events=[], money=[],clock=[];
        let enteredList=false;
        for (const l of segment.lines) {
          const kind=eventType(l.text),ms=amounts(l.text),ts=times(l.text);
          if(/^รายการ(?:\s+แชร์รายการ)?$/.test(l.text)){enteredList=true;continue;}
          if(kind) enteredList=true;
          if(ms.length>1 || ts.length>1) fail('page '+p.page+' OCR merged multiple rows at line '+l.line);
          if(kind) events.push({kind,description:l.text,line:l.line,amount:null,time:null});
          if(ms.length) money.push({sign:ms[0][1]==='+'?'+':'-',cents:centsOf(ms[0][2]),line:l.line});
          // Ignore the phone status clock only before the first transaction.
          if(ts.length && enteredList) clock.push({value:ts[0],line:l.line});
          if(!kind && /฿|(?:^|\s)[+−-]\s*\d/.test(l.text) && !ms.length) fail('page '+p.page+' unreadable monetary field at line '+l.line);
          if(enteredList && !events.length && /\d[\s/.:]*[:/][\s/.:]*\d/.test(l.text) && !ts.length)
            fail('page '+p.page+' unreadable row fragment at line '+l.line);
          if(events.length && !kind && !ms.length && !ts.length &&
              !/^(?:เมื่อวานนี้|แชร์รายการ|[({]?\s*โอนเงินกลับ\s*[)}]?|III|[OО0○◯<>←→|\s]+)$/.test(l.text))
            fail('page '+p.page+' unreadable row fragment at line '+l.line);
        }
        if(events.length!==money.length || events.length!==clock.length) fail('page '+p.page+' row coverage mismatch: descriptions '+events.length+', amounts '+money.length+', times '+clock.length);
        // Bind only values inside this row's description-to-next-description
        // span. Equal column counts do not prove physical row correspondence.
        // Grouped descriptions/amounts/times must go to visual review.
        for(const e of events) {
          const m=money.find(x=>x.line===e.line),t=clock.find(x=>x.line===e.line);
          if(m){m.used=true;e.amount=m;}
          if(t){t.used=true;e.time=t;}
        }
        for(const [index,e] of events.entries()) {
          const sign=e.kind==='deposit'?'+':'-';
          const end=events[index+1]?.line ?? Infinity;
          let m=e.amount;
          if(m && m.sign!==sign) fail('page '+p.page+' direction/sign conflict');
          const candidates=money.filter(x=>!x.used && x.line>e.line && x.line<end);
          if(!m && candidates.length===1) m=candidates[0];
          if(m && m.sign!==sign) fail('page '+p.page+' direction/sign conflict');
          const clocks=clock.filter(x=>!x.used && x.line>e.line && x.line<end);
          const t=e.time || (clocks.length===1?clocks[0]:null);
          if(!m || !t) fail('page '+p.page+' ambiguous row fields');
          m.used=t.used=true;
          const sourceRowId='P'+p.page+'-R'+(++ordinal);
          const physical=p.rowEvidence?.[ordinal-1];
          if(p.rowLayout&&(!physical||physical.sourceRowId!==sourceRowId))fail('page '+p.page+' physical row provenance incomplete');
          const lineage=physical?{sourceImageSha256:physical.sourceImageSha256,sourceRegions:physical.sourceRegions,
            sourceFragments:physical.sourceFragments,rawRowOcr:physical.rawOcr}:{};
          const sourceOcrLines=[...new Set([e.line,m.line,t.line])].sort((a,b)=>a-b);
          const original={sourceRowId,page:p.page,sourceLine:e.line,sourceOcrLines,sourcePageSha256:p.pageSha256,
            sourceFileSha256:envelope.sourceSha256,date:segment.date,time:t.value,direction:e.kind,amount:m.cents/100,description:e.description,...lineage};
          auditRows.push(original);
          if(e.kind==='fee') {feeCount++;continue;}
          principalCount++;
          const [h,min,sec=0]=t.value.split(':').map(Number);
          rows.push({rowNo:rows.length+1,source:'stm',formatCode:'stm_pdf',company:job.company,subco:job.company,
            account:'0812792075',bank:'TMN',channel:'TMN',date:segment.date,sourceDate:segment.date,
            sec:h*3600+min*60+sec,amount:m.cents/100,balance:null,direction:e.kind,username:null,ref:null,
            desc:e.description,code:e.kind==='deposit'?'เงินเข้า':'เงินออก',minutePrecision:t.value.split(':').length===2,noTime:false,
            ocrWalletScreenshot:true,ocrDateCandidateOnly:segment.date!==job.business_date,
            source_file_id:file.id,source_checksum:envelope.sourceSha256,sourceRowId,page:p.page,sourceLine:e.line,
            sourceOcrLines,sourcePageSha256:p.pageSha256,sourceFileSha256:envelope.sourceSha256,...lineage,
            raw:sourceOcrLines.map(n=>p.text.split(/\r?\n/)[n-1]).join(' | ')});
        }
        if(money.some(x=>!x.used) || clock.some(x=>!x.used)) fail('page '+p.page+' unassigned field');
      }
      if(!ordinal) fail('page '+p.page+' has no independently verified transaction rows');
      pageAudit.push({page:p.page,pageSha256:p.pageSha256,principalCount,feeCount,rows:auditRows,
        ...(p.rowLayout?{physicalRowCount:p.geometry.rows.length,sourceImageSha256:p.sourceImageSha256,geometry:p.geometry,originalOcr:p.originalOcr}:{}),
        confidence:{type:'structural',criticalFields:'exact-count/sign/absolute-date/registered-owner',numericOcrConfidence:null}});
      } catch(error) {
        pageErrors.push({page:p.page,message:String(error.message||error)});
      }
    }
    if(pageErrors.length){const e=Error(pageErrors.map(x=>x.message).join(' · '));e.pageErrors=pageErrors;e.pagesProcessed=pages.length;throw e;}
    return {format:{source:'stm',bank:'TMN',realCode:'stm_pdf_page_ocr'},records:rows,aux:[],warnings:[],
      dropped:{'ค่าธรรมเนียม TMN (ไม่นำเข้ากระทบยอด)':pageAudit.reduce((n,p)=>n+p.feeCount,0)},
      quality:{complete:true,parsedRows:rows.length,unreadRows:[],invalidRows:[],pageCount:pages.length,
        pageLinkedOcr:true,sourceSha256:envelope.sourceSha256,pages:pageAudit}};
  }
  return {normalize};
})();
if(typeof module!=='undefined') module.exports=TmnPageOcr;
