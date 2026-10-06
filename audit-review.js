/* Existing cases only: returned clarification -> Audit review -> head approval. */
const AuditReview = (() => {
  function isWaiting(e) {
    return !e.closureRequestId && !e.manualPairId &&
      (e.status === 'answered' || (e.status === 'open' && Boolean(e.clarificationFileId)));
  }
  function rows(source, ctx) {
    const f = ctx.filters;
    return source.filter(e => isWaiting(e) && ctx.canAccessCompany(e.company) &&
      (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to) &&
      (f.company === 'ALL' || e.company === f.company) &&
      (f.direction === 'ALL' || e.direction === f.direction));
  }
  function mount(root, ctx) {
    const queue = rows(ctx.exceptions, ctx), { h, money } = ctx;
    root.innerHTML = `<section class="panel audit-review-queue">
      <div class="panel-heading"><div><p class="eyebrow">Audit Review</p><h2>เอกสารกลับมาแล้ว · รอ Audit ตรวจ</h2><p class="head-sub">ตรวจเอกสารและผลยอดในเคสเดิม แล้วเลือกจับคู่หรือส่งหัวหน้าปิดเคส</p></div><span class="health attention">${queue.length} เคสในขอบเขตที่โหลด</span></div>
      <div class="alert"><strong>ไม่มีเอกสาร → ส่งให้ผู้ชี้แจง</strong><span>ผู้ชี้แจงส่งกลับ → หน้านี้ → Audit ตรวจ → หัวหน้าอนุมัติปิด · เคสที่ส่งหัวหน้าแล้วดูที่ “อนุมัติ / ปิดเคส”</span></div>
      <div class="audit-review-tools"><button class="ghost-button sm" data-audit-refresh>โหลดข้อมูลล่าสุด</button><button class="ghost-button sm" data-audit-overview>ภาพรวมเคส · รวมประวัติ</button></div>
      <div class="audit-review-list">${queue.map(e => `<article class="audit-review-card"><header><div><span class="badge blue">${h(e.company)}</span><h3>${h(ctx.caseLabel(e))}</h3><small>วันที่รายการ ${h(e.date)} · ${h(e.direction)}</small></div><span class="badge amber">รอ Audit ตรวจ</span></header><div class="audit-review-amounts"><div><small>ยอด BO</small><strong>${e.systemAmount == null ? 'ไม่พบรายการ' : money(e.systemAmount) + ' บาท'}</strong></div><div><small>ยอด STM / PM</small><strong>${e.bankAmount == null ? 'ไม่พบรายการ' : money(e.bankAmount) + ' บาท'}</strong></div></div><p>${h(e.responseText || e.resolutionNote || 'มีคำตอบหรือเอกสารกลับมา ต้องเปิดตรวจเนื้อหาก่อน')}</p><footer><small>${e.clarificationFileId || e.hasEvidence ? 'มีหลักฐานให้ตรวจ · ไม่ใช่การยืนยันยอดผ่าน' : 'มีคำตอบ แต่ยังต้องตรวจว่าเอกสารครบหรือไม่'}</small><button class="primary-button sm" data-audit-open="${h(e.id)}">ตรวจเคสและเลือกผล</button></footer></article>`).join('') || '<div class="empty">ไม่พบเคสรอ Audit ตรวจในบริษัทและวันที่ที่เลือก — ไม่ใช่ยอดครบทั้งระบบ</div>'}</div>
      <p class="hint">ตรวจครบแล้วจึงส่งหัวหน้า · ถ้าเอกสารยังขาด ส่งกลับให้ผู้ชี้แจงจากเคสเดิม · ไม่เปิดเคสซ้ำและไม่ปิดจากการแนบไฟล์อย่างเดียว</p>
    </section>`;
    root.querySelectorAll('[data-audit-open]').forEach(b => b.onclick = () => ctx.openException(b.dataset.auditOpen));
    root.querySelector('[data-audit-overview]').onclick = ctx.openOverview;
    root.querySelector('[data-audit-refresh]').onclick = async event => {
      event.target.disabled = true;
      try { await ctx.refresh(); } catch (err) { ctx.toast('โหลดข้อมูลไม่ได้: ' + err.message, 'warn'); }
      finally { if (event.target.isConnected) event.target.disabled = false; }
    };
  }
  return { isWaiting, rows, mount };
})();
