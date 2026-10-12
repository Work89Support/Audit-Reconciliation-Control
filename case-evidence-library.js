/* Read-only catalogue. References existing objects; never imports or edits evidence. */
(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function entries(batches, attachments) {
    const rows = [];
    for (const batch of batches || []) for (const file of batch.source_files || []) {
      if (file.kind !== 'doc_clarify' || file.is_archived) continue;
      rows.push({...file, origin:'mail', company:file.company || batch.company, business_date:batch.business_date,
        uploader:batch.sender || '', received_at:file.created_at || batch.received_at, case_code:'', case_status:''});
    }
    for (const file of attachments || []) {
      const e = file.exceptions;
      if (!e?.id) continue;
      rows.push({...file, origin:'case', kind:'doc_clarify', company:e.company, business_date:e.business_date,
        uploader:file.uploaded_by || '', received_at:file.created_at, case_code:e.code || e.id, case_status:e.status});
    }
    // File identity, not amount/name: old and replacement evidence remain separate.
    return [...new Map(rows.map(row => [`${row.origin}:${row.id}`, row])).values()]
      .sort((a,b) => String(b.received_at || '').localeCompare(String(a.received_at || '')) || String(a.id).localeCompare(String(b.id)));
  }
  function previewMeta(row) {
    return {path:row.storage_path, id:row.id, name:row.file_name, mime:row.mime_type,
      size:row.size_bytes, kind:'doc_clarify', company:row.company, date:row.business_date,
      status:'parsed', readOnly:true, evidenceOrigin:row.origin === 'case' ? 'แนบผ่านเคส / ผู้ชี้แจง' : 'ไฟล์จากเมล',
      caseCode:row.case_code, uploadedBy:row.uploader, uploadedAt:row.received_at,
      correctionReason:row.correction_reason, replacesEvidenceId:row.replaces_evidence_id,
      replacesSourceFileId:row.replaces_source_file_id};
  }
  function render(rows, query='') {
    const needle = query.trim().toLocaleLowerCase();
    const visible = rows.filter(row => [row.file_name,row.company,row.business_date,row.case_code,row.uploader]
      .join(' ').toLocaleLowerCase().includes(needle));
    const statuses = {closed:'ปิดเคสแล้ว',approved:'อนุมัติแล้ว',open:'เคสเปิด',clarifying:'รอชี้แจง',answered:'รอ Audit ตรวจ',pair_pending:'รออนุมัติจับคู่'};
    return `<p role="status">แสดง ${visible.length} จาก ${rows.length} ไฟล์ · หลักฐานเท่านั้น ไม่เข้ากระทบยอด</p><div class="table-wrap"><table><thead><tr><th>ไฟล์ / ที่มา</th><th>บริษัท / วันที่เคส</th><th>เลขเคส / สถานะ</th><th>ผู้แนบ / เวลารับ</th><th>ประวัติหลักฐาน</th><th></th></tr></thead><tbody>${visible.map(row => {
      const time = row.received_at ? new Date(row.received_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}) : 'ไม่ระบุ';
      const correction = row.correction_reason;
      return `<tr><td><b>${esc(row.file_name)}</b><small class="sub">${row.origin === 'case' ? 'แนบผ่านเคส / ผู้ชี้แจง' : 'ไฟล์จากเมล'} · ${Math.ceil(Number(row.size_bytes || 0)/1024)} KB</small></td><td>${esc(row.company)}<small class="sub">${esc(row.business_date)}</small></td><td>${esc(row.case_code || '—')}<small class="sub">${esc(statuses[row.case_status] || row.case_status || 'หลักฐานจากเมล')}</small></td><td><small>${esc(row.uploader || 'ไม่ระบุ')}</small><small class="sub">${esc(time)}</small></td><td>${correction ? `<b>ฉบับแก้หลักฐาน</b><small class="sub">เหตุผล: ${esc(correction)}</small><small class="sub">อ้างถึงไฟล์เดิม ${esc(row.replaces_evidence_id || row.replaces_source_file_id)}</small>` : 'ไฟล์เดิม · เก็บไว้ครบ'}</td><td><button type="button" class="primary-button xs" data-library-preview="${esc(row.origin+':'+row.id)}" ${row.storage_path ? '' : 'disabled'}>เปิดดูในระบบ</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">ไม่พบหลักฐานตามตัวกรองนี้</td></tr>'}</tbody></table></div>`;
  }
  function mount(host, rows, openPreview) {
    host.innerHTML = `<label>ค้นหาชื่อไฟล์ เลขเคส บริษัท หรือผู้แนบ<input type="search" data-library-search placeholder="ค้นหาหลักฐาน" /></label><div data-library-results></div>`;
    const target = host.querySelector('[data-library-results]');
    const draw = () => {
      target.innerHTML = render(rows, host.querySelector('[data-library-search]').value);
      target.querySelectorAll('[data-library-preview]').forEach(button => button.addEventListener('click', () => {
        const row = rows.find(r => r.origin+':'+r.id === button.dataset.libraryPreview);
        if (row?.storage_path) openPreview(previewMeta(row));
      }));
    };
    host.querySelector('[data-library-search]').addEventListener('input',draw); draw();
  }
  root.CaseEvidenceLibrary = {entries,previewMeta,render,mount};
})(typeof window === 'undefined' ? globalThis : window);
