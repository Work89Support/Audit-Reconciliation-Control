/* Document review is not a company clarification request or an automatic loss. */
const CaseClosure=(()=>{
  const queueState={rows:null,loading:false,error:'',at:0,user:null};
  const auditable=()=>Sb.signedIn()&&['monitor','lead','admin'].includes(state.role);
  const outcomeLabel=q=>q.outcome==='no_loss'?'ไม่มีความเสียหาย (0 บาท)':`เสียหายจริง ${money(q.loss_amount)} บาท`;
  function approvalNote(action,value){
    const note=String(value||'').trim();
    if(note.length>2000||(action==='reject'&&note.length<10))throw Error('ส่งกลับต้องระบุเหตุผล 10–2,000 ตัวอักษร ส่วนอนุมัติไม่บังคับ');
    return note;
  }
  function selfEligible(q){
    const a=q.snapshot?.system_amount,b=q.snapshot?.bank_amount;
    return q.outcome==='no_loss'&&a!=null&&b!=null&&Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=5;
  }
  async function loadPending(force=false){
    if(state.dataset!=='production'||!auditable())return;
    const user=Sb.authUser()?.id;
    if(queueState.user!==user)Object.assign(queueState,{rows:null,error:'',at:0,user});
    if(queueState.loading||(!force&&Date.now()-queueState.at<60000))return;
    queueState.loading=true;
    try{const rows=await Sb.pendingCaseClosures();if(Sb.authUser()?.id===user){queueState.rows=rows;queueState.error='';}}
    catch(err){if(Sb.authUser()?.id===user){queueState.rows=null;queueState.error=err.message;}}
    finally{queueState.loading=false;queueState.at=Date.now();if(typeof renderNav==='function')renderNav();}
  }
  async function openSubmit(e,initialOutcome='no_loss'){
    if(state.dataset!=='production'||!auditable())return toast('เฉพาะ Audit ในระบบจริงส่งผลตรวจให้หัวหน้าได้','warn');
    const fresh=await Sb.exceptionDetail(e.dbId);
    if(!fresh||!['open','clarifying','answered'].includes(fresh.status)||fresh.manual_pair_id||fresh.case_closure_request_id)return toast('มีคำขออยู่แล้วหรือสถานะเปลี่ยน กรุณาโหลดเคสใหม่','warn');
    const id=crypto.randomUUID();let sent=false;
    openModal('Audit ตรวจผลและส่งหัวหน้ารอปิดเคส',`<p>${h(caseLabel(e))}</p><p>มีเอกสารแล้ว: ตรวจและส่งหัวหน้า ไม่ส่งงานให้ผู้ชี้แจงบริษัทซ้ำ</p><label>ผลตรวจ<select id="closureOutcome"><option value="no_loss">ไม่มีความเสียหาย — ปิด 0 บาท</option><option value="damage">ยืนยันความเสียหายจริง</option></select></label><div id="closureLossFields" hidden><label>ยอดเสียหายจริง (บาท)<input type="number" step="0.01" min="0.01" id="closureLossAmount"></label><label>ประเภทความเสียหาย<select id="closureLossCategory"><option value="">เลือกประเภท</option>${Object.entries(DamageSummary.categories).filter(([k])=>!['unclassified','system'].includes(k)).map(([k,v])=>`<option value="${h(k)}">${h(v)}</option>`).join('')}</select></label><p>ไม่มีเอกสาร: ต้องส่งขอชี้แจงและครบ SLA ตามบริษัทก่อนเสนอ แต่หมด SLA อย่างเดียวไม่ได้แปลว่าพิสูจน์ความเสียหายแล้ว</p></div><label>ผลตรวจ Audit / หลักฐานอ้างอิง (10–2,000 ตัวอักษร)<textarea id="closureAuditReason" maxlength="2000">${h((e.notes||[]).map(n=>n.text).filter(Boolean).join('\n')||e.resolutionNote||'')}</textarea></label><label><input type="checkbox" id="closureAuditChecked">ตรวจเอกสารที่เกี่ยวกับเคสนี้ และยืนยันผลยอดจริงแล้ว ไม่ได้สรุปจากยอดต่างหรือหมด SLA อย่างเดียว</label>`, '<button class="ghost-button" id="closureCancel">ยกเลิก</button><button class="primary-button" id="closureSend">ส่งหัวหน้ารอปิดเคส</button>');
    $('#closureCancel').onclick=closeModal;
    $('#closureOutcome').onchange=()=>{$('#closureLossFields').hidden=$('#closureOutcome').value!=='damage';$('#closureAuditChecked').checked=false;};
    if(initialOutcome==='damage'){$('#closureOutcome').value='damage';$('#closureOutcome').onchange();}
    $('#closureSend').onclick=async event=>{
      const outcome=$('#closureOutcome').value,raw=$('#closureLossAmount').value,reason=$('#closureAuditReason').value.trim();
      const amount=outcome==='no_loss'?0:Number(raw),category=outcome==='no_loss'?null:$('#closureLossCategory').value;
      if(!$('#closureAuditChecked').checked||reason.length<10||reason.length>2000||!Number.isFinite(amount)||(outcome==='damage'&&(!/^\d+(\.\d{1,2})?$/.test(raw)||amount<=0||!category)))return toast('ตรวจและกรอกผลยอด/เหตุผลให้ครบก่อนส่ง','warn');
      event.target.disabled=true;
      try{
        const saved=await Sb.submitCaseClosure({p_id:id,p_case:e.dbId,p_outcome:outcome,p_amount:amount,p_reason:reason,p_category:category});
        if(saved?.id!==id||saved.status!=='pending')throw Error('ยังยืนยันคำขอในฐานข้อมูลไม่ได้');
        sent=true;closeModal();await loadPending(true);await openEvidenceRelatedCase(e.dbId);showCaseSubmissionReceipt('request',caseLabel(e));
      }catch(err){toast((sent?'ส่งแล้วแต่โหลดหน้าจอไม่ได้: ':'ยังยืนยันคำขอไม่ได้: ')+err.message+' — ตรวจสถานะก่อนส่งซ้ำ','warn');}
      finally{event.target.disabled=false;}
    };
  }
  async function mountReview(e,host){
    if(!host||!e.closureRequestId)return;
    host.textContent='กำลังโหลดผลตรวจรอหัวหน้า…';
    try{
      const q=await Sb.caseClosureRequest(e.closureRequestId);if(!q)throw Error('ไม่พบคำขอหรือไม่มีสิทธิ์');if(!host.isConnected)return;
      const own=q.requested_by===Sb.authUser()?.id,blocked=!can('approve')||(own&&!selfEligible(q));
      host.innerHTML=`<h3>${q.status==='pending'?'Audit ตรวจแล้ว — รอหัวหน้าปิดเคส':'ผลปิดเคส'}</h3><p><b>${h(outcomeLabel(q))}</b></p><p>${h(q.audit_reason)}</p><p>${h(q.decision_note||'')}</p><p>คำขอ ${h(q.id)} · ผู้ส่ง ${h(q.requested_by)}</p>${q.status==='pending'?`<p>${blocked?'บัญชีนี้อนุมัติไม่ได้ หรือคำขอตัวเองไม่ผ่านเงื่อนไข ต้องให้หัวหน้าอีกบัญชีตรวจ':'หัวหน้าตรวจเอกสารและผลยอดก่อนอนุมัติ — เหตุผลอนุมัติไม่บังคับ'}</p><label>เหตุผลอนุมัติ (ไม่บังคับ) / ส่งกลับต้องระบุเหตุผล<textarea id="closureHeadNote" maxlength="2000"></textarea></label><label><input type="checkbox" id="closureHeadChecked">ตรวจเอกสารและผล Audit แล้ว ยืนยัน ${h(outcomeLabel(q))}</label><button class="primary-button" id="closureApprove" ${blocked?'disabled':''}>อนุมัติและปิดเคส</button><button class="ghost-button" id="closureReject" ${blocked||own?'disabled':''}>ส่งกลับ Audit</button>`:''}`;
      if(q.status!=='pending')return;
      for(const [buttonId,action] of [['closureApprove','approve'],['closureReject','reject']])$('#'+buttonId).onclick=async event=>{
        if(blocked||!$('#closureHeadChecked').checked)return toast('ต้องตรวจหลักฐานและติ๊กยืนยันผลก่อน','warn');
        let note;try{note=approvalNote(action,$('#closureHeadNote').value);}catch(err){return toast(err.message,'warn');}
        event.target.disabled=true;
        try{const saved=await Sb.decideCaseClosure({p_id:q.id,p_action:action,p_note:note});if(saved?.status!==(action==='approve'?'approved':'rejected'))throw Error('ยังยืนยันผลไม่ได้');await loadPending(true);await openEvidenceRelatedCase(e.dbId);toast(action==='approve'?`ปิดเคสแล้ว — ${outcomeLabel(saved)}`:'ส่งกลับ Audit แล้ว');}
        catch(err){toast('ยังยืนยันผลไม่ได้: '+err.message+' — โหลดคำขอใหม่ก่อนลองซ้ำ','warn');await mountReview(e,host);}
      };
    }catch(err){host.textContent='โหลดผลตรวจรอปิดไม่ได้: '+err.message;}
  }
  async function mountQueue(host){
    if(host&&!auditable()){host.textContent='คิวนี้สำหรับ Audit และหัวหน้าเท่านั้น ผู้ชี้แจงติดตามคำตอบของตนในเมนูติดตามและอนุมัติ';return;}
    if(!host)return;await loadPending(true);if(!host.isConnected)return;
    if(queueState.rows===null){host.textContent='ยังโหลดยอดรอหัวหน้าไม่ครบ: '+queueState.error;return;}
    let rows=queueState.rows;const companies=companyMaster().map(c=>typeof c==='string'?c:c.code).filter(c=>canAccessCompany(c));
    host.classList.add('closure-hub');
    host.innerHTML=`<header class="closure-hub-heading"><div><p class="closure-eyebrow">ตรวจเอกสาร · อนุมัติ · ย้อนดูประวัติ</p><h3>ศูนย์รอปิดเคส</h3><p class="closure-subtitle">เปิดเคสเดิม ตรวจหลักฐาน แล้วดำเนินการตามสิทธิ์</p></div><div class="closure-pending-total"><strong>${rows.length}</strong><span>คำขอรอหัวหน้า</span></div></header><div class="closure-flow" aria-label="ขั้นตอนปิดเคส"><span><i>1</i> Audit ตรวจเอกสาร</span><span><i>2</i> ส่งหัวหน้ารอปิด</span><span><i>3</i> หัวหน้าอนุมัติ</span></div><div class="closure-filter-grid"><label for="closureQueueStatus">สถานะคำขอ<select id="closureQueueStatus"><option value="pending">รอหัวหน้าปิดเคส</option><option value="ALL">ทุกคำขอ · รวมประวัติ</option><option value="approved">อนุมัติปิดแล้ว</option><option value="rejected">ส่งกลับ Audit</option></select></label><label for="closureQueueCompany">บริษัท<select id="closureQueueCompany"><option value="ALL">ทุกบริษัทตามสิทธิ์</option>${companies.map(c=>`<option>${h(c)}</option>`).join('')}</select></label><label for="closureQueueFrom">วันที่เคสตั้งแต่<input type="date" id="closureQueueFrom"></label><label for="closureQueueTo">ถึงวันที่<input type="date" id="closureQueueTo"></label></div><div class="closure-list-heading"><b>รายการคำขอ <span id="closureVisibleCount"></span></b><span>เคสเดิมและเอกสารยังอยู่ในภาพรวม</span></div><div id="closureQueueRows" class="closure-card-list" aria-live="polite"></div><p class="closure-history-note">การส่งหัวหน้ารอปิดไม่ส่งงานให้ผู้ชี้แจงซ้ำ · อนุมัติสำเร็จจึงถือว่าปิดเคส · ย้อนดูรายละเอียดและหลักฐานได้เสมอ</p>`;
    const draw=()=>{
      const company=$('#closureQueueCompany').value,from=$('#closureQueueFrom').value,to=$('#closureQueueTo').value;
      if(from&&to&&from>to){$('#closureVisibleCount').textContent='';$('#closureQueueRows').innerHTML='<div class="closure-empty" role="status">วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด</div>';return;}
      const visible=rows.filter(q=>(company==='ALL'||q.company===company)&&(!from||q.business_date>=from)&&(!to||q.business_date<=to));
      $('#closureVisibleCount').textContent=`(${visible.length})`;
      $('#closureQueueRows').innerHTML=visible.map(q=>{
        const statusText=q.status==='pending'?'รอหัวหน้าปิดเคส':q.status==='approved'?'ปิดเคสแล้ว':'ส่งกลับ Audit';
        const amount=v=>v==null?'ไม่พบรายการ':`${money(v)} บาท`;
        const date=q.business_date?String(q.business_date).split('-').reverse().join('/'):'ไม่ระบุ';
        return `<article class="closure-case-card"><div class="closure-case-top"><div><span class="closure-company">${h(q.company)}</span><h4>${h(q.snapshot?.code||q.exception_id)}</h4><span class="closure-case-date">วันที่เคส ${h(date)}</span></div><span class="closure-state ${q.status==='approved'?'is-approved':q.status==='pending'?'is-pending':'is-returned'}">${h(statusText)}</span></div><div class="closure-case-amounts"><div><span>ยอด BO</span><strong>${h(amount(q.snapshot?.system_amount))}</strong></div><div><span>ยอด STM / PM</span><strong>${h(amount(q.snapshot?.bank_amount))}</strong></div><div class="closure-outcome ${q.outcome==='no_loss'?'is-zero':'is-loss'}"><span>ผลตรวจที่เสนอ</span><strong>${h(outcomeLabel(q))}</strong></div></div><div class="closure-case-bottom"><div><span>ผลตรวจ Audit / หลักฐานอ้างอิง</span><p>${h(q.audit_reason||'ไม่ระบุ')}</p></div><button class="${q.status==='pending'?'primary-button':'ghost-button'} sm" data-closure-open="${h(q.exception_id)}">${q.status==='pending'?'เปิดเคสเพื่อตรวจ':'ดูรายละเอียดและประวัติ'} →</button></div></article>`;
      }).join('')||'<div class="closure-empty"><b>ไม่มีคำขอตามตัวกรองนี้</b><p>เคสที่แนบเอกสารอย่างเดียว ยังต้องให้ Audit ตรวจผลและส่งหัวหน้าก่อน<br>ดูเคสเดิมได้ในรายการภาพรวมด้านล่าง หรือเลือกสถานะ “ทุกคำขอ” เพื่อดูประวัติ</p></div>';
      host.querySelectorAll('[data-closure-open]').forEach(b=>b.onclick=()=>openEvidenceRelatedCase(b.dataset.closureOpen,{focusFiles:true}).catch(err=>toast(err.message,'warn')));
    };
    ['closureQueueCompany','closureQueueFrom','closureQueueTo'].forEach(id=>$('#'+id).onchange=draw);
    $('#closureQueueStatus').onchange=async event=>{const status=event.target.value;$('#closureQueueRows').textContent='กำลังอ่านประวัติจริง…';try{const all=await Sb.caseClosureHistory();if(!host.isConnected||$('#closureQueueStatus').value!==status)return;rows=all.filter(q=>status==='ALL'||q.status===status);draw();}catch(err){if(host.isConnected)$('#closureQueueRows').textContent='อ่านประวัติไม่สำเร็จ: '+err.message;}};draw();
  }
  async function mountSettings(root){
    root.innerHTML='<section class="panel"><h2>ตั้งค่า SLA เอกสารแยกบริษัท</h2><p>กำลังโหลดค่าจริง…</p></section>';
    try{
      const rows=await Sb.companyCaseSlas();if(!root.isConnected)return;const values=new Map(rows.map(s=>[s.company,s.document_days]));
      const companies=companyMaster().map(c=>typeof c==='string'?c:c.code).filter(c=>canAccessCompany(c));
      root.innerHTML=`<section class="panel"><h2>ตั้งค่า SLA เอกสารแยกบริษัท</h2><p>นับจากวันส่งขอชี้แจง ใช้กับคำขอใหม่เท่านั้น ไม่ย้อนเปลี่ยนเคสเก่า ไม่รีเซ็ตเมื่อส่งซ้ำ และไม่ปิดความเสียหายอัตโนมัติ</p><p>ค่าบริษัทที่ยังไม่ตั้งใช้ 15 วันเป็นค่าเริ่มต้น</p>${companies.map(c=>`<form data-sla-company="${h(c)}"><label>${h(c)}<input type="number" min="1" max="365" step="1" value="${values.get(c)||15}" name="days"> วัน</label><button class="primary-button sm" type="submit">บันทึก SLA ${h(c)}</button><span role="status"></span></form>`).join('')}</section>`;
      root.querySelectorAll('[data-sla-company]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const days=Number(form.elements.days.value);if(!Number.isInteger(days)||days<1||days>365)return toast('กำหนด 1–365 วัน','warn');const button=form.querySelector('button');button.disabled=true;try{const saved=await Sb.saveCompanyCaseSla(form.dataset.slaCompany,days);if(saved?.document_days!==days)throw Error('ยังยืนยันค่าไม่ได้');form.querySelector('[role=status]').textContent='บันทึกแล้ว ใช้กับคำขอใหม่';}catch(err){form.querySelector('[role=status]').textContent='บันทึกไม่สำเร็จ: '+err.message;}finally{button.disabled=false;}});
    }catch(err){root.innerHTML=`<section class="panel"><p>โหลดการตั้งค่าไม่ได้: ${h(err.message)} — ไม่ถือว่าเป็นค่าศูนย์</p></section>`;}
  }
  return {queueState,loadPending,openSubmit,mountReview,mountQueue,mountSettings,approvalNote,selfEligible,outcomeLabel};
})();
