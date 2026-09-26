/* Private, database-backed proposals. No localStorage, auto-approval or case mutation. */
const EvidenceRecommendations = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const providerFromName = (name) => {
    const value=String(name||'').toUpperCase();
    return ['AUTOPEER','AZPAY','COREPAY','CYBERPLUS','MYPAY','LOCALPAY','LOCELPAY','QPAY'].find(provider=>value.includes(provider))||'';
  };
  const routeLabel = (row) => row.company===row.payer_company
    ? `<div class="recommendation-same-company"><span>บริษัทในเอกสาร</span><b>${esc(row.company)}</b><small>รายการภายในบริษัทเดียวกัน · ไม่มีการจ่ายแทนข้ามบริษัทในข้อเสนอนี้</small></div>`
    : `<div class="recommendation-route-inline"><span><small>บริษัทเจ้าของรายการ</small><b>${esc(row.company)}</b></span><i aria-hidden="true">→</i><span><small>บริษัทที่เสนอว่าจ่ายแทน</small><b>${esc(row.payer_company)}</b></span></div>`;
  function cards(rows) {
    if (!rows.length) return '<p>ยังไม่มีคู่แนะนำที่บันทึกไว้</p>';
    return `${rows.length > 500 ? '<p>แสดง 500 รายการแรก กรุณาระบุวันที่ให้แคบลง</p>' : ''}${rows.slice(0,500).map(r => `<article class="panel recommendation-proposal"><header><b>ข้อเสนอจากการอ่านเอกสาร · รอ Audit ยืนยัน</b><span>${esc(r.business_date)}</span></header>${routeLabel(r)}<dl><div><dt>Provider ที่ผู้บันทึกระบุ</dt><dd>${esc(r.provider)||'ไม่ระบุ'}</dd></div><div><dt>ยอดที่ผู้บันทึกระบุ</dt><dd>${Number(r.amount).toLocaleString('th-TH',{minimumFractionDigits:2})} บาท</dd></div></dl><section class="recommendation-entered-note"><b>ข้อความที่ผู้ตรวจบันทึกไว้จากการอ่านเอกสาร</b><p>${esc(r.evidence_note)}</p><small>เป็นข้อความกรอกมือ ไม่ใช่ข้อความที่ระบบดึงจากเอกสารอัตโนมัติ และยังไม่ยืนยันคู่ BO/PM</small></section><p class="recommendation-created">บันทึกเมื่อ ${r.created_at?esc(new Date(r.created_at).toLocaleString('th-TH')):'ไม่พบเวลาในข้อมูล'} · ไม่ใช่ยอดเสียหาย</p><p><button type="button" class="ghost-button" data-recommendation-file="${esc(r.source_file_id)}">เปิดหลักฐานต้นทาง</button></p></article>`).join('')}`;
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
    const suggestedProvider=providerFromName(meta.name);
    section.innerHTML = `<h3>ข้อเสนอที่บันทึกจากเอกสาร — รอ Audit ยืนยัน</h3><p>ข้อมูลด้านล่างเป็นสิ่งที่ผู้ตรวจกรอกหลังอ่านเอกสาร ไม่ใช่ผลที่ระบบยืนยัน และไม่เปลี่ยนสถานะเคส</p><div data-list aria-live="polite">กำลังโหลด...</div><details><summary>บันทึกข้อเสนอเพิ่มจากไฟล์นี้</summary><form class="file-preview-editor">
      <label>วันที่เกิดรายการ<input name="business_date" type="date" value="${esc(meta.date || '')}" required></label>
      <label>บริษัทเจ้าของรายการ<select name="company">${companies.map(c=>`<option ${c===meta.company?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
      <label>บริษัทที่จ่ายแทน / บริษัทเดียวกัน<select name="payer_company">${companies.map(c=>`<option ${c===meta.company?'selected':''} value="${esc(c)}">${esc(c)}${c===meta.company?' — บริษัทเดียวกัน (ไม่มีการจ่ายแทน)':''}</option>`).join('')}</select><small>เลือกบริษัทอื่นเฉพาะเมื่อเอกสารยืนยันว่ามีการจ่ายแทนข้ามบริษัท</small></label>
      <label>Provider<input name="provider" maxlength="80" value="${esc(suggestedProvider)}" required><small>${suggestedProvider?'อ่านเบื้องต้นจากชื่อไฟล์ กรุณาตรวจในเอกสารอีกครั้ง':'กรอกตาม Provider ที่ปรากฏในเอกสาร'}</small></label>
      <label>ยอดตามหลักฐาน (บาท)<input name="amount" type="number" min="0.01" max="99999999999999.99" step="0.01" required></label>
      <label>ข้อความที่ผู้ตรวจบันทึกจากเอกสาร<textarea name="evidence_note" rows="5" minlength="10" maxlength="8000" required placeholder="ระบุ User, เลขอ้างอิง, ยอดย่อย และสิ่งที่ยังต้องตรวจ โดยไม่เติมข้อมูลที่ไม่มีในเอกสาร"></textarea><small>ข้อความนี้เป็นบันทึกของผู้ตรวจ ไม่ใช่การถอดข้อความอัตโนมัติ</small></label>
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
  function groupCasesHtml(r, links, currentIds) {
    const statuses={open:'รอ Audit ตรวจ',pending:'รอตรวจ',clarifying:'รอชี้แจง',answered:'รอตรวจคำตอบ',approved:'อนุมัติแล้ว',closed:'ปิดเคสแล้ว',damage:'บันทึกความเสียหาย'};
    const cases=[...new Map(links.filter(l=>l.recommendation_id===r.id && l.exceptions?.business_date===r.business_date && [r.company,r.payer_company].includes(l.exceptions?.company)).map(l=>[l.exception_id,l.exceptions])).values()];
    return `<div class="recommendation-case-list">${[...new Set([r.company,r.payer_company])].map(company=>`<section><b>${esc(company)} · ${company===r.company?'เจ้าของรายการ':'จ่ายแทน'}</b>${cases.filter(e=>e.company===company).map(e=>`<div class="recommendation-case"><span>${esc(e.code||'เคส')} <small>${currentIds.includes(e.id)?'· เคสที่กำลังดู':''}</small><br><span class="recommendation-case-status">${esc(statuses[e.status]||'สถานะ: '+(e.status||'ไม่ระบุ'))}</span></span><button type="button" class="ghost-button" data-related-case="${esc(e.id)}">ดูเคส</button></div>`).join('')||'<p class="recommendation-missing">ยังไม่มีเคสที่เชื่อมและคุณมีสิทธิ์ดู · ไม่ได้หมายความว่าตรวจครบ</p>'}</section>`).join('')}</div>`;
  }
  async function loadGroupCases(root, rows, links, api, onCase) {
    if(!api.evidenceCaseRecommendations)return;
    for(const r of rows){
      const host=Array.from(root.querySelectorAll('[data-recommendation-group]')).find(el=>el.dataset.recommendationGroup===r.id);
      if(!host)continue;
      try {
        const all=await api.evidenceCaseRecommendations({recommendationId:r.id});
        if(!host.isConnected)return;
        host.innerHTML=groupCasesHtml(r,all,links.map(l=>l.exception_id));
        host.querySelectorAll('[data-related-case]').forEach(button=>{
          if(!onCase){button.disabled=true;return;}
          button.onclick=async()=>{button.disabled=true;try{await onCase(button.dataset.relatedCase);}catch(e){button.textContent=e.message;}finally{button.disabled=false;}};
        });
      } catch(e){if(host.isConnected)host.textContent='โหลดเคสที่เกี่ยวข้องไม่ได้: '+e.message;}
    }
  }
  function showCaseLinks(links, api, openFile, onCase) {
    const unique=[...new Map(links.map(l=>[l.recommendation_id,l.evidence_recommendations])).values()];
    openModal('หลักฐานที่แนะนำ', `<div id="caseRecommendationDetails" class="recommendation-reader"><p class="recommendation-notice">🟡 รอ Audit ตรวจ · ยังไม่ยืนยันคู่และยังไม่ปิดเคส</p>${unique.map(r=>`<article class="recommendation-summary"><div class="recommendation-summary-top"><div><span class="recommendation-label">ยอดที่ผู้บันทึกระบุจากเอกสาร</span><strong class="recommendation-amount">${Number(r.amount).toLocaleString('th-TH',{minimumFractionDigits:2})} <small>บาท</small></strong></div><span class="recommendation-provider">Provider ที่ระบุ: ${esc(r.provider)}</span></div>${routeLabel(r)}<p class="recommendation-date">วันที่รายการ · ${esc(r.business_date)}</p><section class="recommendation-reason"><h3>เหตุผลที่เชื่อมข้อเสนอนี้กับเคส</h3>${[...new Set(links.filter(l=>l.recommendation_id===r.id||l.evidence_recommendations===r).map(l=>l.reason))].map(reason=>`<p>${esc(reason)}</p>`).join('')}</section><button type="button" class="primary-button recommendation-open" data-recommendation-file="${esc(r.source_file_id)}">เปิดเอกสารหลักฐาน ↗</button><details class="recommendation-full"><summary>อ่านข้อความที่ผู้ตรวจบันทึกไว้จากเอกสาร</summary><p>${esc(r.evidence_note)}</p><small>ข้อความกรอกมือ · ไม่ใช่ข้อความที่ระบบถอดจากเอกสารอัตโนมัติ</small></details></article>`).join('')}<p class="recommendation-footnote">ยอดนี้เป็นข้อเสนอจากเอกสาร ไม่ใช่ยอดจับคู่สำเร็จหรือยอดเสียหาย</p></div>`, '');
    const root=document.getElementById('caseRecommendationDetails');
    root.querySelectorAll('.recommendation-summary').forEach((card,i)=>{
      const r=unique[i];
      const group=document.createElement('section');group.className='recommendation-group';
      group.innerHTML=`<details class="recommendation-group-id"><summary>กลุ่มเดียวกัน · ${esc(r.id?.slice(0,8)||'ไม่ระบุ')}</summary><code>${esc(r.id)}</code></details><p class="recommendation-notice">เอกสารเรื่องเดียว ใช้ตรวจได้ทั้งสองฝั่ง · ห้ามนับยอดกลุ่มซ้ำ</p><h3>เคสที่เกี่ยวข้อง</h3><div data-recommendation-group="${esc(r.id)}" aria-live="polite">กำลังโหลดสถานะแต่ละฝั่ง…</div><div class="recommendation-checks"><p><b>1. ตรวจการจ่ายแทน</b><br>ข้อเสนอจากเอกสาร · รอ Audit ตรวจธุรกรรมจริงแต่ละฝั่ง</p><p><b>2. ตรวจการคืนเงินระหว่างบริษัท</b><br>ยังไม่ยืนยันจากข้อเสนอนี้ · ต้องมีหลักฐานคืนเงินแยกต่างหาก</p></div><p class="recommendation-footnote">ปิดเคสแต่ละฝั่งตามหลักฐานของเคสนั้น การปิดฝั่งหนึ่งไม่ปิดอีกฝั่ง และไม่ยืนยันว่าคืนเงินแล้ว</p>`;
      card.querySelector('.recommendation-reason').before(group);
    });
    void bindFiles(root,api,openFile);
    void loadGroupCases(root,unique,links,api,onCase);
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
  async function mountCaseBanner(container, e, api, openFile, onCase) {
    const banner=document.createElement('section');banner.className='case-recommendation-banner';
    banner.textContent='กำลังตรวจหลักฐานแนะนำ…';container.prepend(banner);
    try {
      const links=await api.evidenceCaseRecommendations({caseId:e.dbId});
      if(!banner.isConnected)return;
      const valid=forCase({case:{id:e.dbId,run_id:e.runId,company:e.company,business_date:e.date,status:e.status}},links,e.runId);
      if(!valid.length){banner.remove();return;}
      banner.classList.add('has-evidence-recommendation');
      banner.innerHTML='<b>🟡 มีคู่แนะนำ · รอ Audit ยืนยัน</b><p>พบหลักฐานที่เชื่อมกับเคสนี้ ยังไม่ใช่การรับรองคู่หรือปิดเคส</p><button type="button" class="evidence-recommendation-badge">ดูเหตุผลและหลักฐาน</button>';
      banner.querySelector('button').onclick=()=>showCaseLinks(valid,api,openFile,onCase);
    } catch(error) {if(banner.isConnected){banner.textContent='ตรวจคู่แนะนำไม่ได้: '+error.message;banner.setAttribute('role','status');}}
  }
  return {mount,browse,cards,forCase,showCaseLinks,decorateRows,mountCaseBanner,groupCasesHtml};
})();
