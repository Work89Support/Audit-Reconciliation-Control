/* Explicit Audit return path. Opening/cancelling this modal never writes. */
const ClarificationReturn = (() => {
 const drafts=new Map(),flights=new Set();
 const roles=['monitor','audit_assistant','lead','admin'];
 function eligible(e){return state.dataset==='production'&&roles.includes(state.role)&&can('request_clarify')&&canAccessCompany(e.company)&&e.status==='answered'&&!e.closureRequestId&&!e.manualPairId&&!e.reviewHold;}
 async function open(e){
  if(!eligible(e)||!e.dbId||!Sb.signedIn())return toast('เฉพาะ Audit ของบริษัทนี้ตีกลับเคสที่ตอบแล้วและไม่มีคำขออนุมัติค้างได้','warn');
  const actor=Sb.authUser()?.id,role=state.role,route=state.route;
  const key=[actor,role,e.company,e.dbId].join('|');
  const fresh=await Sb.exceptionDetail(e.dbId);
  if(actor!==Sb.authUser()?.id||role!==state.role||route!==state.route||!canAccessCompany(e.company))return;
  if(!fresh||fresh.status!=='answered'||fresh.manual_pair_id||fresh.case_closure_request_id||fresh.cross_day_request_id||fresh.cross_day_image_request_id)
   return toast('สถานะหรือคำขอเปลี่ยน กรุณาเปิดเคสล่าสุดก่อนตีกลับ','warn');
  const requestId=crypto.randomUUID();
  openModal('ตีกลับให้ชี้แจงเพิ่มเติม',
   '<p>'+h(caseLabel(e))+'</p><p>ส่งกลับเคสเดิมให้ผู้ชี้แจงของบริษัท '+h(e.company)+' ระบุสิ่งที่ยังขาดให้ชัดเจน · เก็บคำตอบและไฟล์เดิมทั้งหมด ไม่เปลี่ยนยอด ไม่จับคู่ ไม่ปิดเคส และไม่เริ่ม SLA ใหม่</p>'+
   '<label>สิ่งที่ต้องชี้แจงหรือแนบเพิ่มเติม (10–2,000 ตัวอักษร)<textarea id="clarificationReturnReason" maxlength="2000">'+h(drafts.get(key)||'')+'</textarea></label>'+
   '<label><input type="checkbox" id="clarificationReturnChecked">ตรวจคำตอบเดิมแล้ว และต้องการส่งกลับให้บริษัทชี้แจงเพิ่มเติม</label><p role="status" id="clarificationReturnState">ยังไม่ได้ตีกลับ · กดยกเลิกได้โดยไม่เปลี่ยนเคส</p>',
   '<button class="ghost-button" id="clarificationReturnCancel">ยกเลิก</button><button class="primary-button" id="clarificationReturnSend">ยืนยันตีกลับให้ชี้แจงเพิ่มเติม</button>');
  const reason=$('#clarificationReturnReason'),checked=$('#clarificationReturnChecked'),send=$('#clarificationReturnSend'),status=$('#clarificationReturnState');
  reason.oninput=()=>{drafts.set(key,reason.value);checked.checked=false;};
  $('#clarificationReturnCancel').onclick=()=>{drafts.set(key,reason.value);closeModal();};
  send.onclick=async()=>{
   const text=reason.value.trim();drafts.set(key,reason.value);
   if(actor!==Sb.authUser()?.id||role!==state.role||route!==state.route||!eligible(e))return toast('สิทธิ์หรือหน้าทำงานเปลี่ยน กรุณาเปิดเคสล่าสุด','warn');
   if(text.length<10||text.length>2000||!checked.checked)return toast('ระบุสิ่งที่ขาดอย่างน้อย 10 ตัวอักษร และติ๊กยืนยันก่อนตีกลับ','warn');
   if(flights.has(key))return;flights.add(key);send.disabled=true;
   let committed=false;
   try{
    const result=await Sb.returnClarification({p_id:requestId,p_case:e.dbId,p_reason:text,p_expected_updated_at:fresh.updated_at,p_expected_responded_at:fresh.responded_at});
    if(result?.id!==e.dbId||result.request_id!==requestId||result.status!=='clarifying')throw Error('ยังยืนยันสถานะรอชี้แจงไม่ได้ ต้องโหลดสถานะล่าสุดก่อนส่งซ้ำ');
    committed=true;drafts.delete(key);
    if(actor!==Sb.authUser()?.id||role!==state.role||route!==state.route)return;
    if(typeof clarificationReturnCommitted==='function')clarificationReturnCommitted(e.dbId);
    captureCaseOpenDraft();
    await openEvidenceRelatedCase(e.dbId);
    toast('ตีกลับให้ชี้แจงเพิ่มเติมแล้ว · ใช้เคสเดิม เก็บคำตอบและหลักฐานเดิมครบ');
   }catch(err){const message=(committed?'บันทึกตีกลับแล้ว แต่โหลดเคสใหม่ไม่สำเร็จ: ':'ยังยืนยันผลไม่ได้: ')+err.message+' · ตรวจสถานะล่าสุดก่อนลองใหม่';status.textContent=message;toast(message,'warn');}
   finally{flights.delete(key);send.disabled=false;}
  };
 }
 return {eligible,open};
})();

