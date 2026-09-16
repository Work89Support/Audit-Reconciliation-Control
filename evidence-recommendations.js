/* Private, database-backed proposals. No localStorage, auto-approval or case mutation. */
const EvidenceRecommendations = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function cards(rows) {
    if (!rows.length) return '<p>ยังไม่มีคู่แนะนำที่บันทึกไว้</p>';
    return `${rows.length > 500 ? '<p>แสดง 500 รายการแรก กรุณาระบุวันที่ให้แคบลง</p>' : ''}${rows.slice(0,500).map(r => `<article class="panel"><b>คู่แนะนำ — รอ Audit ยืนยัน</b><p>${esc(r.business_date)} · ${esc(r.company)} → บริษัทจ่ายแทน ${esc(r.payer_company)} · ${esc(r.provider)} · ${Number(r.amount).toLocaleString('th-TH',{minimumFractionDigits:2})} บาท</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(r.evidence_note)}</p><small>ยังไม่ยืนยันคู่ธุรกรรม BO/PM · ไม่ใช่ยอดเสียหาย</small><p><button type="button" class="ghost-button" data-recommendation-file="${esc(r.source_file_id)}">เปิดหลักฐานต้นทาง</button></p></article>`).join('')}`;
  }
  async function bindFiles(root, api, openFile) {
    root.querySelectorAll('[data-recommendation-file]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const files = await api.exceptionFiles(null, button.dataset.recommendationFile);
        if (!files[0]) throw new Error('ไม่พบไฟล์หรือไม่มีสิทธิ์เปิด');
        const f = files[0];
        await openFile({id:f.id,name:f.file_name,company:f.company,kind:f.kind,path:f.storage_path,size:f.size_bytes,status:f.parsed?'parsed':'waiting'});
      } catch (error) { button.textContent = error.message; }
      finally { button.disabled = false; }
    }));
  }
  function mount(container, meta, companies, api, openFile) {
    const section = document.createElement('section');
    section.className = 'panel';
    section.innerHTML = `<h3>คู่แนะนำจากหลักฐาน — รอ Audit ยืนยัน</h3><p>บันทึกข้อเสนอเท่านั้น ไม่เปลี่ยนสถานะเคส ไม่รับรองว่าจับคู่ถูก และไม่ส่งชี้แจง</p><div data-list aria-live="polite">กำลังโหลด...</div><details><summary>เพิ่มคู่แนะนำจากไฟล์นี้</summary><form class="file-preview-editor">
      <label>วันที่เกิดรายการ<input name="business_date" type="date" value="${esc(meta.date || '')}" required></label>
      <label>บริษัทเจ้าของรายการ<select name="company">${companies.map(c=>`<option ${c===meta.company?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
      <label>บริษัทจ่ายแทน<select name="payer_company">${companies.map(c=>`<option ${c===meta.company?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
      <label>Provider<input name="provider" maxlength="80" required></label>
      <label>ยอดตามหลักฐาน (บาท)<input name="amount" type="number" min="0.01" max="99999999999999.99" step="0.01" required></label>
      <label>ข้อมูลเสนอเทียบ / เหตุผล / สิ่งที่ยังต้องตรวจ<textarea name="evidence_note" rows="5" minlength="10" maxlength="8000" required placeholder="User, เลขอ้างอิง, ยอดย่อย และข้อจำกัดจากเอกสารจริง ไม่เติมข้อมูลที่ไม่มี"></textarea></label>
      <button class="primary-button" type="submit">บันทึกเป็นคู่แนะนำ</button><p data-message role="status"></p></form></details>`;
    container.prepend(section);
    const list = section.querySelector('[data-list]'), form = section.querySelector('form'), message = section.querySelector('[data-message]');
    const reload = async () => {
      try { list.innerHTML = cards(await api.evidenceRecommendations({fileId:meta.id})); await bindFiles(list, api, openFile); }
      catch (e) { list.textContent = `โหลดคู่แนะนำไม่ได้: ${e.message}`; }
    };
    let requestId = crypto.randomUUID();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submit = form.querySelector('button[type=submit]');
      submit.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(form));
        if (![data.company,data.payer_company].includes(meta.company)) throw new Error('บริษัทเจ้าของไฟล์ต้องเป็นหนึ่งในสองบริษัทของข้อเสนอ');
        await api.saveEvidenceRecommendation({...data,id:requestId,source_file_id:meta.id,amount:Number(data.amount)});
        message.textContent = 'บันทึกบนฐานข้อมูลแล้ว — รอ Audit ยืนยัน ไม่ได้ปิดเคส';
        requestId = crypto.randomUUID();
        form.reset();
        await reload();
      } catch (e) { message.textContent = `ยังไม่ยืนยันการบันทึก: ${e.message} — ตรวจรายการด้านบนก่อนลองใหม่`; await reload(); }
      finally { submit.disabled = false; }
    });
    void reload();
  }
  function browse(api, initialDate, openFile) {
    openModal('คู่แนะนำจากหลักฐาน', `<p>เป็นข้อเสนอจากเอกสาร ยังไม่ยืนยันธุรกรรม และไม่รวมในยอดจับคู่สำเร็จหรือความเสียหาย</p><label>วันที่ <input id="recommendationDate" type="date" value="${esc(initialDate)}"></label><button id="recommendationLoad" class="ghost-button">โหลดคู่แนะนำ</button><div id="recommendationRows" aria-live="polite"></div>`, '');
    const root = document.getElementById('recommendationRows'), date = document.getElementById('recommendationDate'), button = document.getElementById('recommendationLoad');
    const load = async () => {
      if (!date.value) { root.textContent='กรุณาเลือกวันที่'; return; }
      button.disabled=true;
      root.textContent='กำลังโหลด...';
      try { root.innerHTML=cards(await api.evidenceRecommendations({date:date.value})); await bindFiles(root,api,openFile); }
      catch(e) { root.textContent=`โหลดไม่ได้: ${e.message}`; }
      finally { button.disabled=false; }
    };
    button.addEventListener('click',load);
    void load();
  }
  return {mount,browse,cards};
})();
