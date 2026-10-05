/* Production UI: the RPC, not the browser, decides permissions and reservation. */
const ManualPairing=(()=>{
  const queueState={rows:null,loading:false,error:'',at:0,user:null};
  const queueFilters={company:'ALL',from:'',to:'',user:null};
  function filterPairs(pairs,filters){
    return pairs.filter(p=>['bo','stm'].some(side=>{
      const company=p[side+'_company'],date=p.snapshot?.[side]?.business_date;
      return (filters.company==='ALL'||company===filters.company)&&(!filters.from||(date&&date>=filters.from))&&(!filters.to||(date&&date<=filters.to));
    }));
  }
  const selfApprovalCandidate=p=>['lead','admin'].includes(state.role)&&p.mode==='same'&&p.bo_company===p.stm_company&&p.difference!=null&&Number.isFinite(Number(p.difference))&&Number(p.difference)>=0&&Number(p.difference)<=5&&!!(p._hasStoredEvidence||p.evidence_id||p.snapshot?.bo?.clarification_file_id||p.snapshot?.stm?.clarification_file_id);
  const decisionBlockReason=p=>!Sb.signedIn()?'กรุณาเข้าสู่ระบบก่อนตรวจคำขอ':!can('approve')?'บัญชีนี้ไม่มีสิทธิ์อนุมัติ — ให้หัวหน้าทีม / ผู้ดูแลระบบตรวจ':p.status!=='pending'?'คำขอนี้ไม่ได้รออนุมัติ':p.submitted_by===Sb.authUser()?.id&&!selfApprovalCandidate(p)?'คำขอตัวเองต้องเป็นบริษัทเดียวกัน ยอดต่างไม่เกิน 5 บาท และมีหลักฐานจริง มิฉะนั้นให้หัวหน้าอีกบัญชีตรวจ':'';
  async function loadPending(force=false){
    if(state.dataset!=='production'||!Sb.signedIn())return;
    const user=Sb.authUser()?.id;
    if(queueState.user!==user){Object.assign(queueState,{rows:null,error:'',at:0,user});}
    if(queueState.loading||(!force&&Date.now()-queueState.at<60000))return;
    queueState.loading=true;
    try{const rows=await Sb.pendingManualPairs();if(Sb.authUser()?.id!==user)return;queueState.rows=rows;queueState.error='';}
    catch(err){if(Sb.authUser()?.id===user){queueState.rows=null;queueState.error=err.message;}}
    finally{queueState.loading=false;queueState.at=Date.now();if(typeof renderNav==='function')renderNav();}
  }
  const canSubmit=()=>state.dataset==='production'&&Sb.signedIn()&&['monitor','lead','admin'].includes(state.role);
  const eligible=e=>['missing_bo','missing_stm','amount_diff'].includes(e.type)&&(e.status==='open'||(e.type==='amount_diff'&&['clarifying','answered'].includes(e.status)));
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
    await loadPending(true);
    render();
  }
  async function open(e,mode) {
    if(!canSubmit())return toast('เฉพาะเจ้าหน้าที่ Audit ในระบบจริงส่งคำขอได้','warn');
    if(!eligible(e))return toast('เลือกเคสเปิดที่ขาดอีกฝั่ง หรือเคสยอด BO กับ STM/PM ต่างกัน','warn');
    const amountDifference=e.type==='amount_diff';
    if(amountDifference&&mode!=='same')return toast('เคสยอดต่างที่มีทั้งสองฝั่งแล้ว ให้ใช้จับคู่เอง ไม่ใช่จับคู่ข้ามบริษัท','warn');
    const current=await Sb.exceptionDetail(e.dbId).catch(err=>{toast(err.message,'warn');return null;});
    if(!current||!eligible({type:current.ex_type,status:current.status}))return toast('สถานะเคสเปลี่ยน กรุณารีเฟรช','warn');
    if(amountDifference&&current.ex_type!=='amount_diff')return toast('ประเภทเคสเปลี่ยน กรุณารีเฟรช','warn');
    const companies=companyMaster().map(c=>typeof c==='string'?c:c.code).filter(c=>c&&canAccessCompany(c)&&(mode==='same'?c===e.company:c!==e.company));
    if(!companies.length)return toast('ไม่มีสิทธิ์บริษัทคู่ที่เลือก','warn');
    const requestId=crypto.randomUUID();let candidates=[],selected=amountDifference?current:null,evidenceId=null,sent=false;
    const sides=()=>({bo:amountDifference||e.type==='missing_stm'?current:selected,stm:amountDifference||e.type==='missing_bo'?current:selected});
    const reasonOptions=[
      ['small_difference','ยอดต่างเล็กน้อย / การปัดเศษ (ไม่เกิน 5 บาท)'],
      ['posting_time','เวลาบันทึก BO กับ STM/PM ต่างกัน'],
      ['cross_day','รายการข้ามวัน / บันทึกคนละวัน'],
      ['reference_format','เลขอ้างอิงหรือรูปแบบข้อมูลต่างกัน'],
      ...(mode==='cross'?[['wrong_company','ลงรายการผิดบริษัท / โยกยอดระหว่างบริษัท']]:[]),
      ['other','อื่น ๆ — ระบุเหตุผลเอง']
    ];
    openModal(mode==='same'?'จับคู่เอง':'จับคู่ข้ามบริษัท',`<div class="manual-pair-form"><div class="pair-policy">จับคู่ BO ↔ STM/PM ทีละคู่ · ผลต่างไม่เกิน <b>5 บาท</b><span>พนักงานส่งให้หัวหน้าอนุมัติ · หัวหน้าทำเองได้เฉพาะบริษัทเดียวกันและมีหลักฐานจริง · ไม่บันทึกเป็นความเสียหาย</span></div><section class="pair-step"><h3><span>1</span> ตรวจรายการต้นทาง</h3>${sourceCard(current,caseLabel(e),sourceRaw(current))}</section><section class="pair-step"><h3><span>2</span> เลือกรายการที่จะจับคู่</h3><div class="pair-search-grid"><label>บริษัทคู่<select id="pairCompany">${companies.map(c=>`<option>${h(c)}</option>`).join('')}</select></label><label>วันที่เคสคู่<input id="pairDate" type="date" value="${h(e.date)}"></label><button class="ghost-button" id="pairSearch">ค้นหาเคสคู่</button></div><p id="pairSearchStatus" class="pair-search-status" role="status">เลือกวันที่ แล้วกดค้นหาเคสคู่</p><label>เคสคู่<select id="pairCandidate"><option value="">ยังไม่ได้เลือก — ค้นหาก่อน</option></select></label><div id="pairCompare"></div></section><section class="pair-step"><h3><span>3</span> ระบุเหตุผลและยืนยัน</h3><label>เหตุผลหลัก<select id="pairReasonType"><option value="">เลือกเหตุผลที่ตรงกับเคส</option>${reasonOptions.map(([key,label])=>`<option value="${h(key)}">${h(label)}</option>`).join('')}</select></label><p class="pair-field-hint">เลือกเหตุผลหลักได้โดยไม่ต้องพิมพ์ซ้ำ แต่ยังต้องตรวจรายการและหลักฐาน</p><label><span id="pairReasonLabel">รายละเอียดเพิ่มเติม (ถ้ามี)</span><textarea id="pairReason" maxlength="2000" rows="3" placeholder="เพิ่มเลขอ้างอิงหรือบริบทที่ช่วยให้หัวหน้าทีมตรวจได้"></textarea></label><p id="pairReasonHelp" class="pair-field-hint">หากเลือก “อื่น ๆ” ต้องอธิบายอย่างน้อย 10 ตัวอักษร · เหตุผลรวมไม่เกิน 2,000 ตัวอักษร</p><label>แนบหลักฐาน ${mode==='cross'?'(บังคับสำหรับข้ามบริษัท)':'(ถ้ามี)'}<input id="pairFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.txt"></label><p class="pair-field-hint">หลักฐานจะเก็บในคลังและผูกกับเคสต้นทาง</p><label class="pair-confirm"><input type="checkbox" id="pairChecked"><span>ตรวจบัญชี อ้างอิง วันเวลา และเหตุผลแล้ว<br><small>ยืนยันว่าเป็นรายการที่สัมพันธ์กันจริง</small></span></label></section></div>`, '<button class="ghost-button" id="pairCancel">ยกเลิก</button><button class="primary-button" id="pairSubmit">ส่งให้หัวหน้าทีมอนุมัติ</button>');
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
    const renderComparison=()=>{
      if(!selected){$('#pairCompare').textContent='';return;}
      const {bo,stm}=sides();
      const diff=Math.abs(Math.round(Number(bo.system_amount)*100)-Math.round(Number(stm.bank_amount)*100))/100;
      $('#pairCompare').innerHTML=`${sourceCard(selected,'เคสคู่ที่เลือก',sourceRaw(selected))}<div class="pair-comparison"><div><span>ยอด BO</span><strong>${money(bo.system_amount)} <small>บาท</small></strong></div><div><span>ยอด STM/PM</span><strong>${money(stm.bank_amount)} <small>บาท</small></strong></div></div><p class="pair-difference ${diff>5?'over':'within'}">ผลต่าง <b>${money(diff)} บาท</b> · ${diff>5?'เกิน 5 บาท จับคู่ไม่ได้':'อยู่ในเกณฑ์ยอด — ต้องตรวจบริบทและรออนุมัติ'}</p>`;
      if(amountDifference)$('#pairCompare .pair-card').outerHTML=sourceCard({...current,ex_type:'missing_bo'},'STM/PM ในเคสเดียวกัน',current.stm_raw);
    };
    $('#pairCandidate').onchange=()=>{selected=candidates.find(c=>c.id===$('#pairCandidate').value)||null;$('#pairChecked').checked=false;renderComparison();};
    if(amountDifference){
      const form=$('#pairCompare').closest('.manual-pair-form');
      form.querySelector('.pair-policy span').textContent='ยอดทั้งสองฝั่งอยู่ในเคสเดียวกัน ส่งแล้วรอหัวหน้าทีมอีกคนอนุมัติ ยังไม่ปิดทันที';
      form.querySelector('.pair-card').outerHTML=sourceCard({...current,ex_type:'missing_stm'},caseLabel(e)+' · BO',current.bo_raw);
      $('#pairCompany').closest('.pair-search-grid').hidden=true;
      $('#pairCompany').disabled=$('#pairDate').disabled=$('#pairSearch').disabled=true;
      $('#pairCandidate').closest('label').hidden=true;$('#pairCandidate').disabled=true;
      $('#pairSearchStatus').textContent='ใช้ BO และ STM/PM ที่มีอยู่ในเคสนี้ ไม่ต้องเลือกเคสใหม่';
      $('#pairCompare').closest('.pair-step').querySelector('h3').innerHTML='<span>2</span> ตรวจยอดทั้งสองฝั่งในเคสเดียวกัน';
      renderComparison();
    }
    $('#pairSubmit').onclick=async event=>{
      if(sent)return;
      const reasonType=$('#pairReasonType').value;
      const reasonOption=reasonOptions.find(([key])=>key===reasonType);
      const detail=$('#pairReason').value.trim();
      if(!selected||!$('#pairChecked').checked||!reasonOption)return toast('เลือกเคสคู่ เลือกเหตุผลหลัก และยืนยันการตรวจรายการ','warn');
      if(reasonType==='other'&&detail.length<10)return toast('เหตุผลอื่น ๆ ต้องอธิบายอย่างน้อย 10 ตัวอักษร','warn');
      const reason=reasonType==='other'?'อื่น ๆ: '+detail:'เหตุผล: '+reasonOption[1]+(detail?'\nรายละเอียด: '+detail:'');
      if(reason.length>2000)return toast('เหตุผลรวมรายละเอียดต้องไม่เกิน 2,000 ตัวอักษร','warn');
      const {bo,stm}=sides();
      if(Math.abs(Math.round(Number(bo.system_amount)*100)-Math.round(Number(stm.bank_amount)*100))>500)return toast('ผลต่างเกิน 5 บาท จับคู่ไม่ได้','warn');
      const file=$('#pairFile').files[0];if(mode==='cross'&&!file&&!evidenceId)return toast('ข้ามบริษัทต้องแนบหลักฐาน','warn');
      event.target.disabled=true;
      try{
        if(file&&!evidenceId)evidenceId=(await Sb.uploadCaseEvidence(e.dbId,file)).id;
        const pair=await Sb.submitManualPair({p_id:requestId,p_bo:bo.id,p_stm:stm.id,p_mode:mode,p_reason:reason,p_evidence:evidenceId});
        if(!pair?.id)throw new Error('ยังไม่พบผลยืนยันคำขอ ไม่ส่งคำขอใหม่');
        sent=true;closeModal();await refresh([bo.id,stm.id]);await openException(e.id);showCaseSubmissionReceipt('request',e.id);
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
      if(p.status==='pending'&&p.submitted_by===Sb.authUser()?.id){
        const proofFiles=(await Promise.all([...new Set([p.bo_case_id,p.stm_case_id])].map(id=>Sb.caseEvidence(id)))).flat();
        p._hasStoredEvidence=proofFiles.some(f=>f.storage_path&&Number(f.size_bytes)>0);
      }
      host.className='manual-pair-review';
      host.innerHTML=`<h3>${p.status==='pending'?'จับคู่แล้ว รอหัวหน้าทีมอนุมัติ':'ประวัติการจับคู่'}</h3><p>${h(p.bo_company)} BO ↔ ${h(p.stm_company)} STM/PM · ผลต่าง ${money(p.difference)} บาท</p><p>${h(p.reason)}</p><p>คำขอ ${h(p.id)} · ผู้ส่ง ${h(p.submitted_by)} · ${h(p.submitted_at)}</p><p>${h(p.decision_note||'')}</p><button class="ghost-button sm" id="pairOther">เปิดเคสคู่</button>${p.evidence_id?'<button class="ghost-button sm" id="pairEvidence">เปิดหลักฐานจับคู่</button>':''}${p.status==='pending'?'<label>เหตุผลอนุมัติ (ไม่บังคับ) / ส่งกลับต้องระบุเหตุผล<textarea id="pairDecision" maxlength="2000"></textarea></label><label><input type="checkbox" id="pairDecisionChecked">ตรวจทั้งสองเคสและหลักฐานแล้ว</label><button class="primary-button" id="pairApprove">อนุมัติ</button><button class="ghost-button" id="pairReject">ไม่อนุมัติ คืนทั้งสองเคส</button>':''}`;
      $('#pairOther').onclick=async()=>{try{await openEvidenceRelatedCase(p.bo_case_id===e.dbId?p.stm_case_id:p.bo_case_id);}catch(err){toast(err.message,'warn');}};
      const singleCase=p.bo_case_id===p.stm_case_id;
      if(singleCase){
        $('#pairOther').hidden=true;
        if(p.status==='pending'){
          $('#pairApprove').textContent='อนุมัติ';
          $('#pairReject').textContent='ไม่อนุมัติ คืนเคส';
          $('#pairDecisionChecked').parentElement.lastChild.textContent='ตรวจ BO และ STM/PM ในเคสนี้และหลักฐานแล้ว';
        }
      }
      $('#pairEvidence')?.addEventListener('click',async()=>{try{const files=(await Promise.all([Sb.caseEvidence(p.bo_case_id),Sb.caseEvidence(p.stm_case_id)])).flat();const file=files.find(f=>f.id===p.evidence_id);if(!file)throw new Error('หลักฐานไม่อยู่ในทะเบียน');window.open(await Sb.signedUrl(file.storage_path),'_blank','noopener');}catch(err){toast(err.message,'warn');}});
      const blocked=decisionBlockReason(p);
      if(p.status==='pending'){
        const notice=document.createElement('p');notice.className='pair-permission-notice';notice.setAttribute('role','status');
        notice.textContent=blocked||'หัวหน้าทีม: ตรวจหลักฐาน ระบุเหตุผล และติ๊กยืนยันก่อนอนุมัติ ระบบจะตรวจต้นทางและยอดไม่เกิน 5 บาทซ้ำอีกครั้ง';host.prepend(notice);
      }
      for(const [id,action] of [['pairApprove','approve'],['pairReject','reject']]){
        const button=$('#'+id);if(!button)continue;
        const actionBlocked=blocked||(action==='reject'&&p.submitted_by===Sb.authUser()?.id?'ไม่อนุมัติคำขอตัวเองไม่ได้ — ให้หัวหน้าอีกบัญชีส่งกลับ':'');
        button.disabled=!!actionBlocked;button.title=actionBlocked;
        button.onclick=async()=>{const reason=decisionBlockReason(p);if(reason)return toast(reason,'warn');const note=$('#pairDecision').value.trim();if((action==='reject'&&note.length<10)||note.length>2000||!$('#pairDecisionChecked').checked)return toast('ต้องติ๊กตรวจหลักฐาน — เหตุผลอนุมัติไม่บังคับ แต่ส่งกลับต้องระบุ 10–2,000 ตัวอักษร','warn');$('#pairApprove').disabled=$('#pairReject').disabled=true;try{await Sb.decideManualPair({p_id:p.id,p_action:action,p_note:note});}catch(err){toast('ยังยืนยันผลไม่ได้: '+err.message+' — โหลดคำขอใหม่ก่อนลองอีกครั้ง','warn');await mountReview(e,host);return;}await loadPending(true);if(await finishApprovalReview()!==false)toast(action==='approve'?(singleCase?'อนุมัติแล้ว — ปิดเคสยอดต่าง':'อนุมัติแล้ว — ปิดทั้งสองเคส'):(singleCase?'ไม่อนุมัติ คืนเคสแล้ว':'ไม่อนุมัติ คืนคู่เคสแล้ว'));};
      }
    }catch(err){host.textContent='ตรวจคำขอจับคู่ไม่ได้: '+err.message+' — ห้ามปิดผ่านปุ่มเดิม';}
  }
  async function mountQueue(host,cachedPairs=null) {
    if(!host||state.dataset!=='production'||!Sb.signedIn())return;
    host.textContent='กำลังโหลดคู่รออนุมัติทุกวันที่ตามสิทธิ์…';
    try {
      // Fetch the complete RLS-scoped request queue, independent of the 250-case page.
      const user=Sb.authUser()?.id;
      const pairs=cachedPairs||await Sb.pendingManualPairs();if(!host.isConnected||user!==Sb.authUser()?.id)return;
      Object.assign(queueState,{rows:pairs,error:'',at:Date.now(),user:Sb.authUser()?.id});if(typeof renderNav==='function')renderNav();
      if(queueFilters.user!==user)Object.assign(queueFilters,{company:'ALL',from:'',to:'',user});
      const companies=[...new Set(pairs.flatMap(p=>[p.bo_company,p.stm_company]))].sort();
      const visible=filterPairs(pairs,queueFilters);
      const caseDate=(p,side)=>h(p.snapshot?.[side]?.business_date||'ไม่ระบุวันที่เคส');
      host.innerHTML=`<div class="panel-heading"><div><h3>คำขอจับคู่รออนุมัติ <span class="badge amber">${visible.length} / ${pairs.length} คำขอ</span></h3><p class="hint">1 คู่ = 1 คำขอ · ผู้ส่งอนุมัติคำขอตัวเองไม่ได้</p></div><button class="ghost-button sm" data-pair-reload>รีเฟรชคิว</button></div>
      <div class="pair-queue-filters"><label>บริษัท<select data-pair-filter-company><option value="ALL">ทุกบริษัทตามสิทธิ์</option>${companies.map(c=>`<option value="${h(c)}" ${queueFilters.company===c?'selected':''}>${h(c)}</option>`).join('')}</select></label><label>วันที่เคสตั้งแต่<input type="date" data-pair-filter-from value="${h(queueFilters.from)}"></label><label>ถึง<input type="date" data-pair-filter-to value="${h(queueFilters.to)}"></label><button class="ghost-button sm" data-pair-filter-clear>ล้างตัวกรอง</button></div><p class="hint">กรองจากวันที่ธุรกรรมในเคส ไม่ใช่วันที่ส่งคำขอ · ข้ามบริษัท/ข้ามวันแสดงเมื่อฝั่งใดฝั่งหนึ่งตรงทั้งบริษัทและช่วงวันที่</p>
      <div class="pair-queue-list">`+visible.map(p=>`<article class="manual-pair-source pair-queue-item"><label class="pair-queue-select"><input type="checkbox" data-pair-select="${h(p.id)}" ${decisionBlockReason(p)?'disabled':''} aria-label="เลือกคำขอ ${h(p.id)}"><strong>${h(p.bo_company)} BO ↔ ${h(p.stm_company)} STM/PM</strong><span class="badge amber">รออนุมัติ</span></label><p>วันที่ BO: ${caseDate(p,'bo')} · STM/PM: ${caseDate(p,'stm')}</p><p>ผลต่าง <b>${money(p.difference)} บาท</b> · ส่งคำขอ ${h(p.submitted_at)}</p><p>${h(p.reason)}</p>${decisionBlockReason(p)?`<p class="pair-permission-notice">${h(decisionBlockReason(p))}</p>`:''}<button class="ghost-button sm" data-pair-case="${h(p.bo_case_id)}">เปิดรายละเอียดเคส</button>${p.bo_case_id!==p.stm_case_id?` <button class="ghost-button sm" data-pair-case="${h(p.stm_case_id)}">เปิดเคสฝั่ง STM/PM</button>`:''}${can('approve')?` <button class="primary-button sm" data-pair-review="${h(p.bo_case_id)}">อนุมัติ</button>`:''}</article>`).join('')+(visible.length?'':'<p>ไม่พบคำขอรออนุมัติตามตัวกรองนี้</p>')+'</div>'+ (can('approve')&&visible.length?`<section class="pair-bulk-review"><h4>อนุมัติหลายรายการ</h4><p>เลือกได้สูงสุด 50 คำขอ เฉพาะรายการที่แสดง ต้องเปิดตรวจหลักฐานของแต่ละรายการก่อน ระบบตรวจและบันทึกทีละคำขอ ไม่ปิดข้ามผลรัน</p><label>เหตุผลอนุมัติร่วม (ไม่บังคับ ไม่เกิน 2,000 ตัวอักษร)<textarea data-pair-bulk-note maxlength="2000" placeholder="ระบุผลตรวจและหลักฐานที่ใช้"></textarea></label><label><input type="checkbox" data-pair-bulk-checked>ตรวจ BO, STM/PM และหลักฐานของทุกรายการที่เลือกแล้ว</label><button class="primary-button" data-pair-bulk-approve disabled>อนุมัติรายการที่เลือก (0)</button><p role="status" data-pair-bulk-result></p></section>`:'');
      const filterChange=()=>{
        const company=host.querySelector('[data-pair-filter-company]').value,from=host.querySelector('[data-pair-filter-from]').value,to=host.querySelector('[data-pair-filter-to]').value;
        if(from&&to&&from>to)return toast('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด','warn');
        Object.assign(queueFilters,{company,from,to});mountQueue(host,pairs);
      };
      host.querySelectorAll('[data-pair-filter-company],[data-pair-filter-from],[data-pair-filter-to]').forEach(n=>n.onchange=filterChange);
      host.querySelector('[data-pair-filter-clear]').onclick=()=>{Object.assign(queueFilters,{company:'ALL',from:'',to:''});mountQueue(host,pairs);};
      host.querySelectorAll('[data-pair-case]').forEach(b=>b.onclick=()=>openEvidenceRelatedCase(b.dataset.pairCase).catch(err=>toast(err.message,'warn')));
      host.querySelectorAll('[data-pair-review]').forEach(b=>b.onclick=()=>openApprovalReview(b.dataset.pairReview,'pair').catch(err=>toast(err.message,'warn')));
      host.querySelector('[data-pair-reload]').onclick=()=>mountQueue(host);
      const selected=()=>visible.filter(p=>host.querySelector(`[data-pair-select="${p.id}"]`)?.checked);
      const bulk=host.querySelector('[data-pair-bulk-approve]');
      if(bulk){
        const note=host.querySelector('[data-pair-bulk-note]'),checked=host.querySelector('[data-pair-bulk-checked]'),result=host.querySelector('[data-pair-bulk-result]');let busy=false;
        const sync=()=>{const n=selected().length;bulk.textContent=`อนุมัติรายการที่เลือก (${n})`;bulk.disabled=busy||!n||n>50||!checked.checked||note.value.trim().length>2000;};
        host.querySelectorAll('[data-pair-select]').forEach(c=>c.onchange=()=>{checked.checked=false;sync();});note.oninput=()=>{checked.checked=false;sync();};checked.onchange=sync;
        bulk.onclick=async()=>{
          const chosen=selected(),text=note.value.trim();
          if(busy||!chosen.length||chosen.length>50||!checked.checked||text.length>2000)return;
          const denied=chosen.map(decisionBlockReason).find(Boolean);if(denied)return toast(denied,'warn');
          busy=true;sync();host.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=true);
          let done=0,error='';
          for(const p of chosen){try{await Sb.decideManualPair({p_id:p.id,p_action:'approve',p_note:text});done++;result.textContent=`บันทึกแล้ว ${done}/${chosen.length} คำขอ`;}catch(err){error=err.message;break;}}
          await loadPending(true);
          // Stop on the first failure; never retry a possibly committed decision automatically.
          await mountQueue(host);
          const report=document.createElement('p');report.className='pair-permission-notice';report.setAttribute('role','status');report.textContent=`ยืนยันบันทึกสำเร็จ ${done}/${chosen.length} คำขอ`+(error?` · หยุดตรวจต่อ: ${error} — ตรวจสถานะล่าสุดก่อนลองใหม่`: ' · คิวอัปเดตแล้ว');host.prepend(report);
          loadLiveOverview(true);
        };
      }
    } catch(err){if(host.isConnected)host.textContent='โหลดคู่รออนุมัติไม่สำเร็จ: '+err.message;}
  }
  return {open,mountReview,mountQueue,queueState,loadPending,decisionBlockReason,filterPairs,eligible,selfApprovalCandidate};
})();
