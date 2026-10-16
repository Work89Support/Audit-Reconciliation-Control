/* Document review is not a company clarification request or an automatic loss. */
const CaseClosure=(()=>{
  const queueState={rows:null,loading:false,error:'',at:0,user:null};
  const queueFilters={status:'pending',company:'ALL',from:'',to:''};
  let pendingLoad=null;
  let historyCache=null;
  let historyLoad=null;
  async function readQueueHistory(force=false){
    const key=JSON.stringify([Sb.authUser()?.id,state.role,state.access?.companies]);
    if(!force&&historyCache?.key===key&&Date.now()-historyCache.at<30000)return historyCache.rows;
    if(historyLoad?.key===key)return historyLoad.promise;
    const promise=Sb.caseClosureHistory().then(rows=>{if(JSON.stringify([Sb.authUser()?.id,state.role,state.access?.companies])===key)historyCache={key,at:Date.now(),rows};return rows;});
    historyLoad={key,promise};try{return await promise;}finally{if(historyLoad?.promise===promise)historyLoad=null;}
  }
  const auditable=()=>Sb.signedIn()&&['monitor','audit_assistant','lead','admin'].includes(state.role);
  const directCloser=()=>can('approve')&&['lead','admin','audit_assistant'].includes(state.role);
  function assistantCloseBlock(e){
    if(state.role!=='audit_assistant')return '';
    const a=e.system_amount,b=e.bank_amount;
    if((a==null&&b==null)||(a!=null&&!Number.isFinite(Number(a)))||(b!=null&&!Number.isFinite(Number(b))))return 'ยังไม่มียอด BO หรือ STM/PM ที่ยืนยันได้';
    if(e.currency!=='THB'||(a!=null&&Number(a)<=0)||(b!=null&&Number(b)<=0))return 'ยอดต้นทางหรือสกุลเงินไม่ผ่านเงื่อนไขปิดเอง';
    if(Number(a)>30000||Number(b)>30000)return 'ยอดฝั่งใดฝั่งหนึ่งเกิน 30,000 บาท';
    if(a!=null&&b!=null&&Math.abs(Number(a)-Number(b))>5)return 'ผลต่างเกิน 5 บาท';
    if(['repeat','manual','uncertain'].some(k=>e.review_flags?.[k]))return 'พบรายการซ้ำ การแก้ไขมือ หรือข้อมูลที่ยังไม่ยืนยัน';
    return '';
  }
  const outcomeLabel=q=>q.outcome==='no_loss'?'ไม่มีความเสียหาย (0 บาท)':`เสียหายจริง ${money(q.loss_amount)} บาท`;
  function approvalNote(action,value){
    const note=String(value||'').trim();
    if(note.length>2000||(action==='reject'&&note.length<10))throw Error('ส่งกลับต้องระบุเหตุผล 10–2,000 ตัวอักษร ส่วนอนุมัติไม่บังคับ');
    return note;
  }
  function selfEligible(q){
    const a=q.snapshot?.system_amount,b=q.snapshot?.bank_amount;
    if(state.role==='audit_assistant')return q.outcome==='no_loss'&&Number(q.loss_amount)===0&&q.snapshot?.stored_document_at_submit===true&&!assistantCloseBlock(q.snapshot||{});
    return q.outcome==='no_loss'&&a!=null&&b!=null&&Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=5;
  }
  function bulkEligible(q){
    if(!can('approve')||!canAccessCompany(q.company)||q.status!=='pending'||q.outcome!=='no_loss'||Number(q.loss_amount)!==0||q.snapshot?.stored_document_at_submit!==true)return false;
    const own=q.requested_by===Sb.authUser()?.id;
    const legacyHead=own&&['lead','admin'].includes(state.role)&&q.review_origin==='audit_submission';
    const directHead=q.review_origin==='head_direct'&&['lead','admin'].includes(state.role);
    return !((own&&!legacyHead&&!directHead)||state.role==='audit_assistant')||selfEligible(q);
  }
  function reviewFingerprint(q){
    const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
    return JSON.stringify(stable({id:q.id,exception_id:q.exception_id,company:q.company,business_date:q.business_date,outcome:q.outcome,loss_amount:q.loss_amount,audit_reason:q.audit_reason,requested_by:q.requested_by,review_origin:q.review_origin,snapshot:q.snapshot}));
  }
  const reviewStorageKey='audit.bulk-document-review.v1';
  const reviewedSelectionState={scope:null,reviewed:new Map(),selected:new Set()};
  function reviewScope(){return JSON.stringify([Sb.authUser()?.id||'',state.role,can('approve'),companyMaster().map(c=>typeof c==='string'?c:c.code).filter(canAccessCompany).sort()]);}
  function persistBulkSelection(){
    try{sessionStorage.setItem(reviewStorageKey,JSON.stringify({scope:reviewedSelectionState.scope,reviewed:[...reviewedSelectionState.reviewed].slice(-100),selected:[...reviewedSelectionState.selected].slice(0,100)}));}catch{/* Memory-only fallback when browser session storage is unavailable. */}
  }
  function loadBulkSelection(){
    const scope=reviewScope();
    if(reviewedSelectionState.scope===scope)return;
    reviewedSelectionState.scope=scope;reviewedSelectionState.reviewed.clear();reviewedSelectionState.selected.clear();
    try{const saved=JSON.parse(sessionStorage.getItem(reviewStorageKey)||'null');if(saved?.scope===scope){
      for(const pair of (Array.isArray(saved.reviewed)?saved.reviewed:[]).slice(-100))if(Array.isArray(pair)&&typeof pair[0]==='string'&&/^[a-f0-9]{64}$/.test(pair[1]))reviewedSelectionState.reviewed.set(pair[0],pair[1]);
      for(const id of (Array.isArray(saved.selected)?saved.selected:[]).slice(0,100))if(reviewedSelectionState.reviewed.has(id))reviewedSelectionState.selected.add(id);
    }}catch{/* Invalid persisted state never unlocks a case. */}
    persistBulkSelection();
  }
  async function reviewReceipt(q,caseRow){
    if(!bulkEligible(q))throw Error('สิทธิ์หรือคำขอเปลี่ยน ต้องเปิดตรวจใหม่');
    const e=caseRow||await Sb.exceptionDetail(q.exception_id);
    const keys=['run_id','company','business_date','direction','account','currency','system_amount','bank_amount','bo_raw','stm_raw','clarification_file_id','document_due_at'];
    if(!e||e.status!=='answered'||e.case_closure_request_id!==q.id||e.manual_pair_id||e.superseded_by_exception_id||!canAccessCompany(e.company)||keys.some(k=>JSON.stringify(e[k]??null)!==JSON.stringify(q.snapshot?.[k]??null)))throw Error('สถานะหรือต้นทางเปลี่ยน ต้องเปิดตรวจใหม่');
    const [evidence,source]=await Promise.all([Sb.caseEvidence(q.exception_id),e.clarification_file_id?Sb.exceptionFiles(null,e.clarification_file_id):Promise.resolve([])]);
    if(!evidence.some(f=>f.storage_path&&Number(f.size_bytes)>0)&&!source.some(f=>f.id===e.clarification_file_id&&f.storage_path))throw Error('ไม่พบหลักฐานที่ผูกไว้ล่าสุด ต้องเปิดตรวจใหม่');
    // Persist only a digest, not financial fields, filenames, or document contents.
    const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
    const payload=JSON.stringify(stable({request:reviewFingerprint(q),case:Object.fromEntries([...keys,'status','updated_at'].map(k=>[k,e[k]??null])),evidence:[...evidence].sort((a,b)=>String(a.id).localeCompare(String(b.id))),source:[...source].sort((a,b)=>String(a.id).localeCompare(String(b.id)))}));
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  async function rememberBulkReview(q){
    loadBulkSelection();const scope=reviewedSelectionState.scope;
    const fresh=await Sb.caseClosureRequest(q.id),receipt=await reviewReceipt(fresh);
    if(scope!==reviewScope()||reviewFingerprint(fresh)!==reviewFingerprint(q))throw Error('บัญชีหรือคำขอเปลี่ยน ต้องเปิดตรวจใหม่');
    reviewedSelectionState.reviewed.set(q.id,receipt);persistBulkSelection();
  }
  async function restoreBulkSelection(rows){
    loadBulkSelection();const scope=reviewedSelectionState.scope,opened=new Set();
    for(const [id,receipt] of [...reviewedSelectionState.reviewed]){
      const q=rows.find(row=>row.id===id);let valid=false;
      try{valid=!!q&&await reviewReceipt(q)===receipt;}catch{/* Fail closed on denied, incomplete, or changed proof. */}
      if(scope!==reviewScope())return {opened:new Set(),selected:new Set()};
      if(valid)opened.add(q.exception_id);else{reviewedSelectionState.reviewed.delete(id);reviewedSelectionState.selected.delete(id);}
    }
    persistBulkSelection();return {opened,selected:reviewedSelectionState.selected};
  }
  async function approveBulkReviewed(items){
    if(!items.length||items.length>100||items.some(item=>item.read!==true)||new Set(items.map(item=>item.q.id)).size!==items.length)throw Error('ต้องยืนยันอ่านหลักฐานทุกเคส เลือกไม่ซ้ำ และไม่เกิน 100 เคส');
    const user=Sb.authUser()?.id,results=[];
    for(const item of items){
      try{
        if(!user||Sb.authUser()?.id!==user||!can('approve'))throw Error('บัญชีหรือสิทธิ์เปลี่ยน ต้องตรวจใหม่');
        const q=await Sb.caseClosureRequest(item.q.id);
        if(!q||!bulkEligible(q)||reviewFingerprint(q)!==reviewFingerprint(item.q))throw Error('คำขอหรือสิทธิ์เปลี่ยน ไม่ผ่านเงื่อนไขไม่มีความเสียหาย ต้องเปิดตรวจใหม่');
        const e=await Sb.exceptionDetail(q.exception_id);
        const keys=['run_id','company','business_date','direction','account','currency','system_amount','bank_amount','bo_raw','stm_raw','clarification_file_id','document_due_at'];
        if(!e||e.status!=='answered'||e.case_closure_request_id!==q.id||e.manual_pair_id||e.superseded_by_exception_id||!canAccessCompany(e.company)||keys.some(k=>JSON.stringify(e[k]??null)!==JSON.stringify(q.snapshot?.[k]??null)))throw Error('สถานะหรือต้นทางเคสเปลี่ยน ต้องเปิดตรวจใหม่');
        if(item.receipt&&await reviewReceipt(q,e)!==item.receipt)throw Error('หลักฐานหรือข้อมูลเปลี่ยนหลังอ่าน ต้องเปิดตรวจใหม่');
        const note='อ่านหลักฐานของเคสนี้ครบแล้ว ยืนยันไม่มีความเสียหาย 0 บาท — อนุมัติจากรายการที่เลือก';
        const legacy=q.requested_by===user&&['lead','admin'].includes(state.role)&&q.review_origin==='audit_submission';
        const saved=legacy?await Sb.approveOwnDocumentClosure({p_id:q.id,p_note:note}):await Sb.decideCaseClosure({p_id:q.id,p_action:'approve',p_note:note});
        if(saved?.id!==q.id||saved.status!=='approved')throw Error('ยังยืนยันผลคำขอไม่ได้ ตรวจสถานะก่อนลองซ้ำ');
        const closed=await Sb.exceptionDetail(q.exception_id);
        if(closed?.status!=='closed'||closed.case_closure_request_id!==q.id||closed.approved_by!==user)throw Error('ยังยืนยันสถานะปิดไม่ได้ ตรวจประวัติก่อนลองซ้ำ');
        results.push({q,ok:true});
      }catch(err){results.push({q:item.q,ok:false,error:err.message});}
    }
    return results;
  }
  function openBulkReview(chosen,opened,refresh){
    if(!chosen.length||chosen.length>100)return toast('เลือก 1–100 เคสที่เปิดหลักฐานแล้ว','warn');
    const scope=reviewScope(),reviewed=chosen.map(q=>({q,read:true,receipt:reviewedSelectionState.reviewed.get(q.id)}));
    if(reviewed.some(item=>!item.receipt))return toast('รายการที่อ่านไว้เปลี่ยนแล้ว กรุณาเปิดตรวจใหม่','warn');
    openModal('ทบทวนก่อนปิดเคสที่เลือก',`<p>ปิดเฉพาะเคสไม่มีความเสียหาย 0 บาท ไม่รวมยอดหรือยุบรายการ ต้องทบทวนหลักฐานครบทุกเคสก่อนยืนยัน การเลือกทั้งหมดไม่ใช่การปิดเคส</p><div class="inline-actions"><button type="button" class="ghost-button" id="closureBulkReadAll">เลือกทั้งหมด · ฉันอ่านหลักฐานครบแล้ว</button><button type="button" class="ghost-button" id="closureBulkReadNone">ยกเลิกการเลือกทั้งหมด</button><span id="closureBulkReadCount" role="status"></span></div><div class="closure-bulk-review">${chosen.map((q,i)=>`<section><b>${h(q.company)} · ${h(q.snapshot?.code||q.exception_id)}</b><p>วันที่ ${h(q.business_date)} · BO ${h(money(q.snapshot?.system_amount))} บาท · ไม่มีความเสียหาย 0 บาท</p><p>${h(q.audit_reason)}</p><label><input type="checkbox" data-bulk-read="${i}" ${opened.has(q.exception_id)?'':'disabled'}> ฉันอ่านหลักฐานของเคสนี้ครบแล้ว และยืนยันว่าไม่มีความเสียหาย</label></section>`).join('')}</div><label><input type="checkbox" id="closureBulkConfirm">ยืนยันปิดเฉพาะรายการที่เลือก ระบบจะตรวจสิทธิ์ หลักฐาน และสถานะล่าสุดรายเคสอีกครั้ง</label><p id="closureBulkResult" role="status"></p>`,`<button class="ghost-button" id="closureBulkCancel">ยกเลิก</button><button class="primary-button" id="closureBulkApprove" disabled>ยืนยันปิด ${chosen.length} เคส</button>`);
    const readInputs=()=>[...$('#modal').querySelectorAll('[data-bulk-read]')];
    const ready=()=>$('#closureBulkConfirm').checked&&readInputs().every(el=>el.checked&&!el.disabled);
    const sync=()=>{
      const inputs=readInputs(),checked=inputs.filter(el=>el.checked).length;
      $('#closureBulkApprove').disabled=!ready();
      $('#closureBulkReadCount').textContent=`ยืนยันอ่านแล้ว ${checked} / ${inputs.length} เคส`;
      $('#closureBulkReadAll').disabled=inputs.every(el=>el.checked||el.disabled);
      $('#closureBulkReadNone').disabled=!inputs.some(el=>el.checked&&!el.disabled);
    };
    const setRead=checked=>{
      if(scope!==reviewScope())return toast('บัญชีหรือสิทธิ์เปลี่ยน ต้องเปิดตรวจใหม่','warn');
      setBulkReadConfirmation(readInputs(),checked);sync();
    };
    $('#closureBulkReadAll').onclick=()=>setRead(true);
    $('#closureBulkReadNone').onclick=()=>setRead(false);
    $('#closureBulkConfirm').onchange=sync;document.querySelectorAll('[data-bulk-read]').forEach(el=>el.onchange=sync);
    $('#closureBulkCancel').onclick=closeModal;
    sync();
    $('#closureBulkApprove').onclick=async()=>{
      if(!ready())return;
      if(scope!==reviewScope())return toast('บัญชีหรือสิทธิ์เปลี่ยน ต้องเปิดตรวจใหม่','warn');
      $('#closureBulkApprove').disabled=true;$('#closureBulkCancel').disabled=true;
      $('#closureBulkReadAll').disabled=true;$('#closureBulkReadNone').disabled=true;
      document.querySelectorAll('[data-bulk-read],#closureBulkConfirm').forEach(el=>el.disabled=true);
      $('#closureBulkResult').textContent='กำลังตรวจและดำเนินการทีละเคส กรุณารอ ไม่กดส่งซ้ำ';
      try{
        const results=await approveBulkReviewed(reviewed);
        $('#closureBulkResult').textContent=results.map(r=>`${r.q.company} ${r.q.snapshot?.code||r.q.exception_id}: ${r.ok?'ปิดสำเร็จ':r.error}`).join('\n');
        $('#closureBulkCancel').disabled=false;$('#closureBulkCancel').textContent='กลับไปตรวจคิวล่าสุด';
        $('#closureBulkCancel').onclick=async()=>{closeModal();await refresh();};
      }catch(err){$('#closureBulkResult').textContent=err.message+' — ตรวจสถานะก่อนลองซ้ำ';$('#closureBulkCancel').disabled=false;}
    };
  }
  function setBulkReadConfirmation(inputs,checked){
    for(const input of inputs)if(!input.disabled)input.checked=checked===true;
  }
  async function loadPending(force=false){
    if(state.dataset!=='production'||!auditable())return;
    const user=Sb.authUser()?.id;
    const key=JSON.stringify([user,state.role,state.access?.companies]);
    if(queueState.scopeKey!==key){Object.assign(queueState,{rows:null,error:'',at:0,user,scopeKey:key});Object.assign(queueFilters,{status:'pending',company:'ALL',from:'',to:'',globalKey:''});}
    if(pendingLoad?.key===key)return pendingLoad.promise;
    if(!force&&queueState.rows!==null&&Date.now()-queueState.at<30000)return;
    queueState.loading=true;
    const promise=(async()=>{
      try{const rows=await Sb.pendingCaseClosures();if(JSON.stringify([Sb.authUser()?.id,state.role,state.access?.companies])===key){queueState.rows=rows;queueState.error='';queueState.at=Date.now();}}
      catch(err){if(queueState.scopeKey===key){queueState.rows=null;queueState.error=err.message;queueState.at=0;}}
      finally{if(queueState.scopeKey===key){queueState.loading=false;if(typeof renderNav==='function')renderNav();}}
    })();pendingLoad={key,promise};
    try{await promise;}finally{if(pendingLoad?.promise===promise)pendingLoad=null;}
  }
  async function openSubmit(e,initialOutcome='no_loss'){
    if(state.dataset!=='production'||!auditable())return toast('เฉพาะ Audit ในระบบจริงส่งผลตรวจให้หัวหน้าได้','warn');
    const fresh=await Sb.exceptionDetail(e.dbId);
    if(!fresh||!['open','clarifying','answered'].includes(fresh.status)||fresh.manual_pair_id||fresh.case_closure_request_id)return toast('มีคำขออยู่แล้วหรือสถานะเปลี่ยน กรุณาโหลดเคสใหม่','warn');
    const blockedReason=assistantCloseBlock(fresh),direct=directCloser()&&!blockedReason;
    const id=crypto.randomUUID();let sent=false;
    openModal(direct?'ปิดเคส':'Audit ตรวจผลและส่งหัวหน้ารอปิดเคส',`<p>${h(caseLabel(e))}</p><p>${direct?'ตรวจหลักฐานและยืนยันผลเพื่อปิดเคสทันที ไม่ส่งเข้าคิวต่อ':'มีเอกสารแล้ว: ตรวจและส่งหัวหน้า ไม่ส่งงานให้ผู้ชี้แจงบริษัทซ้ำ'}</p><label>ผลตรวจ<select id="closureOutcome"><option value="no_loss">ไม่มีความเสียหาย — ปิด 0 บาท</option><option value="damage">ยืนยันความเสียหายจริง</option></select></label><div id="closureLossFields" hidden><label>ยอดเสียหายจริง (บาท)<input type="number" step="0.01" min="0.01" id="closureLossAmount"></label><label>ประเภทความเสียหาย<select id="closureLossCategory"><option value="">เลือกประเภท</option>${Object.entries(DamageSummary.categories).filter(([k])=>!['unclassified','system'].includes(k)).map(([k,v])=>`<option value="${h(k)}">${h(v)}</option>`).join('')}</select></label><p>ไม่มีเอกสาร: ต้องส่งขอชี้แจงและครบ SLA ตามบริษัทก่อนเสนอ แต่หมด SLA อย่างเดียวไม่ได้แปลว่าพิสูจน์ความเสียหายแล้ว</p></div><label>${direct?'เหตุผลปิดเคส / หลักฐานอ้างอิง (ไม่บังคับ ไม่เกิน 2,000 ตัวอักษร)':'ผลตรวจ Audit / หลักฐานอ้างอิง (10–2,000 ตัวอักษร)'}<textarea id="closureAuditReason" maxlength="2000">${h((e.notes||[]).map(n=>n.text).filter(Boolean).join('\n')||e.resolutionNote||'')}</textarea></label><label><input type="checkbox" id="closureAuditChecked">ตรวจเอกสารที่เกี่ยวกับเคสนี้ และยืนยันผลยอดจริงแล้ว ไม่ได้สรุปจากยอดต่างหรือหมด SLA อย่างเดียว</label>`, `<button class="ghost-button" id="closureCancel">ยกเลิก</button><button class="primary-button" id="closureSend">${direct?'ปิดเคส':'ส่งหัวหน้ารอปิดเคส'}</button>`);
    $('#closureCancel').onclick=closeModal;
    if(blockedReason){
      const hint=document.createElement('p');hint.setAttribute('role','status');
      hint.textContent='ผู้ช่วย Audit ปิดเคสนี้เองไม่ได้: '+blockedReason+' — ตรวจเอกสารแล้วส่งหัวหน้าอนุมัติ หากยังไม่มีเอกสารให้ส่งผู้ชี้แจงก่อน';
      $('#closureAuditReason').parentElement.before(hint);
    }
    if(state.role==='audit_assistant')$('#closureOutcome').querySelector('option[value="damage"]').disabled=true;
    if(state.role==='audit_assistant'&&direct){
      const hint=document.createElement('p');hint.setAttribute('role','status');
      hint.textContent='ผู้ช่วยปิดได้เมื่อยอดต้นทาง BO หรือ STM/PM ไม่เกิน 30,000 บาท มีหลักฐานในคลัง และไม่มีความเสียหาย แม้ขาดอีกฝั่ง — หากมียอดทั้งสองฝั่ง แต่ละฝั่งต้องไม่เกิน 30,000 บาทและต่างไม่เกิน 5 บาท';
      $('#closureAuditReason').parentElement.before(hint);
    }
    $('#closureOutcome').onchange=()=>{$('#closureLossFields').hidden=$('#closureOutcome').value!=='damage';$('#closureAuditChecked').checked=false;};
    if(initialOutcome==='damage'){$('#closureOutcome').value='damage';$('#closureOutcome').onchange();}
    $('#closureSend').onclick=async event=>{
      const outcome=$('#closureOutcome').value,raw=$('#closureLossAmount').value,enteredReason=$('#closureAuditReason').value.trim();
      const reason=direct&&enteredReason.length<10?'ผู้มีสิทธิ์ตรวจหลักฐานและยืนยันผลปิดเคส'+(enteredReason?' — '+enteredReason:''):enteredReason;
      const amount=outcome==='no_loss'?0:Number(raw),category=outcome==='no_loss'?null:$('#closureLossCategory').value;
      if(!$('#closureAuditChecked').checked||reason.length<10||reason.length>2000||!Number.isFinite(amount)||(outcome==='damage'&&(!/^\d+(\.\d{1,2})?$/.test(raw)||amount<=0||!category)))return toast('ตรวจและกรอกผลยอด/เหตุผลให้ครบก่อนส่ง','warn');
      event.target.disabled=true;
      try{
        const saved=await (direct?Sb.closeDocumentCase:Sb.submitCaseClosure)({p_id:id,p_case:e.dbId,p_outcome:outcome,p_amount:amount,p_reason:reason,p_category:category});
        if(saved?.id!==id||saved.status!==(direct?'approved':'pending'))throw Error('ยังยืนยันคำขอในฐานข้อมูลไม่ได้');
        if(direct){sent=true;await loadPending(true);if(await finishApprovalReview()!==false)toast(`ปิดเคสแล้ว — ${outcomeLabel(saved)}`);return;}
        sent=true;closeModal();await loadPending(true);await openEvidenceRelatedCase(e.dbId);showCaseSubmissionReceipt('request',caseLabel(e));
      }catch(err){toast((sent?'ส่งแล้วแต่โหลดหน้าจอไม่ได้: ':'ยังยืนยันคำขอไม่ได้: ')+err.message+' — ตรวจสถานะก่อนส่งซ้ำ','warn');}
      finally{event.target.disabled=false;}
    };
  }
  async function mountReview(e,host){
    if(!host)return;
    if(!e.closureRequestId){host.textContent='เคสนี้ไม่มีคำขอรออนุมัติที่เชื่อมอยู่ กรุณารีเฟรชคิวหรือดูประวัติคำขอ ไม่ใช่ผลอนุมัติล้มเหลว';return;}
    host.textContent='กำลังโหลดผลตรวจรอหัวหน้า…';
    try{
      const q=await Sb.caseClosureRequest(e.closureRequestId);if(!q)throw Error('ไม่พบคำขอหรือไม่มีสิทธิ์');if(!host.isConnected)return;
      const own=q.requested_by===Sb.authUser()?.id;
      const legacyHead=own&&['lead','admin'].includes(state.role)&&q.review_origin==='audit_submission'&&q.outcome==='no_loss'&&Number(q.loss_amount)===0&&q.snapshot?.stored_document_at_submit===true;
      const directHead=(q.review_origin==='head_direct'||legacyHead)&&['lead','admin'].includes(state.role),blocked=!can('approve')||(((own&&!directHead)||state.role==='audit_assistant')&&!selfEligible(q));
      host.innerHTML=`<h3>${q.status==='pending'?'Audit ตรวจแล้ว — รอหัวหน้าปิดเคส':'ผลปิดเคส'}</h3><p><b>${h(outcomeLabel(q))}</b></p><p>${h(q.audit_reason)}</p><p>${h(q.decision_note||'')}</p><p>คำขอ ${h(q.id)} · ผู้ส่ง ${h(q.requested_by)}</p>${q.status==='pending'?`<p>${blocked?'บัญชีนี้อนุมัติไม่ได้ หรือคำขอตัวเองไม่ผ่านเงื่อนไข ต้องให้หัวหน้าอีกบัญชีตรวจ':'หัวหน้าตรวจเอกสารและผลยอดก่อนอนุมัติ — เหตุผลอนุมัติไม่บังคับ'}</p><label>เหตุผลอนุมัติ (ไม่บังคับ) / ส่งกลับต้องระบุเหตุผล<textarea id="closureHeadNote" maxlength="2000"></textarea></label><label><input type="checkbox" id="closureHeadChecked">ตรวจเอกสารและผล Audit แล้ว ยืนยัน ${h(outcomeLabel(q))}</label><button class="primary-button" id="closureApprove" ${blocked?'disabled':''}>อนุมัติ</button><button class="ghost-button" id="closureReject" ${blocked||own?'disabled':''}>ส่งกลับ Audit</button>`:''}`;
      if(q.status!=='pending'){
        const info=document.createElement('p');info.setAttribute('role','status');
        info.textContent=q.status==='approved'?'คำขอนี้อนุมัติแล้ว จึงออกจากคิวรอ ไม่ต้องกดอนุมัติซ้ำ':'คำขอนี้ส่งกลับ Audit แล้ว จึงไม่อยู่ในคิวรออนุมัติ';
        host.append(info);return;
      }
      for(const [buttonId,action] of [['closureApprove','approve'],['closureReject','reject']])$('#'+buttonId).onclick=async event=>{
        if(blocked||!$('#closureHeadChecked').checked)return toast('ต้องตรวจหลักฐานและติ๊กยืนยันผลก่อน','warn');
        let note;try{note=approvalNote(action,$('#closureHeadNote').value);}catch(err){return toast(err.message,'warn');}
        event.target.disabled=true;
        let saved;
        try{saved=legacyHead&&action==='approve'?await Sb.approveOwnDocumentClosure({p_id:q.id,p_note:note}):await Sb.decideCaseClosure({p_id:q.id,p_action:action,p_note:note});if(saved?.status!==(action==='approve'?'approved':'rejected'))throw Error('ยังยืนยันผลไม่ได้');}
        catch(err){toast('ยังยืนยันผลไม่ได้: '+err.message+' — โหลดคำขอใหม่ก่อนลองซ้ำ','warn');await mountReview(e,host);return;}
        await loadPending(true);if(await finishApprovalReview()!==false)toast(action==='approve'?`อนุมัติแล้ว — ${outcomeLabel(saved)}`:'ส่งกลับ Audit แล้ว');
      };
    }catch(err){host.textContent='โหลดผลตรวจรอปิดไม่ได้: '+err.message;}
  }
  async function mountQueue(host,options={}){
    if(host&&!auditable()){host.textContent='คิวนี้สำหรับ Audit และหัวหน้าเท่านั้น ผู้ชี้แจงติดตามคำตอบของตนในเมนูติดตามและอนุมัติ';return;}
    if(!host)return;await loadPending(options.force===true);if(!host.isConnected)return;
    if(queueState.rows===null){host.textContent='ยังโหลดยอดรอหัวหน้าไม่ครบ: '+queueState.error;return;}
    let rows=queueState.rows;
    const {selected,opened}=await restoreBulkSelection(rows);if(!host.isConnected)return;
    let recentHistory=[];
    if(!rows.length){
      try{recentHistory=(await readQueueHistory(options.force)).filter(q=>q.status!=='pending').slice(0,6);}
      catch(err){queueState.error='อ่านประวัติไม่สำเร็จ: '+err.message;}
      if(!host.isConnected)return;
    }
    const companies=companyMaster().map(c=>typeof c==='string'?c:c.code).filter(c=>canAccessCompany(c));
    if(options.scope&&queueFilters.globalKey!==JSON.stringify(options.scope))Object.assign(queueFilters,options.scope,{globalKey:JSON.stringify(options.scope)});
    host.classList.add('closure-hub');
    host.innerHTML=`<header class="closure-hub-heading"><div><p class="closure-eyebrow">ตรวจเอกสาร · อนุมัติ · ย้อนดูประวัติ</p><h3>ศูนย์รอปิดเคส</h3><p class="closure-subtitle">เปิดเคสเดิม ตรวจหลักฐาน แล้วดำเนินการตามสิทธิ์</p></div><div class="closure-pending-total"><strong>${rows.length}</strong><span>คำขอรอหัวหน้า</span></div></header><div class="closure-flow" aria-label="ขั้นตอนปิดเคส"><span><i>1</i> Audit ตรวจเอกสาร</span><span><i>2</i> ส่งหัวหน้ารอปิด</span><span><i>3</i> หัวหน้าอนุมัติ</span></div><div class="closure-filter-grid"><label for="closureQueueStatus">สถานะคำขอ<select id="closureQueueStatus"><option value="pending">รอหัวหน้าปิดเคส</option><option value="ALL">ทุกคำขอ · รวมประวัติ</option><option value="approved">อนุมัติปิดแล้ว</option><option value="rejected">ส่งกลับ Audit</option></select></label><label for="closureQueueCompany">บริษัท<select id="closureQueueCompany"><option value="ALL">ทุกบริษัทตามสิทธิ์</option>${companies.map(c=>`<option>${h(c)}</option>`).join('')}</select></label><label for="closureQueueFrom">วันที่เคสตั้งแต่<input type="date" id="closureQueueFrom"></label><label for="closureQueueTo">ถึงวันที่<input type="date" id="closureQueueTo"></label></div><div class="closure-list-heading"><b>รายการคำขอ <span id="closureVisibleCount"></span></b><span>เคสเดิมและเอกสารยังอยู่ในภาพรวม</span></div><div id="closureQueueRows" class="closure-card-list" aria-live="polite"></div><p class="closure-history-note">การส่งหัวหน้ารอปิดไม่ส่งงานให้ผู้ชี้แจงซ้ำ · อนุมัติสำเร็จจึงถือว่าปิดเคส · ย้อนดูรายละเอียดและหลักฐานได้เสมอ</p>`;
    const queueActions=document.createElement('div');
    const retry=document.createElement('button');retry.className='ghost-button sm';retry.textContent='รีเฟรชคิวจากฐานข้อมูล';
    retry.onclick=async()=>{retry.disabled=true;try{await mountQueue(host,{...options,force:true});}finally{retry.disabled=false;}};
    queueActions.append(retry);host.querySelector('.closure-hub-heading').append(queueActions);
    if(recentHistory.length){
      const info=document.createElement('p');info.setAttribute('role','status');
      info.textContent='ไม่มีคำขอรอในฐานข้อมูลขณะตรวจ ประวัติคำขอล่าสุด: '+recentHistory.map(q=>(q.company||'')+' '+(q.snapshot?.code||q.exception_id)+' ('+(q.status==='approved'?'อนุมัติแล้ว':'ส่งกลับ Audit')+')').join(' · ');
      const historyButton=document.createElement('button');historyButton.className='ghost-button sm';historyButton.textContent='ดูคำขอที่อนุมัติแล้วและประวัติ';
      historyButton.onclick=()=>{const select=$('#closureQueueStatus');select.value='ALL';select.onchange({target:select});};
      host.querySelector('.closure-list-heading').before(info,historyButton);
    }
    if(queueState.error){const info=document.createElement('p');info.setAttribute('role','alert');info.textContent=queueState.error;host.querySelector('.closure-list-heading').before(info);}
    const bulkBar=document.createElement('div');bulkBar.className='closure-bulk-bar';
    bulkBar.innerHTML='<label><input type="checkbox" id="closureBulkSelectAll">เลือกเคสที่เปิดหลักฐานแล้วในหน้านี้</label><span id="closureBulkCount">เลือก 0 เคส</span><button class="primary-button sm" id="closureBulkOpen" disabled>ทบทวนและปิดเคสที่เลือก</button><p role="status" id="closureBulkHint">ยังเลือกไม่ได้: กด “เปิดหลักฐานเพื่อเลือก” ของแต่ละเคส อ่านเอกสาร แล้วกลับมาติ๊ก · เฉพาะไม่มีความเสียหาย · ไม่เกิน 100 เคส · ต้องยืนยันก่อนปิด</p>';
    if(can('approve'))host.querySelector('.closure-list-heading').after(bulkBar);
    for(const [id,key] of [['closureQueueCompany','company'],['closureQueueFrom','from'],['closureQueueTo','to']])$('#'+id).value=queueFilters[key];
    const draw=()=>{
      const company=$('#closureQueueCompany').value,from=$('#closureQueueFrom').value,to=$('#closureQueueTo').value;
      Object.assign(queueFilters,{company,from,to});
      for(const id of ['closureQueueCompany','closureQueueFrom','closureQueueTo']){const el=$('#'+id);if(el.tagName==='SELECT')Array.from(el.options).forEach(o=>o.defaultSelected=o.selected);else el.defaultValue=el.value;}
      if(from&&to&&from>to){selected.clear();if(can('approve')){$('#closureBulkCount').textContent='เลือก 0 เคส';$('#closureBulkOpen').disabled=true;$('#closureBulkSelectAll').disabled=true;$('#closureBulkSelectAll').checked=false;}$('#closureVisibleCount').textContent='';$('#closureQueueRows').innerHTML='<div class="closure-empty" role="status">วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด</div>';return;}
      const visible=rows.filter(q=>(company==='ALL'||q.company===company)&&(!from||q.business_date>=from)&&(!to||q.business_date<=to));
      for(const id of selected)if(!visible.some(q=>q.id===id&&bulkEligible(q)))selected.delete(id);
      $('#closureVisibleCount').textContent=`(${visible.length})`;
      $('#closureQueueRows').innerHTML=visible.map(q=>{
        const statusText=q.status==='pending'?'รอหัวหน้าปิดเคส':q.status==='approved'?'ปิดเคสแล้ว':'ส่งกลับ Audit';
        const amount=v=>v==null?'ไม่พบรายการ':`${money(v)} บาท`;
        const date=q.business_date?String(q.business_date).split('-').reverse().join('/'):'ไม่ระบุ';
        return `<article class="closure-case-card"><div class="closure-case-top"><div>${bulkEligible(q)?`<label class="closure-case-select"><input type="checkbox" data-closure-select="${h(q.id)}" aria-label="เลือก ${h(q.company)} ${h(q.snapshot?.code||q.exception_id)}" ${selected.has(q.id)?'checked':''} ${opened.has(q.exception_id)?'':'disabled title="เปิดหลักฐานเพื่อเลือกเคสนี้ก่อน"'}>เลือก${opened.has(q.exception_id)?' · เปิดตรวจแล้ว':' (ยังไม่ได้เปิดตรวจ)'}</label>${opened.has(q.exception_id)?'':`<button class="ghost-button sm" data-closure-open="${h(q.exception_id)}">เปิดหลักฐานเพื่อเลือก</button>`}`:''}<span class="closure-company">${h(q.company)}</span><h4>${h(q.snapshot?.code||q.exception_id)}</h4><span class="closure-case-date">วันที่เคส ${h(date)}</span></div><span class="closure-state ${q.status==='approved'?'is-approved':q.status==='pending'?'is-pending':'is-returned'}">${h(statusText)}</span></div><div class="closure-case-amounts"><div><span>ยอด BO</span><strong>${h(amount(q.snapshot?.system_amount))}</strong></div><div><span>ยอด STM / PM</span><strong>${h(amount(q.snapshot?.bank_amount))}</strong></div><div class="closure-outcome ${q.outcome==='no_loss'?'is-zero':'is-loss'}"><span>ผลตรวจที่เสนอ</span><strong>${h(outcomeLabel(q))}</strong></div></div><div class="closure-case-bottom"><div><span>ผลตรวจ Audit / หลักฐานอ้างอิง</span><p>${h(q.audit_reason||'ไม่ระบุ')}</p></div><button class="${q.status==='pending'?'primary-button':'ghost-button'} sm" data-closure-open="${h(q.exception_id)}">${q.status==='pending'?'เปิดเคสเพื่อตรวจ':'ดูรายละเอียดและประวัติ'} →</button>${q.status==='pending'&&can('approve')?`<button class="primary-button sm" data-closure-review="${h(q.exception_id)}">อนุมัติ</button>`:''}</div></article>`;
      }).join('')||'<div class="closure-empty"><b>ไม่มีคำขอตามตัวกรองนี้</b><p>เคสที่แนบเอกสารอย่างเดียว ยังต้องให้ Audit ตรวจผลและส่งหัวหน้าก่อน<br>ดูเคสเดิมได้ในรายการภาพรวมด้านล่าง หรือเลือกสถานะ “ทุกคำขอ” เพื่อดูประวัติ</p></div>';
      const syncBulk=()=>{if(!can('approve'))return;persistBulkSelection();$('#closureBulkCount').textContent=`เลือก ${selected.size} เคส`;$('#closureBulkOpen').disabled=!selected.size;const eligible=visible.filter(q=>bulkEligible(q)&&opened.has(q.exception_id));$('#closureBulkHint').textContent=eligible.length?`เปิดตรวจแล้ว ${eligible.length} เคส · จำรายการหลังรีเฟรชในบัญชีนี้ · ข้อมูลหรือหลักฐานเปลี่ยนต้องอ่านใหม่ · ต้องยืนยันรายเคสก่อนปิด`:'ยังเลือกไม่ได้: กด “เปิดหลักฐานเพื่อเลือก” ของแต่ละเคส อ่านเอกสาร แล้วกลับมาติ๊ก · ไม่มีการปิดเคสอัตโนมัติ';$('#closureBulkSelectAll').disabled=!eligible.length;$('#closureBulkSelectAll').checked=!!eligible.length&&eligible.every(q=>selected.has(q.id));};
      host.querySelectorAll('[data-closure-select]').forEach(el=>el.onchange=()=>{if(el.checked&&selected.size>=100){el.checked=false;return toast('เลือกได้ไม่เกิน 100 เคส','warn');}el.checked?selected.add(el.dataset.closureSelect):selected.delete(el.dataset.closureSelect);syncBulk();});
      if(can('approve')){
        $('#closureBulkSelectAll').onchange=event=>{visible.filter(q=>bulkEligible(q)&&opened.has(q.exception_id)).forEach(q=>{if(event.target.checked&&selected.size<100)selected.add(q.id);else if(!event.target.checked)selected.delete(q.id);});draw();};
        $('#closureBulkOpen').onclick=()=>openBulkReview(visible.filter(q=>selected.has(q.id)),opened,()=>mountQueue(host));syncBulk();
      }
      host.querySelectorAll('[data-closure-open]').forEach(b=>b.onclick=async()=>{try{await openEvidenceRelatedCase(b.dataset.closureOpen,{focusFiles:true});const q=visible.find(q=>q.exception_id===b.dataset.closureOpen);if(q&&bulkEligible(q)){await rememberBulkReview(q);opened.add(q.exception_id);}if(host.isConnected)draw();}catch(err){toast(err.message,'warn');}});
      host.querySelectorAll('[data-closure-review]').forEach(b=>b.onclick=()=>{
        const q=visible.find(q=>q.exception_id===b.dataset.closureReview);
        return openApprovalReview(b.dataset.closureReview,'closure',q?.id).catch(err=>toast(err.message,'warn'));
      });
    };
    ['closureQueueCompany','closureQueueFrom','closureQueueTo'].forEach(id=>$('#'+id).onchange=draw);
    $('#closureQueueStatus').onchange=async event=>{const status=event.target.value;selected.clear();if(can('approve')){$('#closureBulkCount').textContent='เลือก 0 เคส';$('#closureBulkOpen').disabled=true;$('#closureBulkSelectAll').disabled=true;}$('#closureQueueRows').textContent='กำลังอ่านประวัติจริง…';try{const all=await Sb.caseClosureHistory();if(!host.isConnected||$('#closureQueueStatus').value!==status)return;rows=all.filter(q=>status==='ALL'||q.status===status);draw();}catch(err){if(host.isConnected)$('#closureQueueRows').textContent='อ่านประวัติไม่สำเร็จ: '+err.message;}};draw();
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
  return {setBulkReadConfirmation,queueState,loadPending,openSubmit,mountReview,mountQueue,mountSettings,approvalNote,selfEligible,outcomeLabel,assistantCloseBlock,bulkEligible,reviewFingerprint,approveBulkReviewed,reviewReceipt,rememberBulkReview,restoreBulkSelection,persistBulkSelection,reviewedSelectionState};
})();
