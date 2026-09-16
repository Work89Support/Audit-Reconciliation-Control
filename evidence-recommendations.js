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
        const proposals = await api.evidenceRecommendations({fileId:f.id});
        const selectedDate = document.getElementById('recommendationDate')?.value;
        const date = selectedDate || proposals[0]?.business_date || '';
        await openFile({id:f.id,name:f.file_name,company:f.company,date,kind:f.kind,path:f.storage_path,size:f.size_bytes,status:f.parsed?'parsed':'waiting'});
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
  function forCase(row, links, runId) {
    const e=row.case;
    if(!e?.id || !runId || e.run_id!==runId || ['closed','approved','damage'].includes(e.status))return [];
    return (links||[]).filter(link=>link.exception_id===e.id
      &&link.exceptions?.run_id===runId &&link.exceptions.company===e.company
      &&link.exceptions.business_date===e.business_date
      &&link.evidence_recommendations?.status==='pending_audit'
      &&link.evidence_recommendations.business_date===e.business_date
      &&[link.evidence_recommendations.company,link.evidence_recommendations.payer_company].includes(e.company));
  }
  function showCaseLinks(links, api, openFile) {
    const unique=[...new Map(links.map(l=>[l.recommendation_id,l.evidence_recommendations])).values()];
    openModal('หลักฐานแนะนำของเคสนี้ — ยังไม่ยืนยัน', `<div id="caseRecommendationDetails"><p>สีเหลืองหมายถึงมีหลักฐานที่เกี่ยวข้อง ไม่ใช่ผลจับคู่สำเร็จ และยังไม่ปิดเคส</p>${links.map(l=>`<p>${esc(l.reason)}</p>`).join('')}${cards(unique)}</div>`, '');
    void bindFiles(document.getElementById('caseRecommendationDetails'),api,openFile);
  }
  function decorateRows(table, rows, links, runId, onOpen) {
    table.querySelectorAll('tbody tr').forEach((tr,index)=>{
      const suggestions=forCase(rows[index]||{},links,runId);
      if(!suggestions.length)return;
      tr.classList.add('has-evidence-recommendation');
      const button=document.createElement('button');
      button.type='button';button.className='evidence-recommendation-badge';
      button.textContent=`🟡 มีคู่แนะนำ (${suggestions.length}) · รอ Audit ยืนยัน`;
      button.setAttribute('aria-label','ดูเหตุผลและหลักฐานแนะนำของ '+(rows[index].case.code||rows[index].id));
      button.onclick=()=>onOpen(suggestions);
      tr.cells[0]?.append(button);
    });
  }
  async function mountCaseBanner(container, e, api, openFile) {
    const banner=document.createElement('section');banner.className='case-recommendation-banner';
    banner.textContent='กำลังตรวจหลักฐานแนะนำ…';container.prepend(banner);
    try {
      const links=await api.evidenceCaseRecommendations({caseId:e.dbId});
      if(!banner.isConnected)return;
      const valid=forCase({case:{id:e.dbId,run_id:e.runId,company:e.company,business_date:e.date,status:e.status}},links,e.runId);
      if(!valid.length){banner.remove();return;}
      banner.classList.add('has-evidence-recommendation');
      banner.innerHTML='<b>🟡 มีคู่แนะนำ · รอ Audit ยืนยัน</b><p>พบหลักฐานที่เชื่อมกับเคสนี้ ยังไม่ใช่การรับรองคู่หรือปิดเคส</p><button type="button" class="evidence-recommendation-badge">ดูเหตุผลและหลักฐาน</button>';
      banner.querySelector('button').onclick=()=>showCaseLinks(valid,api,openFile);
    } catch(error) {if(banner.isConnected){banner.textContent='ตรวจคู่แนะนำไม่ได้: '+error.message;banner.setAttribute('role','status');}}
  }
  return {mount,browse,cards,forCase,showCaseLinks,decorateRows,mountCaseBanner};
})();
