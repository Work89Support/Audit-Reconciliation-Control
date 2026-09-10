/* Source review only. No case approval or mutation of reconciliation records. */
const PdfReview = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value));
  function rowsOf(evidence) {
    return (Array.isArray(evidence?.rows) ? evidence.rows : []).map((row, index) => {
      const description = String(row.desc || row.descriptionOcr || row.detail || '');
      const identity = description.match(/(?:รับโอนจาก|โอนไป|Transfer (?:from|to))\s+([A-Z]+)\s+[xX](\d{4})\s*(.*)/i);
      return {
        index, page: Number.isInteger(Number(row.page)) && Number(row.page) > 0 ? Number(row.page) : null,
        date: row.sourceDate || row.date || '',
        time: row.time || (finite(row.sec) ? `${String(Math.floor(Number(row.sec)/3600)).padStart(2,'0')}:${String(Math.floor(Number(row.sec)%3600/60)).padStart(2,'0')}` : ''),
        direction: row.direction === 'deposit' || row.direction === 'ฝาก' ? 'deposit' : row.direction === 'withdraw' || row.direction === 'ถอน' ? 'withdraw' : 'unknown',
        amount: finite(row.amount) ? Number(row.amount) : null,
        balance: finite(row.balance) ? Number(row.balance) : null,
        account: row.account || '', customerBank: row.custBank || identity?.[1] || '',
        last4: row.last4 || row.custAccLast4 || identity?.[2] || '',
        customerName: row.custName || row.nameOcr || identity?.[3] || '',
        raw: row.raw || row.rawOcr || description,
        issue: row.issue || row.reason || (!['deposit','withdraw','ฝาก','ถอน'].includes(row.direction) ? 'ยังแยกประเภทไม่ได้' : !finite(row.amount) ? 'ยังอ่านยอดไม่ได้' : ''),
      };
    });
  }
  function select(rows, direction, search) {
    const q=String(search || '').toLowerCase().trim();
    return rows.filter(row => (direction === 'all' || (direction === 'issues' ? !!row.issue : row.direction === direction)) && (!q || Object.values(row).join(' ').toLowerCase().includes(q)));
  }
  function mount(target, {url, evidence, name}) {
    const rows=rowsOf(evidence); let direction='all', search='', offset=0;
    const provider=evidence?.provider || 'ยังไม่ระบุ';
    const pages=finite(evidence?.page_count) && Number(evidence.page_count)>0 ? evidence.page_count : 'ยังไม่ยืนยัน';
    const confidence=finite(evidence?.confidence) ? `${Math.round(Number(evidence.confidence)*100)}%` : 'ยังไม่ยืนยัน';
    target.innerHTML=`<div class="pdf-review"><div class="pdf-review-heading"><b>ตรวจ PDF ในระบบ</b><span>ตัวอ่าน: ${escape(provider)} · จำนวนหน้า: ${escape(pages)} · ความมั่นใจ OCR: ${escape(confidence)}</span><p>ข้อมูลจากตัวอ่านยังไม่ใช่การอนุมัติ Audit ตรวจชื่อ บัญชี และยอดกับภาพก่อนปิดเคส</p></div><div class="pdf-review-split"><iframe class="file-preview-frame" title="ต้นฉบับ ${escape(name)}" src="${escape(url)}"></iframe><section class="pdf-review-data" aria-label="ข้อมูลที่อ่านจาก PDF"><div class="pdf-review-tools"><label>รายการ <select data-pdf-filter><option value="all">ทั้งหมดที่อ่านได้</option><option value="deposit">ฝาก</option><option value="withdraw">ถอน</option><option value="issues">ยังอ่านไม่ชัด</option></select></label><label>ค้นหา <input data-pdf-search placeholder="วันที่ บัญชี ชื่อ หรือยอด"></label></div><p data-pdf-count aria-live="polite"></p><div class="pdf-review-grid" data-pdf-grid></div><div class="pdf-review-tools"><button class="ghost-button" data-pdf-prev>ก่อนหน้า</button><button class="ghost-button" data-pdf-next>ถัดไป</button></div><details><summary>ข้อความที่ระบบเก็บจากไฟล์</summary><pre>${escape(evidence?.extracted_text || 'ยังไม่มีข้อความ OCR ที่บันทึกไว้ ระบบยังไม่ยืนยันว่าไฟล์นี้ไม่มีรายการ')}</pre></details></section></div></div>`;
    const render=()=>{
      const chosen=select(rows,direction,search), shown=chosen.slice(offset,offset+50);
      target.querySelector('[data-pdf-count]').textContent=chosen.length ? `พบ ${chosen.length.toLocaleString()} แถวจากข้อมูลที่เก็บไว้ · แสดง ${offset+1}–${offset+shown.length} (ไม่ยืนยันว่าครบทั้งไฟล์)` : 'ยังไม่มีแถวที่แสดงได้ตามตัวกรอง ไม่ใช่การยืนยันว่าไม่มีธุรกรรม';
      const money=v=>v===null?'—':v.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
      target.querySelector('[data-pdf-grid]').innerHTML=`<table><thead><tr>${['หน้า','วัน / เวลา','ประเภท','ยอด','คงเหลือ','บัญชีบริษัท','ธนาคารคู่รายการ','ท้าย 4','ชื่อจากตัวอ่าน','จุดตรวจ','ข้อความเดิม'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${shown.map(row=>`<tr><td>${row.page?`<button class="ghost-button" data-pdf-page="${row.page}">${row.page}</button>`:'ไม่ระบุ'}</td><td>${escape(row.date)} ${escape(row.time)}</td><td>${row.direction==='deposit'?'ฝาก':row.direction==='withdraw'?'ถอน':'ยังไม่ระบุ'}</td><td>${money(row.amount)}</td><td>${money(row.balance)}</td><td>${escape(row.account || 'ไม่ระบุ')}</td><td>${escape(row.customerBank || 'ไม่ระบุ')}</td><td>${escape(row.last4 || 'ไม่ระบุ')}</td><td>${escape(row.customerName || 'ไม่ระบุ')}</td><td>${escape(row.issue || 'ตรวจเทียบต้นฉบับ')}</td><td>${escape(row.raw)}</td></tr>`).join('')}</tbody></table>`;
      target.querySelector('[data-pdf-prev]').disabled=offset===0;
      target.querySelector('[data-pdf-next]').disabled=offset+50>=chosen.length;
    };
    target.querySelector('[data-pdf-filter]').onchange=e=>{direction=e.target.value;offset=0;render();};
    target.querySelector('[data-pdf-search]').oninput=e=>{search=e.target.value;offset=0;render();};
    target.querySelector('[data-pdf-prev]').onclick=()=>{offset=Math.max(0,offset-50);render();};
    target.querySelector('[data-pdf-next]').onclick=()=>{offset+=50;render();};
    target.querySelector('[data-pdf-grid]').onclick=e=>{const b=e.target.closest('[data-pdf-page]');if(b)target.querySelector('iframe').src=String(url).split('#')[0]+'#page='+Number(b.dataset.pdfPage);};
    render();
  }
  return {rowsOf,select,mount};
})();
