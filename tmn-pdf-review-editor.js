/* Human page-by-page TMN transcription. Saves source evidence only. */
const TmnPdfReviewEditor = (() => {
  if (typeof document !== 'undefined' && !document.getElementById('tmn-review-editor-style')) {
    const style=document.createElement('style');style.id='tmn-review-editor-style';style.textContent='.tmn-review-editor .pdf-review-grid input,.tmn-review-editor .pdf-review-grid select{min-width:90px;width:100%;box-sizing:border-box}.tmn-review-editor .pdf-review-grid input[data-edit="description"]{min-width:260px}.tmn-review-editor .pdf-review-grid table{min-width:980px}';document.head.append(style);
  }
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cents=n=>Math.round(Number(n||0)*100);
  const accountOf=name=>/สรวิศา/.test(name||'')?'0639274201':/รุ[่้]งฟ้า/.test(name||'')?'0812792075':'';
  const totals=rows=>rows.reduce((a,r)=>{if(!r.duplicateOf&&a[r.direction]){a[r.direction].count++;a[r.direction].amount=(a[r.direction].cents+=cents(r.amount))/100;}return a;},{deposit:{count:0,cents:0,amount:0},withdraw:{count:0,cents:0,amount:0}});
  function reindex(rows){const seq=new Map();for(const r of rows){r.page=Math.max(1,Number(r.page||1));const n=(seq.get(r.page)||0)+1;seq.set(r.page,n);r.id=`P${r.page}-R${n}`;}return rows;}
  function build(evidence,source,sha,name,reviewer){
    const account=accountOf(name);if(!account)throw Error('ชื่อไฟล์ต้องระบุบัญชี TMN รุ้งฟ้า/รุ่งฟ้า หรือ สรวิศา');
    const rows=PdfReview.rowsOf(evidence).filter(r=>['deposit','withdraw'].includes(r.direction)&&Number(r.amount)>0).map(r=>({page:r.page||1,date:String(r.date||source.business_date).slice(0,10),time:String(r.time||'').slice(0,5),direction:r.direction,amount:Number(r.amount),description:String(r.raw||'').trim()||`${r.direction} ${r.amount}`,last4:r.last4||null,customerBank:r.customerBank||null,customerName:r.customerName||null,reviewed:false}));
    if(!rows.length)throw Error('OCR ไม่มีแถวฝาก/ถอนสำหรับใช้เป็นข้อมูลตั้งต้น');
    reindex(rows);return {version:1,sourceType:'tmn-screenshot-list-v1',sourceId:source.id,sourceChecksum:source.checksum,pdfSha256:sha,company:source.company,businessDate:source.business_date,account,bank:'TMN',coverageReviewed:false,coverageEvidence:'',pageCount:Math.max(1,Number(evidence?.page_count||1)),pagesReviewed:[],transcribedBy:reviewer||'web-auditor',rows,expectedRowIds:rows.map(r=>r.id),controls:totals(rows)};
  }
  function payload(candidate,source,sha,checked,coverage){
    reindex(candidate.rows);candidate.expectedRowIds=candidate.rows.map(r=>r.id);candidate.controls=totals(candidate.rows);candidate.coverageEvidence=coverage.trim();candidate.coverageReviewed=true;candidate.pagesReviewed=Array.from({length:candidate.pageCount},(_,i)=>i+1);
    if(candidate.pdfSha256!==sha||candidate.sourceId!==source.id||candidate.sourceChecksum!==source.checksum)throw Error('ไฟล์ต้นฉบับเปลี่ยน กรุณาเริ่มตรวจใหม่');
    if(candidate.coverageEvidence.length<10)throw Error('ระบุวิธีตรวจความครบทุกหน้าอย่างน้อย 10 ตัวอักษร');
    if(candidate.rows.some(r=>r.page<1||r.page>candidate.pageCount||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(r.time)||r.date!==candidate.businessDate||!['deposit','withdraw'].includes(r.direction)||cents(r.amount)<=0||!r.description.trim()))throw Error('มีแถวที่เลขหน้า วัน เวลา ทิศทาง ยอด หรือรายละเอียดไม่ครบ');
    if(checked.size!==candidate.rows.length||candidate.rows.some(r=>!checked.has(r.id)))throw Error('ต้องยืนยันทุกแถวหลังแก้ไขล่าสุด');
    const p=JSON.parse(JSON.stringify(candidate));p.rows.forEach(r=>r.reviewed=true);
    ReviewedPdfRecovery.normalize({id:'validation',status:'approved',approved_by:'validation',approved_at:'validation',payload:p},source,{company:source.company,business_date:source.business_date});return p;
  }
  function mount(target,{evidence,name,loadSource,download,approve,onPage,reviewer}){
    const root=document.createElement('section');root.className='pdf-source-approval tmn-review-editor';root.innerHTML=`<h3>ตรวจ TMN ทีละหน้า</h3><p>OCR เป็นเพียงข้อมูลตั้งต้น ต้องตรวจทุกหน้ากับภาพจริง เพิ่มแถวที่อ่านตก และคงยอด/เวลาเดียวกันหลายแถวไว้หากเป็นคนละรายการ</p><button type="button" data-start>เริ่มตรวจจาก OCR ปัจจุบัน</button><p data-status role="status">ยังไม่ได้เริ่มตรวจ</p><div data-work hidden><p data-summary></p><div class="pdf-review-grid" data-grid></div><div class="pdf-review-tools"><button type="button" data-add>เพิ่มแถวที่ OCR อ่านตก</button><button type="button" data-prev>ก่อนหน้า</button><span data-range></span><button type="button" data-next>ถัดไป</button></div><label><input type="checkbox" data-all-pages> ตรวจครบทุกหน้าแล้ว รวมภาพตัดขอบ/หน้าเรียงผิด/ยอดซ้ำ</label><label>หลักฐานการตรวจความครบ<textarea data-coverage rows="3" placeholder="เช่น ตรวจหน้า 1–13 เทียบจำนวนแถวและยอดฝาก/ถอนครบ"></textarea></label><label>บันทึกผู้ตรวจ<textarea data-note rows="3" placeholder="อย่างน้อย 10 ตัวอักษร"></textarea></label><button type="button" class="primary-button" data-save disabled>บันทึกผลตรวจภาพ PDF</button></div>`;target.append(root);
    const q=s=>root.querySelector(s),checked=new Set();let candidate,source,sha='',offset=0,busy=false,saved=false;
    const setStatus=s=>q('[data-status]').textContent=s;
    const canSave=()=>{q('[data-save]').disabled=busy||saved||!candidate||checked.size!==candidate.rows.length||!q('[data-all-pages]').checked||q('[data-coverage]').value.trim().length<10||q('[data-note]').value.trim().length<10;};
    const input=(r,k,t='text')=>`<input type="${t}" data-edit="${k}" data-row-id="${esc(r.id)}" value="${esc(r[k])}">`;
    function render(){candidate.controls=totals(candidate.rows);const rows=candidate.rows.slice(offset,offset+25);q('[data-summary]').textContent=`TMN ${candidate.account} · ${candidate.pageCount} หน้า · ${candidate.rows.length} แถว · ยืนยัน ${checked.size}/${candidate.rows.length} · ฝาก ${candidate.controls.deposit.count}/${candidate.controls.deposit.amount.toLocaleString()} บาท · ถอน ${candidate.controls.withdraw.count}/${candidate.controls.withdraw.amount.toLocaleString()} บาท`;q('[data-grid]').innerHTML=`<table><thead><tr><th>ยืนยัน</th><th>หน้า</th><th>วันที่</th><th>เวลา</th><th>ประเภท</th><th>ยอด</th><th>รายละเอียด</th></tr></thead><tbody>${rows.map(r=>`<tr><td><input type="checkbox" data-check="${esc(r.id)}" ${checked.has(r.id)?'checked':''}></td><td>${input(r,'page','number')}</td><td>${input(r,'date','date')}</td><td>${input(r,'time','time')}</td><td><select data-edit="direction" data-row-id="${esc(r.id)}"><option value="deposit" ${r.direction==='deposit'?'selected':''}>ฝาก</option><option value="withdraw" ${r.direction==='withdraw'?'selected':''}>ถอน</option></select></td><td>${input(r,'amount','number')}</td><td>${input(r,'description')} <button type="button" data-open-page="${r.page}">ดูภาพหน้า ${r.page}</button></td></tr>`).join('')}</tbody></table>`;q('[data-range]').textContent=`${offset+1}–${offset+rows.length}/${candidate.rows.length}`;q('[data-prev]').disabled=offset===0;q('[data-next]').disabled=offset+25>=candidate.rows.length;canSave();}
    q('[data-start]').onclick=async()=>{busy=true;setStatus('กำลังตรวจไฟล์และสร้างข้อมูลตั้งต้น…');try{const bytes=await download(),buf=bytes instanceof Blob?await bytes.arrayBuffer():bytes,digest=await crypto.subtle.digest('SHA-256',buf);sha=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');source=await loadSource();candidate=build(evidence,source,sha,name,reviewer);q('[data-work]').hidden=false;setStatus('สร้างข้อมูลตั้งต้นแล้ว — ยังห้ามรันจนกว่าจะตรวจครบทุกหน้า');render();}catch(e){setStatus('เริ่มตรวจไม่ได้: '+e.message);}finally{busy=false;canSave();}};
    q('[data-grid]').onchange=e=>{if(saved)return;const id=e.target.dataset.check||e.target.dataset.rowId,row=candidate.rows.find(r=>r.id===id);if(e.target.dataset.check){e.target.checked?checked.add(id):checked.delete(id);}else if(row){const key=e.target.dataset.edit;row[key]=key==='page'?Math.max(1,Number(e.target.value||1)):key==='amount'?Number(e.target.value):e.target.value;if(key==='page'){checked.clear();reindex(candidate.rows);}}render();};
    q('[data-grid]').onclick=e=>{const b=e.target.closest('[data-open-page]');if(b)onPage(Number(b.dataset.openPage));};
    q('[data-add]').onclick=()=>{candidate.rows.push({page:1,date:candidate.businessDate,time:'00:00',direction:'deposit',amount:0,description:'',reviewed:false});checked.clear();reindex(candidate.rows);offset=Math.floor((candidate.rows.length-1)/25)*25;render();};
    q('[data-prev]').onclick=()=>{offset=Math.max(0,offset-25);render();};q('[data-next]').onclick=()=>{offset+=25;render();};q('[data-all-pages]').onchange=canSave;q('[data-coverage]').oninput=canSave;q('[data-note]').oninput=canSave;
    q('[data-save]').onclick=async()=>{busy=true;canSave();try{source=await loadSource();const p=payload(candidate,source,sha,checked,q('[data-coverage]').value),id=await approve(p,q('[data-note]').value.trim());if(!id)throw Error('ระบบไม่ส่งเลขอ้างอิง');saved=true;setStatus(`บันทึกผลตรวจแล้ว ${id} — Worker จะใช้หลักฐานนี้ในรอบถัดไป โดยยังไม่ปิดเคส`);}catch(e){setStatus('บันทึกไม่ได้: '+e.message);}finally{busy=false;canSave();}};
  }
  return {accountOf,build,payload,totals,reindex,mount};
})();

// Route only TMN statement PDFs to the stricter editor without changing the
// generic preview call site. The source record is authoritative for the file
// name, so a misleading OCR provider label cannot select this workflow.
if (typeof PdfSourceApproval !== 'undefined' && !PdfSourceApproval.__tmnEditorWrapped) {
  const genericMount=PdfSourceApproval.mount.bind(PdfSourceApproval);
  PdfSourceApproval.mount=(target,options)=>{
    Promise.resolve(options.loadSource()).then(source=>{
      const name=String(source?.file_name||'');
      if (/(?:^|[_\s-])TMN(?:[_\s-]|$)/i.test(name)) {
        TmnPdfReviewEditor.mount(target,{...options,name,reviewer:globalThis.Sb?.currentEmail?.()||globalThis.currentUser?.()?.username||'web-auditor'});
      } else genericMount(target,options);
    }).catch(()=>genericMount(target,options));
  };
  PdfSourceApproval.__tmnEditorWrapped=true;
}
