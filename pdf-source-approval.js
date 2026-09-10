/* Source approval only: never updates cases, parse flags or the job queue. */
const PdfSourceApproval = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function validate(candidate, source, sha256, checked) {
    const p = JSON.parse(JSON.stringify(candidate));
    if (!Array.isArray(p.rows) || !p.rows.length || p.rows.length > 10000) throw Error('ต้องมีข้อมูลต้นฉบับ 1–10,000 แถว');
    if (p.pdfSha256 !== sha256) throw Error('ข้อมูลชุดนี้ไม่ตรงกับไฟล์ PDF ที่เปิดอยู่');
    if (checked && (checked.size !== p.rows.length || p.rows.some(r=>!checked.has(r.id)))) throw Error('กรุณาตรวจและยืนยันทุกแถว');
    // An in-memory envelope validates the payload only. The server assigns the real reviewer.
    p.rows = p.rows.map(r=>({...r,reviewed:true}));
    p.coverageReviewed = true;
    if (String(p.coverageEvidence || '').trim().length < 10) throw Error('ต้องมีรายละเอียดการตรวจความครบทุกหน้า');
    ReviewedPdfRecovery.normalize({id:'validation-only',status:'approved',approved_by:'validation-only',approved_at:'validation-only',payload:p},source,{company:source.company,business_date:source.business_date});
    return p;
  }
  function mount(target,{loadSource,download,approve,onPage}) {
    const panel=document.createElement('section'); panel.className='pdf-source-approval';
    panel.innerHTML=`<h3>ยืนยันต้นฉบับ PDF</h3><p>เลือกชุดข้อมูลกู้ PDF แล้วตรวจทุกแถวกับภาพต้นฉบับ การยืนยันนี้ไม่ปิดเคสและไม่สั่งรันงาน</p><label>ชุดข้อมูลกู้ PDF (JSON) <input type="file" accept=".json,application/json" data-candidate></label><p role="status" aria-live="polite" data-status>ยังไม่ได้เลือกชุดข้อมูล</p><div data-review hidden><p data-summary></p><div class="pdf-review-grid" data-rows></div><div class="pdf-review-tools"><button type="button" data-prev>ก่อนหน้า</button><span data-page></span><button type="button" data-next>ถัดไป</button></div><label><input type="checkbox" data-coverage> ตรวจครบทุกหน้าของ PDF แล้ว รวมแถวที่อยู่นอกวันที่กระทบยอด</label><label>บันทึกการยืนยัน (อย่างน้อย 10 ตัวอักษร)<textarea rows="3" maxlength="2000" data-note></textarea></label><button type="button" class="primary-button" data-approve disabled>ยืนยันต้นฉบับ PDF</button></div>`;
    target.append(panel);
    const q=s=>panel.querySelector(s), checked=new Set();
    let candidate=null, source=null, hash='', offset=0, busy=false, revision=0, saved=false;
    const status=s=>{q('[data-status]').textContent=s;};
    const ready=()=>{q('[data-approve]').disabled=busy||saved||!candidate||checked.size!==candidate.rows.length||!q('[data-coverage]').checked||q('[data-note]').value.trim().length<10;};
    const render=()=>{
      const rows=candidate.rows.slice(offset,offset+25);
      q('[data-summary]').textContent=`${candidate.company} · ${candidate.businessDate} · ${candidate.bank} ${candidate.account} · ตรวจแล้ว ${checked.size}/${candidate.rows.length} แถว · ฝาก ${candidate.controls.deposit.count} รายการ / ${candidate.controls.deposit.amount} บาท · ถอน ${candidate.controls.withdraw.count} รายการ / ${candidate.controls.withdraw.amount} บาท`;
      q('[data-rows]').innerHTML=`<table><thead><tr>${['ตรวจแล้ว','หน้า/แถว','วันที่ / เวลา','ประเภท','ยอด','ก่อนรายการ','คงเหลือ','ท้าย 4','ธนาคาร / ชื่อ','รายละเอียด'].map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td><input type="checkbox" aria-label="ยืนยันแถว ${esc(r.id)}" data-row="${esc(r.id)}" ${checked.has(r.id)?'checked':''} ${busy||saved?'disabled':''}></td><td><button type="button" data-page-ref="${Number(r.id.match(/^P(\d+)/)[1])}">${esc(r.id)}</button></td><td>${esc(r.date)} ${esc(r.time)}</td><td>${r.direction==='deposit'?'ฝาก':'ถอน'}</td><td>${esc(r.amount)}</td><td>${esc(r.previous)}</td><td>${esc(r.balance)}</td><td>${esc(r.last4||'ไม่ระบุ')}</td><td>${esc(r.customerBank||'ไม่ระบุ')} / ${esc(r.customerName||'ไม่ระบุ')}</td><td>${esc(r.description)}</td></tr>`).join('')}</tbody></table>`;
      q('[data-page]').textContent=`${offset+1}–${offset+rows.length} / ${candidate.rows.length}`;
      q('[data-prev]').disabled=offset===0; q('[data-next]').disabled=offset+25>=candidate.rows.length;ready();
    };
    q('[data-candidate]').onchange=async e=>{
      const token=++revision; candidate=null;checked.clear();saved=false;offset=0;q('[data-review]').hidden=true;ready();
      q('[data-coverage]').checked=false;q('[data-note]').value='';
      try {
        const file=e.target.files[0];if(!file)return;
        if(file.size>10*1024*1024)throw Error('ชุดข้อมูลต้องไม่เกิน 10 MB');
        status('กำลังตรวจไฟล์ต้นฉบับและความถูกต้องของชุดข้อมูล…');
        const parsed=JSON.parse(await file.text());
        const [s,bytes]=await Promise.all([loadSource(),download()]);
        const buffer=bytes instanceof Blob?await bytes.arrayBuffer():bytes;
        const digest=await crypto.subtle.digest('SHA-256',buffer);
        const sha=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
        validate(parsed,s,sha);
        if(token!==revision||!panel.isConnected)return;
        candidate=parsed;source=s;hash=sha;q('[data-review]').hidden=false;
        status('ข้อมูลผ่านการตรวจโครงสร้างและยอดคงเหลือ — ยังไม่ยืนยันต้นฉบับ');render();
      } catch(error){if(token===revision)status('ยังยืนยันไม่ได้: '+error.message);}
    };
    q('[data-rows]').onchange=e=>{if(!e.target.dataset.row||busy||saved)return;const id=e.target.dataset.row;e.target.checked?checked.add(id):checked.delete(id);render();};
    q('[data-rows]').onclick=e=>{const b=e.target.closest('[data-page-ref]');if(b)onPage(Number(b.dataset.pageRef));};
    q('[data-prev]').onclick=()=>{offset=Math.max(0,offset-25);render();};
    q('[data-next]').onclick=()=>{offset+=25;render();};
    q('[data-coverage]').onchange=ready;q('[data-note]').oninput=ready;
    q('[data-approve]').onclick=async()=>{
      if(q('[data-approve]').disabled)return;
      busy=true;q('[data-candidate]').disabled=true;render();
      try {
        source=await loadSource();
        const payload=validate(candidate,source,hash,checked);
        const note=q('[data-note]').value.trim();
        if(!q('[data-coverage]').checked||note.length<10)throw Error('กรุณายืนยันความครบและใส่บันทึก');
        const id=await approve(payload,note);
        if(!id)throw Error('ระบบยังไม่ส่งหลักฐานการบันทึกกลับมา กรุณาตรวจสถานะก่อนลองใหม่');
        saved=true;status('บันทึกการยืนยันต้นฉบับแล้ว · เลขอ้างอิง '+id+' · ยังไม่ปิดเคสหรือรันกระทบยอด');
      }catch(error){status('ยืนยันไม่สำเร็จ: '+error.message);}
      finally{busy=false;q('[data-candidate]').disabled=saved;render();}
    };
  }
  return {validate,mount};
})();
