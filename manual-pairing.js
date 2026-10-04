/* Production UI: the RPC, not the browser, decides permissions and reservation. */
const ManualPairing=(()=>{
  const canSubmit=()=>state.dataset==='production'&&Sb.signedIn()&&['monitor','lead','admin'].includes(state.role);
  const eligible=e=>e.status==='open'&&['missing_bo','missing_stm'].includes(e.type);
  const sourceRaw=e=>e.ex_type==='missing_bo'?e.stm_raw:e.ex_type==='missing_stm'?e.bo_raw:'';
  const describe=e=>`${e.company} · ${e.business_date} ${e.occurred_at||''} · ${e.account||'-'} · ${e.direction} · ${e.member_code||'-'}`;
  const original=e=>`BO: ${e.system_amount==null?'ไม่พบ':money(e.system_amount)} / STM/PM: ${e.bank_amount==null?'ไม่พบ':money(e.bank_amount)}`;
  const sourceCard=(row,label,raw)=>{
    const side=row.ex_type==='missing_stm'?'BO':'STM/PM';
    const amount=side==='BO'?row.system_amount:row.bank_amount;
    return `<div class="pair-card"><div class="pair-card-top"><div><span class="pair-eyebrow">${h(label)}</span><strong>${h(row.code||row.id)}</strong></div><div class="pair-amount"><span>${side}</span><strong>${money(amount)} <small>บาท</small></strong></div></div><dl class="pair-facts"><div><dt>บริษัท / รายการ</dt><dd>${h(row.company)} · ${h(row.direction)}</dd></div><div><dt>วันที่ / เวลา</dt><dd>${h(row.business_date)} · ${h(row.occurred_at||'ไม่ระบุเวลา')}</dd></div><div><dt>บัญชี / Provider</dt><dd>${h(row.account||'ไม่ระบุ')}</dd></div><div><dt>รหัสสมาชิก</dt><dd>${h(row.member_code||'ไม่ระบุ')}</dd></div></dl><details class="pair-raw"><summary>ดูข้อมูลต้นฉบับ</summary><pre>${h(raw||'ไม่มีข้อความต้นฉบับ')}</pre></details></div>`;
  };
  async function refresh(ids) {
    for(const id of ids){const row=await Sb.exceptionDetail(id);const index=DB.exceptions.findIndex(e=>e.dbId===id);if(row&&index>=0)Object.assign(DB.exceptions[index],mapLiveException(row));}
    render();
  }
  async function open(e,mode) {
    if(!canSubmit())return toast('เฉพาะเจ้าหน้าที่ Audit ในระบบจริงส่งคำขอได้','warn');
    if(!eligible(e))return toast('เลือกเคสเปิดที่มีรายการฝั่งเดียว BO ขาด STM หรือ STM/PM ขาด BO','warn');
    const current=await Sb.exceptionDetail(e.dbId).catch(err=>{toast(err.message,'warn');return null;});
    if(!current||current.status!=='open')return toast('สถานะเคสเปลี่ยน กรุณารีเฟรช','warn');
    const companies=DB.companies.map(c=>typeof c==='string'?c:c.code).filter(c=>c&&canAccessCompany(c)&&(mode==='same'?c===e.company:c!==e.company));
    if(!companies.length)return toast('ไม่มีสิทธิ์บริษัทคู่ที่เลือก','warn');
    const requestId=crypto.randomUUID();let candidates=[],selected=null,evidenceId=null,sent=false;
    const reasonOptions=[
      ['small_difference','ยอดต่างเล็กน้อย / การปัดเศษ (ไม่เกิน 5 บาท)'],
      ['posting_time','เวลาบันทึก BO กับ STM/PM ต่างกัน'],
      ['cross_day','รายการข้ามวัน / บันทึกคนละวัน'],
      ['reference_format','เลขอ้างอิงหรือรูปแบบข้อมูลต่างกัน'],
      ...(mode==='cross'?[['wrong_company','ลงรายการผิดบริษัท / โยกยอดระหว่างบริษัท']]:[]),
      ['other','อื่น ๆ — ระบุเหตุผลเอง']
    ];
    openModal(mode==='same'?'จับคู่เอง':'จับคู่ข้ามบริษัท',`<div class="manual-pair-form"><div class="pair-policy">จับคู่ BO ↔ STM/PM ทีละคู่ · ผลต่างไม่เกิน <b>5 บาท</b><span>ส่งแล้วทั้งสองเคสจะรอหัวหน้าทีมอีกคนอนุมัติ ยังไม่ปิดทันที</span></div><section class="pair-step"><h3><span>1</span> ตรวจรายการต้นทาง</h3>${sourceCard(current,caseLabel(e),sourceRaw(current))}</section><section class="pair-step"><h3><span>2</span> เลือกรายการที่จะจับคู่</h3><div class="pair-search-grid"><label>บริษัทคู่<select id="pairCompany">${companies.map(c=>`<option>${h(c)}</option>`).join('')}</select></label><label>วันที่เคสคู่<input id="pairDate" type="date" value="${h(e.date)}"></label><button class="ghost-button" id="pairSearch">ค้นหาเคสคู่</button></div><p id="pairSearchStatus" class="pair-search-status" role="status">เลือกวันที่ แล้วกดค้นหาเคสคู่</p><label>เคสคู่<select id="pairCandidate"><option value="">ยังไม่ได้เลือก — ค้นหาก่อน</option></select></label><div id="pairCompare"></div></section><section class="pair-step"><h3><span>3</span> ระบุเหตุผลและยืนยัน</h3><label>เหตุผลหลัก<select id="pairReasonType"><option value="">เลือกเหตุผลที่ตรงกับเคส</option>${reasonOptions.map(([key,label])=>`<option value="${h(key)}">${h(label)}</option>`).join('')}</select></label><p class="pair-field-hint">เลือกเหตุผลหลักได้โดยไม่ต้องพิมพ์ซ้ำ แต่ยังต้องตรวจรายการและหลักฐาน</p><label><span id="pairReasonLabel">รายละเอียดเพิ่มเติม (ถ้ามี)</span><textarea id="pairReason" maxlength="2000" rows="3" placeholder="เพิ่มเลขอ้างอิงหรือบริบทที่ช่วยให้หัวหน้าทีมตรวจได้"></textarea></label><p id="pairReasonHelp" class="pair-field-hint">หากเลือก “อื่น ๆ” ต้องอธิบายอย่างน้อย 10 ตัวอักษร · เหตุผลรวมไม่เกิน 2,000 ตัวอักษร</p><label>แนบหลักฐาน ${mode==='cross'?'(บังคับสำหรับข้ามบริษัท)':'(ถ้ามี)'}<input id="pairFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.txt"></label><p class="pair-field-hint">หลักฐานจะเก็บในคลังและผูกกับเคสต้นทาง</p><label class="pair-confirm"><input type="checkbox" id="pairChecked"><span>ตรวจบัญชี อ้างอิง วันเวลา และเหตุผลแล้ว<br><small>ยืนยันว่าเป็นรายการที่สัมพันธ์กันจริง</small></span></label></section></div>`, '<button class="ghost-button" id="pairCancel">ยกเลิก</button><button class="primary-button" id="pairSubmit">ส่งให้หัวหน้าทีมอนุมัติ</button>');
    $('#pairCancel').onclick=closeModal;
    $('#pairReasonType').onchange=()=>{
      const other=$('#pairReasonType').value==='other';
      $('#pairReasonLabel').textContent=other?'ระบุเหตุผลอื่น ๆ (อย่างน้อย 10 ตัวอักษร)':'รายละเอียดเพิ่มเติม (ถ้ามี)';
      $('#pairReason').required=other;$('#pairReason').minLength=other?10:0;
      $('#pairChecked').checked=false;
    };
    let searchVersion=0;
    const resetChoice=()=>{searchVersion++;candidates=[];selected=null;$('#pairCompare').textContent='';$('#pairChecked').checked=false;$('#pairCandidate').innerHTML='<option value="">ยังไม่ได้เลือก — ค้นหาก่อน</option>';$('#pairSearchStatus').textContent='เลือกวันที่ แล้วกดค้นหาเคสคู่';};
    $('#pairCompany').onchange=resetChoice;$('#pairDate').onchange=resetChoice;
    $('#pairSearch').onclick=async event=>{
      resetChoice();const version=searchVersion;
      event.target.disabled=true;$('#pairSearchStatus').textContent='กำลังค้นหาเคสคู่…';
      try{
        const found=await Sb.manualPairCandidates($('#pairCompany').value,$('#pairDate').value,e.type==='missing_stm'?'missing_bo':'missing_stm');
        if(version!==searchVersion)return;
        candidates=found;
        candidates=candidates.filter(c=>c.id!==e.dbId&&c.direction===e.direction);
        $('#pairSearchStatus').textContent=candidates.length>200?'พบเกิน 200 เคส แสดง 200 รายการแรกเท่านั้น ไม่ใช่ข้อมูลครบ':'พบ '+candidates.length+' เคสเปิด';
        $('#pairCandidate').innerHTML='<option value="">เลือกเคส</option>'+candidates.slice(0,200).map(c=>`<option value="${h(c.id)}">${h(c.code||c.id)} · ${money(c.ex_type==='missing_stm'?c.system_amount:c.bank_amount)} บาท · ${h(c.occurred_at||'ไม่ระบุเวลา')} · ${h(c.account||'-')}</option>`).join('');
      }catch(err){if(version===searchVersion){candidates=[];$('#pairCandidate').innerHTML='<option value="">โหลดไม่สำเร็จ</option>';$('#pairSearchStatus').textContent=err.message;}}
      finally{event.target.disabled=false;}
    };
    $('#pairCandidate').onchange=()=>{
      selected=candidates.find(c=>c.id===$('#pairCandidate').value)||null;
      $('#pairChecked').checked=false;
      if(!selected){$('#pairCompare').textContent='';return;}
      const bo=e.type==='missing_stm'?current:selected,stm=e.type==='missing_bo'?current:selected;
      const diff=Math.abs(Math.round(Number(bo.system_amount)*100)-Math.round(Number(stm.bank_amount)*100))/100;
      $('#pairCompare').innerHTML=`${sourceCard(selected,'เคสคู่ที่เลือก',sourceRaw(selected))}<div class="pair-comparison"><div><span>ยอด BO</span><strong>${money(bo.system_amount)} <small>บาท</small></strong></div><div><span>ยอด STM/PM</span><strong>${money(stm.bank_amount)} <small>บาท</small></strong></div></div><p class="pair-difference ${diff>5?'over':'within'}">ผลต่าง <b>${money(diff)} บาท</b> · ${diff>5?'เกิน 5 บาท จับคู่ไม่ได้':'อยู่ในเกณฑ์ยอด — ต้องตรวจบริบทและรออนุมัติ'}</p>`;
    };
    $('#pairSubmit').onclick=async event=>{
      if(sent)return;
      const reasonType=$('#pairReasonType').value;
      const reasonOption=reasonOptions.find(([key])=>key===reasonType);
      const detail=$('#pairReason').value.trim();
      if(!selected||!$('#pairChecked').checked||!reasonOption)return toast('เลือกเคสคู่ เลือกเหตุผลหลัก และยืนยันการตรวจรายการ','warn');
      if(reasonType==='other'&&detail.length<10)return toast('เหตุผลอื่น ๆ ต้องอธิบายอย่างน้อย 10 ตัวอักษร','warn');
      const reason=reasonType==='other'?'อื่น ๆ: '+detail:'เหตุผล: '+reasonOption[1]+(detail?'\nรายละเอียด: '+detail:'');
      if(reason.length>2000)return toast('เหตุผลรวมรายละเอียดต้องไม่เกิน 2,000 ตัวอักษร','warn');
      const bo=e.type==='missing_stm'?current:selected,stm=e.type==='missing_bo'?current:selected;
      if(Math.abs(Math.round(Number(bo.system_amount)*100)-Math.round(Number(stm.bank_amount)*100))>500)return toast('ผลต่างเกิน 5 บาท จับคู่ไม่ได้','warn');
      const file=$('#pairFile').files[0];if(mode==='cross'&&!file&&!evidenceId)return toast('ข้ามบริษัทต้องแนบหลักฐาน','warn');
      event.target.disabled=true;
      try{
        if(file&&!evidenceId)evidenceId=(await Sb.uploadCaseEvidence(e.dbId,file)).id;
        const pair=await Sb.submitManualPair({p_id:requestId,p_bo:bo.id,p_stm:stm.id,p_mode:mode,p_reason:reason,p_evidence:evidenceId});
        if(!pair?.id)throw new Error('ยังไม่พบผลยืนยันคำขอ ไม่ส่งคำขอใหม่');
        sent=true;closeModal();await refresh([bo.id,stm.id]);await openException(e.id);toast('จับคู่แล้ว รอหัวหน้าทีมอนุมัติ ยังไม่ปิดเคส');
      }catch(err){toast((sent?'บันทึกจับคู่แล้ว แต่โหลดหน้าจอไม่สำเร็จ: ':'ยังยืนยันคำขอไม่ได้ กรุณาลองในหน้าต่างเดิมเพื่อไม่สร้างคำขอซ้ำ: ')+err.message,'warn');}
      finally{event.target.disabled=false;}
    };
  }
  async function mountReview(e,host) {
    if(!e.manualPairId||!host)return;
    host.textContent='กำลังโหลดคำขอจับคู่…';
    try{
      const p=await Sb.manualPair(e.manualPairId);if(!host.isConnected)return;
      if(!p)throw new Error('ไม่พบคำขอหรือไม่มีสิทธิ์ทั้งสองบริษัท');
      host.className='manual-pair-review';
      host.innerHTML=`<h3>${p.status==='pending'?'จับคู่แล้ว รอหัวหน้าทีมอนุมัติ':'ประวัติการจับคู่'}</h3><p>${h(p.bo_company)} BO ↔ ${h(p.stm_company)} STM/PM · ผลต่าง ${money(p.difference)} บาท</p><p>${h(p.reason)}</p><p>คำขอ ${h(p.id)} · ผู้ส่ง ${h(p.submitted_by)} · ${h(p.submitted_at)}</p><p>${h(p.decision_note||'')}</p><button class="ghost-button sm" id="pairOther">เปิดเคสคู่</button>${p.evidence_id?'<button class="ghost-button sm" id="pairEvidence">เปิดหลักฐานจับคู่</button>':''}${p.status==='pending'?'<label>เหตุผลผลอนุมัติ (อย่างน้อย 10 ตัวอักษร)<textarea id="pairDecision" maxlength="2000"></textarea></label><label><input type="checkbox" id="pairDecisionChecked">ตรวจทั้งสองเคสและหลักฐานแล้ว</label><button class="primary-button" id="pairApprove">อนุมัติและปิดทั้งคู่</button><button class="ghost-button" id="pairReject">ไม่อนุมัติ คืนทั้งสองเคส</button>':''}`;
      $('#pairOther').onclick=async()=>{try{await openEvidenceRelatedCase(p.bo_case_id===e.dbId?p.stm_case_id:p.bo_case_id);}catch(err){toast(err.message,'warn');}};
      $('#pairEvidence')?.addEventListener('click',async()=>{try{const files=(await Promise.all([Sb.caseEvidence(p.bo_case_id),Sb.caseEvidence(p.stm_case_id)])).flat();const file=files.find(f=>f.id===p.evidence_id);if(!file)throw new Error('หลักฐานไม่อยู่ในทะเบียน');window.open(await Sb.signedUrl(file.storage_path),'_blank','noopener');}catch(err){toast(err.message,'warn');}});
      for(const [id,action] of [['pairApprove','approve'],['pairReject','reject']]){
        const button=$('#'+id);if(!button)continue;
        button.disabled=!can('approve')||p.submitted_by===Sb.authUser()?.id;
        button.title=p.submitted_by===Sb.authUser()?.id?'ให้หัวหน้าทีมอีกคนตรวจ ไม่อนุมัติคำขอตนเอง':'';
        button.onclick=async()=>{const note=$('#pairDecision').value.trim();if(note.length<10||!$('#pairDecisionChecked').checked)return toast('ตรวจหลักฐานและระบุเหตุผลอย่างน้อย 10 ตัวอักษร','warn');$('#pairApprove').disabled=$('#pairReject').disabled=true;try{await Sb.decideManualPair({p_id:p.id,p_action:action,p_note:note});await refresh([p.bo_case_id,p.stm_case_id]);await openException(e.id);toast(action==='approve'?'หัวหน้าทีมอนุมัติ ปิดทั้งสองเคสแล้ว':'ไม่อนุมัติ คืนคู่เคสแล้ว');}catch(err){toast(err.message,'warn');$('#pairApprove').disabled=$('#pairReject').disabled=false;}};
      }
    }catch(err){host.textContent='ตรวจคำขอจับคู่ไม่ได้: '+err.message+' — ห้ามปิดผ่านปุ่มเดิม';}
  }
  async function mountQueue(host) {
    if(!host||state.dataset!=='production'||!Sb.signedIn())return;
    host.textContent='กำลังโหลดคู่รออนุมัติทุกวันที่ตามสิทธิ์…';
    try {
      const pairs=await Sb.pendingManualPairs();if(!host.isConnected)return;
      host.innerHTML='<h3>คู่รออนุมัติทุกวันที่ตามสิทธิ์</h3><p class="hint">รวมคำขอจากผลรันเก่า หากมีการรันใหม่ต้องตรวจใหม่หรือคืนคู่ ห้ามปิดข้ามผลรัน</p>'+ (pairs.length>200?'<p>แสดง 200 คู่แรก ยังไม่ใช่รายการครบทั้งหมด</p>':'')+pairs.slice(0,200).map(p=>`<div class="manual-pair-source"><b>${h(p.bo_company)} BO ↔ ${h(p.stm_company)} STM/PM</b> · ผลต่าง ${money(p.difference)} บาท · ${h(p.submitted_at)}<p>${h(p.reason)}</p><button class="ghost-button sm" data-pair-case="${h(p.bo_case_id)}">ตรวจคู่ / คืนคู่</button></div>`).join('')+(pairs.length?'':'<p>ไม่พบคู่รออนุมัติตามสิทธิ์ทั้งสองบริษัท</p>');
      host.querySelectorAll('[data-pair-case]').forEach(b=>b.onclick=()=>openEvidenceRelatedCase(b.dataset.pairCase).catch(err=>toast(err.message,'warn')));
    } catch(err){if(host.isConnected)host.textContent='โหลดคู่รออนุมัติไม่สำเร็จ: '+err.message;}
  }
  return {open,mountReview,mountQueue};
})();
