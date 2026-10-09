/* BO case ↔ exact stored STM row. Drafts are local; only the server reserves/approves. */
const CrossDayWorkbench = (() => {
  const drafts = new Map();
  let draftUser=null;
  function scopeDrafts(){const user=Sb.authUser()?.id;if(draftUser!==user){drafts.clear();draftUser=user;}}
  const queueState={rows:null,user:null,loading:false,at:0,error:''};
  async function loadPending(force=false){
    if(state.dataset!=='production'||!Sb.signedIn())return;
    const user=Sb.authUser()?.id;if(queueState.user!==user)Object.assign(queueState,{rows:null,user,at:0,error:''});
    if(queueState.loading||!force&&Date.now()-queueState.at<60000)return;
    queueState.loading=true;try{const rows=await Sb.pendingCrossDayPairs();if(Sb.authUser()?.id===user){queueState.rows=rows;queueState.error='';}}catch(error){if(Sb.authUser()?.id===user){queueState.rows=null;queueState.error=error.message;}}finally{queueState.loading=false;queueState.at=Date.now();if(typeof renderNav==='function')renderNav();}
  }
  const writable = () => state.dataset === 'production' && Sb.signedIn() && ['monitor','audit_assistant','lead','admin'].includes(state.role);
  const eligible = e => e.type === 'cross_day' && e.status === 'open';
  const key = (file, row) => `${file.id}:${row.source_mode==='image'?'page':'row'}:${row.rowNo}`;
  const lateNight = value => {
    const match=String(value||'').match(/(?:^|[T\s])(\d{2}):(\d{2})(?::(\d{2}))?/);
    return !!match&&Number(match[1])===23&&Number(match[2])<60;
  };
  const bankOf = f => /(?:^|[_\s-])BBL(?:[_\s.-]|$)/i.test(f.file_name||'')?'BBL':/(?:^|[_\s-])SCB(?:[_\s.-]|$)/i.test(f.file_name||'')?'SCB':'';
  function scopedData(data,e,selection={}) {
    const anchor=(data.cases||[]).find(c=>c.id===e.dbId)||(drafts.get(e.dbId)?.uncertain?drafts.get(e.dbId).caseRow:null);
    if(!anchor?.account||anchor.business_date!==e.date)throw Error('ไม่พบเคสต้นทางในคิวล่าสุด กรุณาตรวจสถานะเคสก่อน ไม่แสดงบัญชีอื่นแทน');
    const account=selection.account||anchor.account,date=selection.date||anchor.business_date,bank=selection.bank||'';
    const cases=(data.cases||[]).filter(c=>c.company===anchor.company&&c.account===account&&c.business_date===date&&lateNight(c.occurred_at));
    const files=(data.files||[]).filter(f=>f.company===anchor.company&&(!bank||bankOf(f)===bank)&&((f.rows||[]).some(r=>r.account===account)||!(f.rows||[]).length)).map(f=>({...f,rows:(f.rows||[]).filter(r=>r.account===account&&r.date===date&&Number(r.sec)>=82800&&Number(r.sec)<=86399)}));
    return {anchor,cases,files};
  }
  function stage(caseRow, file, row, reason) {
    scopeDrafts();
    if (!caseRow || !file || !row || !reason || reason.trim().length < 10) throw Error('เลือกรายการ BO, STM และระบุเหตุผลอย่างน้อย 10 ตัวอักษร');
    if (!row.verified) throw Error('เอกสารนี้ยังไม่มีรายการต้นทางที่ตรวจสอบยืนยันได้ — เปิดภาพตรวจได้ แต่ยังส่งคู่ไม่ได้');
    if(Number(caseRow.system_amount)<=0||Number(row.amount)<=0)throw Error('ยอดต้นทางทั้งสองฝั่งต้องมากกว่า 0');
    if(row.date&&caseRow.business_date&&row.date!==caseRow.business_date)throw Error('วันที่ธุรกรรมจริงของ BO และ STM ต้องตรงกัน');
    if (caseRow.direction !== (row.direction === 'deposit' ? 'ฝาก' : 'ถอน') || caseRow.account !== row.account || caseRow.company !== file.company) throw Error('บริษัท บัญชี และทิศทางของรายการต้องตรงกัน');
    const difference = Math.abs(Math.round(Number(caseRow.system_amount)*100)-Math.round(Number(row.amount)*100));
    if (!Number.isFinite(difference) || difference > 500) throw Error('ยอดต่างเกิน 5 บาท');
    for (const [id,d] of drafts) if (id !== caseRow.id && key(d.file,d.row) === key(file,row)) throw Error('STM รายการนี้ถูกเตรียมให้ BO อีกเคสแล้ว');
    const old = drafts.get(caseRow.id);
    if (old?.uncertain) throw Error('คำขอนี้ยังไม่ทราบผลบันทึก ต้องตรวจสถานะเดิมก่อนเปลี่ยนคู่');
    const draft = {caseRow,file,row,reason:reason.trim(),requestId:crypto.randomUUID(),uncertain:false};
    drafts.set(caseRow.id,draft); return draft;
  }
  async function send(draft,closeDirect=false) {
    scopeDrafts();
    if(!writable()||drafts.get(draft.caseRow.id)!==draft)throw Error('คำขอนี้ไม่ใช่ร่างของบัญชีปัจจุบัน');
    if(closeDirect&&!['lead','admin'].includes(state.role))throw Error('เฉพาะหัวหน้า / แอดมินปิดคู่โดยตรง');
    const payload = {p_id:draft.requestId,p_case:draft.caseRow.id,p_file:draft.file.id,p_row:Number(draft.row.rowNo),p_reason:draft.reason};
    draft.uncertain = true;
    let request;
    const image=draft.row.source_mode==='image';
    const readBack=image?Sb.crossDayImageReview:Sb.crossDayPair;
    try { request = image?await (closeDirect?Sb.closeCrossDayImageReview:Sb.submitCrossDayImageReview)({p_id:draft.requestId,p_case:draft.caseRow.id,p_file:draft.file.id,p_page:draft.row.rowNo,p_reason:draft.reason}):await (closeDirect?Sb.closeCrossDayPair:Sb.submitCrossDayPair)(payload); }
    catch (error) {
      // Lost responses are not failures and must not create a new request ID.
      try { request = await readBack(draft.requestId); } catch { /* keep uncertain draft */ }
      if (!request) throw error;
    }
    if (request?.id !== draft.requestId || request.exception_id !== draft.caseRow.id || request.stm_file_id !== draft.file.id || Number(image?request.source_page:request.stm_row) !== Number(draft.row.rowNo) || request.submitted_by !== Sb.authUser()?.id || !['pending','approved'].includes(request.status)) throw Error('ยังยืนยันผลคำขอไม่ได้ กรุณาตรวจคำขอเดิมก่อนลองซ้ำ');
    if(closeDirect&&request.status!=='approved')throw Error('ยังยืนยันการปิดโดยตรงไม่ได้ เก็บคำขอเดิมไว้');
    drafts.delete(draft.caseRow.id); return request;
  }
  async function open(e) {
    scopeDrafts();
    if (!writable() || !eligible(e)) return toast('เลือกเคสข้ามวันที่เปิดอยู่ และใช้บัญชี Audit','warn');
    const addDay = (date,n) => { const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10); };
    openModal('จับคู่เคสข้ามวัน · ส่งหัวหน้าอนุมัติ',`<div id="crossDayWorkbench"><p>กำลังโหลด BO และรายการจาก STM จริง… ยังไม่บันทึกเคส</p></div>`, '<button class="ghost-button" id="crossDayClose">กลับหน้าเคส</button>');
    $('#crossDayClose').onclick=()=>{if(!busy)closeModal();};
    const host=$('#crossDayWorkbench'); let data,active=e.dbId,file=null,row=null,previewVersion=0,busy=false;
    let retainedPreview=null,retainedFile=null,tab='work';
    try { data=await Sb.crossDayWorkbench({p_company:e.company,p_from:addDay(e.date,-3),p_to:addDay(e.date,3)}); }
    catch(error) { if(host.isConnected)host.innerHTML=`<p role="alert">เปิดหน้าจับคู่ข้ามวันไม่ได้: ${h(error.message)} · ต้องติดตั้งเวิร์กโฟลว์ฐานข้อมูลก่อน ไม่ใช้วิธีข้ามกฎปิดเคส</p>`;return; }
    if(!host.isConnected)return;
    let scoped;
    try{scoped=scopedData(data,e);}catch(error){host.textContent=error.message;return;}
    const {anchor}=scoped;
    let cases=scoped.cases,files=scoped.files;
    let selection={account:anchor.account,date:anchor.business_date,bank:''};
    const picked=new Set([...drafts.keys()].filter(id=>cases.some(c=>c.id===id)));
    // A committed-but-unconfirmed request may no longer appear among open cases.
    // Keep its local draft accessible so the same ID can be read/retried safely.
    for(const d of drafts.values())if(d.uncertain&&d.caseRow.company===anchor.company&&d.caseRow.account===anchor.account&&d.caseRow.business_date===anchor.business_date&&lateNight(d.caseRow.occurred_at)&&!cases.some(c=>c.id===d.caseRow.id)){cases.push(d.caseRow);picked.add(d.caseRow.id);}
    const sent=new Set(),reservedRows=new Set(), visibleCases=()=>cases.filter(c=>!sent.has(c.id));
    const current=()=>cases.find(c=>c.id===active);
    function render() {
      const oldPreview=$('#crossDayPreview');
      if(oldPreview?.querySelector('canvas')&&oldPreview.dataset.file===file?.id){retainedPreview=oldPreview;retainedFile=file.id;}
      else {retainedPreview=null;retainedFile=null;}
      host.innerHTML=`<p>BO ซ้าย · STM ขวา · ส่งหรือปิดหลายคู่ตามสิทธิ์ · ไม่รีหน้า</p><p role="status" id="crossDayStatus">เหลือ ${visibleCases().length} เคส · เตรียม ${[...drafts.keys()].filter(id=>cases.some(c=>c.id===id)).length} คู่ · ส่ง/ปิดแล้ว ${sent.size} คู่</p><div class="cross-day-grid"><section><h3>BO · เคสที่ยังไม่ส่ง</h3><div class="cross-day-cases">${visibleCases().map(c=>`<article class="cross-day-case ${active===c.id?'active':''}"><label><input type="checkbox" data-cross-pick="${h(c.id)}" ${drafts.has(c.id)?'checked':''} aria-label="เตรียม ${h(c.code)}"><button class="link-btn" data-cross-case="${h(c.id)}">${h(c.code)} · ${money(c.system_amount)} บาท</button></label><p>${h(c.business_date)} ${h(c.occurred_at||'')} · ${h(c.direction)} · ${h(c.account)}</p><small>${drafts.get(c.id)?.uncertain?'ยังไม่ทราบผลบันทึก — ตรวจคำขอเดิม':drafts.has(c.id)?'เตรียมคู่แล้ว':'ยังไม่เลือก STM'}</small></article>`).join('')||'<p>ส่งครบในรายการที่โหลดแล้ว ไม่ใช่ยอดครบทั้งระบบ</p>'}</div><div id="crossDayDrafts"></div></section><section><h3>STM · เอกสารต้นฉบับจริง</h3><label>เลือกเอกสาร<select id="crossDayFile"><option value="">เลือกไฟล์ STM</option>${files.map(f=>`<option value="${h(f.id)}" ${file?.id===f.id?'selected':''}>${h(f.file_name)} · ${h(f.business_date)}</option>`).join('')}</select></label><div id="crossDayPreview"><p>เลือกเอกสารเพื่อดูสเตทเมนต์จริง</p></div><div id="crossDayRows"></div><label>เหตุผลที่จับคู่<textarea id="crossDayReason" maxlength="2000" rows="3">${h(drafts.get(active)?.reason||'ตรวจรายการข้ามวันจาก BO และเอกสาร STM ต้นฉบับแล้ว')}</textarea></label><label><input id="crossDayChecked" type="checkbox"> ตรวจบริษัท บัญชี วันที่ ยอด และรายการจริงแล้ว</label><button class="primary-button" id="crossDayStage">เตรียมคู่ของเคสที่เปิดดู</button><p id="crossDayError" role="alert"></p></section></div>`;
      host.querySelectorAll('[data-cross-case]').forEach(b=>b.onclick=()=>{if(busy)return;active=b.dataset.crossCase;const d=drafts.get(active);file=d?.file||file;row=d?.row||null;render();});
      // Keep action buttons outside checkbox labels: their default label action
      // can toggle a replacement checkbox after a synchronous render.
      host.querySelectorAll('.cross-day-case label').forEach(label=>{
        const button=label.querySelector('[data-cross-case]');
        if(button)label.after(button);
      });
      host.querySelectorAll('[data-cross-pick]').forEach(c=>{c.checked=picked.has(c.dataset.crossPick);c.onchange=()=>{if(busy){c.checked=picked.has(c.dataset.crossPick);return;}if(!c.checked){const d=drafts.get(c.dataset.crossPick);if(d?.uncertain){c.checked=true;return toast('ยังไม่ทราบผลบันทึก ห้ามล้างคำขอเดิม','warn');}picked.delete(c.dataset.crossPick);drafts.delete(c.dataset.crossPick);render();}else{picked.add(c.dataset.crossPick);active=c.dataset.crossPick;const d=drafts.get(active);file=d?.file||file;row=d?.row||null;render();}};});
      const scopeHint=document.createElement('p');scopeHint.className='alert info';scopeHint.textContent=`เฉพาะ ${anchor.company} · บัญชี ${selection.account} · วันที่ ${selection.date} เวลา 23:00–23:59 · ติ๊ก BO คือเลือกไว้ ยังไม่ใช่เตรียมคู่หรือบันทึก · คู่ที่เตรียมในบัญชีอื่นยังเก็บอยู่`;
      host.prepend(scopeHint);
      const filters=document.createElement('div');filters.className='cross-day-filters';
      const accounts=[...new Set((data.cases||[]).filter(c=>c.company===anchor.company).map(c=>c.account))].filter(Boolean);
      filters.innerHTML=`<label>ธนาคาร STM<select id="crossDayBank"><option value="">ทั้งหมด</option><option value="SCB">SCB</option><option value="BBL">BBL</option></select></label><label>บัญชี BO<select id="crossDayAccount">${accounts.map(a=>`<option value="${h(a)}">${h(a)}</option>`).join('')}</select></label><label>วันที่ธุรกรรม BO<input id="crossDayDate" type="date" min="${h(addDay(e.date,-3))}" max="${h(addDay(e.date,3))}" value="${h(selection.date)}"></label><p>เลือกวันภายในช่วงที่โหลด ±3 วันจากเคสต้นทาง · วันที่เอกสาร STM อาจเป็นวันถัดไป</p>`;
      host.prepend(filters);$('#crossDayBank').value=selection.bank;$('#crossDayAccount').value=selection.account;
      const header=document.createElement('header');header.className='cross-day-header';
      header.innerHTML='<small>AUDIT AI · BO / เอกสารต้นฉบับจริง</small><h2>ปิดเคสข้ามวัน</h2><p>เตรียมหลายคู่ · ส่งเป็นชุด · จำนวนที่เหลือค่อย ๆ ลดลง</p><span>ผู้ช่วยส่งหัวหน้า · หัวหน้า/แอดมินปิดชุดที่ตรวจเองได้</span>';
      const tabs=document.createElement('nav');tabs.className='cross-day-tabs';tabs.setAttribute('aria-label','คิวเคสข้ามวัน');
      tabs.innerHTML=['work','pending','closed'].map((t,i)=>`<button type="button" data-cross-tab="${t}" aria-pressed="${tab===t}">${['จับคู่เพื่อส่งอนุมัติ','รอหัวหน้า','ปิดแล้ว'][i]}</button>`).join('');
      host.prepend(tabs);host.prepend(header);
      host.append($('#crossDayDrafts'));
      const queuePanel=document.createElement('section');queuePanel.id='crossDayQueuePanel';host.append(queuePanel);
      const showTab=async()=>{
        host.querySelector('.cross-day-grid').hidden=tab!=='work';filters.hidden=scopeHint.hidden=tab!=='work';$('#crossDayDrafts').hidden=tab!=='work';queuePanel.hidden=tab==='work';
        tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.crossTab===tab)));
        if(tab==='pending')await mountQueue(queuePanel,{company:anchor.company,account:selection.account,date:selection.date});
        if(tab==='closed'){
          queuePanel.textContent='กำลังโหลดประวัติที่อนุมัติแล้ว…';
          try{const rows=await Sb.crossDayPairHistory(anchor.company,selection.date);if(!queuePanel.isConnected||tab!=='closed')return;
            const own=rows.filter(q=>q.snapshot?.bo?.account===selection.account);
            queuePanel.innerHTML='<h3>ปิดแล้ว · บัญชีและวันที่ที่เลือก</h3>'+(own.map(q=>`<article><b>${h(q.snapshot.bo.code)} · ${money(q.snapshot.bo.system_amount)} บาท</b><p>${h(q.reason)}</p><small>อนุมัติแล้ว · STM ${q.source_mode==='image'?'ภาพหน้า':'แถว'} ${h(q.source_page||q.stm_row)}</small></article>`).join('')||'<p>ไม่พบรายการอนุมัติแล้วในขอบเขตนี้</p>');
          }catch(error){if(queuePanel.isConnected)queuePanel.textContent='ยังโหลดประวัติไม่ได้: '+error.message;}
        }
      };
      tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(busy)return;tab=b.dataset.crossTab;showTab();});
      const changeScope=()=>{
        if(busy)return;
        const next={bank:$('#crossDayBank').value,account:$('#crossDayAccount').value,date:$('#crossDayDate').value};
        if(!next.date||next.date<addDay(e.date,-3)||next.date>addDay(e.date,3)){toast('เลือกวันที่ภายในช่วงที่โหลด ±3 วัน','warn');return;}
        selection=next;const scoped=scopedData(data,e,selection);cases=scoped.cases;files=scoped.files;
        for(const d of drafts.values())if(d.uncertain&&d.caseRow.company===anchor.company&&d.caseRow.account===selection.account&&d.caseRow.business_date===selection.date&&!cases.some(c=>c.id===d.caseRow.id))cases.push(d.caseRow);
        active=visibleCases()[0]?.id;file=null;row=null;render();
      };
      for(const id of ['#crossDayBank','#crossDayAccount','#crossDayDate']){$(id).disabled=busy;$(id).onchange=changeScope;}
      $('#crossDayFile').onchange=()=>{file=files.find(f=>f.id===$('#crossDayFile').value)||null;row=null;$('#crossDayChecked').checked=false;renderDocument();};
      $('#crossDayStage').onclick=()=>{try{if(!$('#crossDayChecked').checked)throw Error('ต้องยืนยันตรวจรายการก่อนเตรียมคู่');if(file&&row&&reservedRows.has(key(file,row)))throw Error('STM รายการนี้ส่งแล้ว ห้ามเลือกซ้ำ');stage(current(),file,row,$('#crossDayReason').value);picked.add(active);render();}catch(error){$('#crossDayError').textContent=error.message;}};
      renderDrafts(); renderDocument();showTab();
    }
    function renderDrafts() {
      const own=[...drafts.values()].filter(d=>cases.some(c=>c.id===d.caseRow.id));
      $('#crossDayDrafts').innerHTML='<h3>คู่ที่เตรียมไว้</h3>'+own.map(d=>`<article><b>${h(d.caseRow.code)} ↔ ${h(d.file.file_name)} ${d.row.source_mode==='image'?'ภาพหน้า':'แถว'} ${h(d.row.rowNo)}</b><p>BO ${money(d.caseRow.system_amount)} บาท · ${d.row.source_mode==='image'?'ยอด STM ยังไม่ได้อ่าน — ให้หัวหน้าตรวจภาพ':`STM ${money(d.row.amount)} บาท`}</p><button class="primary-button" data-cross-send="${h(d.caseRow.id)}" ${busy?'disabled':''}>${d.uncertain?'ตรวจและส่งคำขอเดิมซ้ำ':'ส่งคู่นี้ให้หัวหน้า'}</button></article>`).join('');
      if(own.length){
        const controls=document.createElement('div');
        controls.innerHTML=`<button id="crossDaySendBatch" class="primary-button" ${busy?'disabled':''}>ส่งทั้งหมด ${own.length} คู่ให้หัวหน้า</button>${['lead','admin'].includes(state.role)?`<label><input id="crossDayBatchChecked" type="checkbox" ${busy?'disabled':''}>ตรวจคู่ในชุดนี้และไม่ใช้รายการ STM ซ้ำแล้ว</label><button id="crossDayCloseBatch" class="primary-button" ${busy?'disabled':''}>ปิดชุดที่ตรวจเอง ${own.length} คู่</button>`:''}<p id="crossDayBatchProgress" role="status"></p>`;
        $('#crossDayDrafts').prepend(controls);
        const runBatch=async direct=>{
          if(busy)return;if(direct&&!$('#crossDayBatchChecked').checked)return toast('ยืนยันชุดที่ตรวจเองก่อนปิด','warn');
          busy=true;const actor=Sb.authUser()?.id;let ok=0;const errors=[];
          controls.querySelectorAll('button,input').forEach(b=>b.disabled=true);
          host.querySelectorAll('[data-cross-send]').forEach(b=>b.disabled=true);
          try{for(const [i,d] of own.entries()){
            if(!host.isConnected){errors.push('ปิดหน้าต่างแล้ว หยุดชุดที่เหลือและเก็บร่างไว้');break;}
            if(Sb.authUser()?.id!==actor){errors.push('บัญชีเปลี่ยน หยุดชุดที่เหลือ');break;}
            $('#crossDayBatchProgress').textContent=`กำลังดำเนินการ ${i+1}/${own.length} · สำเร็จ ${ok} คู่`;
            try{const q=await send(d,direct);ok++;sent.add(d.caseRow.id);reservedRows.add(key(d.file,d.row));const local=DB.exceptions.find(c=>c.dbId===d.caseRow.id);if(local){local.crossDayRequestId=d.requestId;local.status=q.status==='approved'?'closed':'pair_pending';}}
            catch(error){errors.push(`${d.caseRow.code}: ${error.message}`);if(/timed out|timeout|failed to fetch|network/i.test(error.message)){errors.push('หยุดชุดเพื่อไม่ส่งซ้ำขณะการเชื่อมต่อมีปัญหา');break;}}
          }}finally{busy=false;queueState.at=0;if(sent.has(active)){active=visibleCases()[0]?.id;row=null;}if(host.isConnected){render();const result=document.createElement('p');result.setAttribute('role','status');result.textContent=`${direct?'ปิด':'ส่ง'}สำเร็จ ${ok}/${own.length} คู่${errors.length?' · '+errors.join(' · '):''} · คู่ที่ยังไม่สำเร็จเก็บรหัสเดิมไว้`;$('#crossDayDrafts').prepend(result);}}
        };
        $('#crossDaySendBatch').onclick=()=>runBatch(false);
        if($('#crossDayCloseBatch'))$('#crossDayCloseBatch').onclick=()=>runBatch(true);
      }
      host.querySelectorAll('[data-cross-send]').forEach(b=>b.onclick=async()=>{if(busy)return;busy=true;renderDrafts();const d=drafts.get(b.dataset.crossSend);try{await send(d);sent.add(d.caseRow.id);reservedRows.add(key(d.file,d.row));queueState.at=0;const local=DB.exceptions.find(c=>c.dbId===d.caseRow.id);if(local){local.crossDayRequestId=d.requestId;local.status='pair_pending';}if(active===d.caseRow.id){active=visibleCases()[0]?.id;row=null;}toast('ส่งคู่นี้แล้ว รอหัวหน้าอนุมัติ — คู่ที่เตรียมอื่นยังอยู่','success');}catch(error){toast('ยังยืนยันคำขอไม่ได้: '+error.message+' — เก็บคู่และรหัสคำขอเดิมไว้','warn');}finally{busy=false;if(host.isConnected)render();}});
    }
    async function renderDocument() {
      const version=++previewVersion;
      $('#crossDayRows').innerHTML=file?`<h4>รายการในเอกสาร</h4>${(file.rows||[]).map(r=>`<label class="cross-day-row"><input type="radio" name="crossDayRow" value="${h(r.rowNo)}" ${row?.rowNo===r.rowNo?'checked':''} ${!r.verified||reservedRows.has(key(file,r))||[...drafts.values()].some(d=>d.caseRow.id!==active&&key(d.file,d.row)===key(file,r))?'disabled':''}> ${h(r.date)} · ${h(r.direction)} · ${money(r.amount)} บาท · ${h(r.desc||'')} · แถว ${h(r.rowNo)}</label>`).join('')||'<p>ยังไม่มีรายการที่ยืนยันได้จากไฟล์นี้ ห้ามสรุปว่าไม่มีธุรกรรม — ตรวจภาพและส่งผู้ดูแลตรวจการอ่านไฟล์</p>'}`:'';
      let comparison=$('#crossDayComparison');if(!comparison){comparison=document.createElement('section');comparison.id='crossDayComparison';$('#crossDayRows').after(comparison);}
      if(file){
        const imageForm=document.createElement('section');imageForm.className='cross-day-image-review';
        imageForm.innerHTML='<h4>เตรียมคู่จากภาพ</h4><p>เลือกหลาย BO ที่อยู่ในหน้า STM นี้ได้ · ต้องเป็นคนละรายการจริง ไม่ใช่ใช้ยอดเดียวกันซ้ำ</p><label>เลขหน้า STM ที่อ้างอิง<input id="crossDayImagePage" type="number" min="1" max="10000" value="1"></label><button id="crossDayImageStage" class="primary-button">เตรียม BO + ภาพหน้านี้ให้หัวหน้า</button><button id="crossDayImageStageAll" class="primary-button">เตรียม BO ที่ติ๊กและยังไม่เตรียมจากหน้านี้</button>';
        $('#crossDayRows').append(imageForm);
        $('#crossDayImageStage').onclick=()=>{
          try{
            const page=Number($('#crossDayImagePage').value),preview=$('#crossDayPreview');
            if(preview.dataset.ready!=='true'||page>Number(preview.dataset.pageCount))throw Error('เปิดภาพ STM และระบุหน้าที่มีอยู่จริงก่อน');
            const d=stageImage(current(),file,page,$('#crossDayReason').value);
            row=d.row;picked.add(d.caseRow.id);render();
          }catch(error){$('#crossDayError').textContent=error.message;}
        };
        $('#crossDayImageStageAll').onclick=()=>{
          try{
            const page=Number($('#crossDayImagePage').value),preview=$('#crossDayPreview');
            if(preview.dataset.ready!=='true'||page>Number(preview.dataset.pageCount))throw Error('เปิดภาพ STM และระบุหน้าที่มีอยู่จริงก่อน');
            const selected=cases.filter(c=>picked.has(c.id)&&!drafts.has(c.id)&&!sent.has(c.id));
            if(!selected.length)throw Error('ติ๊ก BO ที่ยังไม่เตรียมคู่ก่อน');
            for(const c of selected)stageImage(c,file,page,$('#crossDayReason').value);
            row=drafts.get(active)?.row||row;render();
          }catch(error){$('#crossDayError').textContent=error.message;}
        };
      }
      if(file)$('#crossDayImagePage').value=row?.source_mode==='image'?row.rowNo:(retainedPreview?.dataset.page||1);
      const compare=()=>{const bo=current();comparison.innerHTML=bo&&row?(row.source_mode==='image'?`<h4>ส่งตรวจจากภาพ</h4><p>BO ${h(bo.code)} · ${money(bo.system_amount)} บาท ↔ STM ภาพหน้า ${h(row.rowNo)}</p><p>ยังไม่มีจำนวนเงิน STM ที่อ่านยืนยันได้ — ไม่คำนวณผลต่างและไม่ปิดอัตโนมัติ</p>`:`<h4>เทียบคู่ที่กำลังตรวจ</h4><dl><dt>BO ${h(bo.code)}</dt><dd>${h(bo.business_date)} ${h(bo.occurred_at)} · ${money(bo.system_amount)} บาท</dd><dt>STM แถว ${h(row.rowNo)}</dt><dd>${h(row.date)} · ${money(row.amount)} บาท · ${h(row.account)}</dd></dl><p>ผลต่าง ${money(Math.abs(Number(bo.system_amount)-Number(row.amount)))} บาท · ยังไม่บันทึก</p>`):'<p>เลือก BO ทางซ้าย แล้วเลือกแถว STM หรือส่งตรวจจากภาพทางขวา</p>';};
      compare();
      host.querySelectorAll('input[name="crossDayRow"]').forEach(c=>c.onchange=()=>{row=file.rows.find(r=>String(r.rowNo)===c.value);$('#crossDayChecked').checked=false;compare();});
      if(!file){$('#crossDayPreview').textContent='เลือกเอกสารเพื่อดูสเตทเมนต์จริง';return;}
      if(retainedPreview&&retainedFile===file.id){$('#crossDayPreview').replaceWith(retainedPreview);return;}
      $('#crossDayPreview').textContent='กำลังเปิดสเตทเมนต์ต้นฉบับ…';
      try {if(!host.isConnected||version!==previewVersion)return;await StatementPreview.mount($('#crossDayPreview'),file);}
      catch(error){if(host.isConnected&&version===previewVersion)$('#crossDayPreview').textContent='เปิดภาพไม่สำเร็จ: '+error.message+' — ไม่ล้างคู่ที่เตรียมไว้';}
    }
    render();
  }
  async function mountQueue(host,scope) {
    if(!host||state.dataset!=='production')return;
    host.innerHTML='<h3>คู่ข้ามวัน · รอหัวหน้าอนุมัติ</h3><p>กำลังโหลดคำขอ…</p>';
    try {
      let rows=await Sb.pendingCrossDayPairs();
      if(scope)rows=rows.filter(q=>q.company===scope.company&&q.snapshot?.bo?.account===scope.account&&q.snapshot?.bo?.business_date===scope.date);
      if(!host.isConnected)return;
      const head=['lead','admin'].includes(state.role),groups=new Map();
      for(const q of rows){const k=JSON.stringify([q.company,q.snapshot.bo.account,q.snapshot.bo.business_date,q.stm_file_id,q.source_page||'rows']);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(q);}
      host.innerHTML='<h3>คู่ข้ามวัน · รอหัวหน้าอนุมัติ</h3>'+(rows.length?`<p>คิวที่โหลด ${rows.length} คู่ · เลือกหลายคู่และยืนยันครั้งเดียว ไม่ต้องกรอกผลตรวจซ้ำรายเคส</p>${head?'<button id="crossDayQueueSelectAll">เลือกทั้งหมดที่โหลด</button><label>ผลตรวจของชุด<textarea id="crossDayQueueNote" maxlength="2000">ตรวจคู่ที่เลือกกับหลักฐานต้นฉบับแล้ว</textarea></label><label><input id="crossDayQueueChecked" type="checkbox">ตรวจชุดที่เลือกแล้ว และไม่ใช้รายการ STM ซ้ำ</label><button class="primary-button" id="crossDayQueueApprove">อนุมัติคู่ที่เลือก</button><p id="crossDayQueueProgress" role="status"></p>':'<p>ผู้ช่วยส่งคำขอแล้ว รอหัวหน้า / แอดมินอนุมัติ</p>'}`+ [...groups.values()].map(group=>{const first=group[0],bo=first.snapshot.bo;return `<section><h4>${h(first.company)} · ${h(bo.account)} · ${h(bo.business_date)} · ${h(first.snapshot.file.file_name)} ${first.source_page?'หน้า '+h(first.source_page):''} · ${group.length} คู่</h4><button data-cross-group="${h(first.id)}">เปิดหลักฐานของกลุ่มนี้</button>${group.map(q=>`<article data-cross-queue-row="${h(q.id)}"><label><input type="checkbox" data-cross-approve-pick="${h(q.id)}" ${head?'':'disabled'}> ${h(q.snapshot.bo.code)} · BO ${money(q.snapshot.bo.system_amount)} บาท ↔ STM ${q.source_mode==='image'?'ภาพหน้า':'แถว'} ${h(q.source_page||q.stm_row)}</label><p>${h(q.reason)} · ${q.source_mode==='image'?'ตรวจด้วยภาพ ไม่ใช่คู่ที่ยืนยันยอดอัตโนมัติ':`ผลต่าง ${money(q.difference)} บาท`}</p><button class="ghost-button" data-cross-review="${h(q.id)}">ดูรายละเอียดคู่นี้</button></article>`).join('')}</section>`;}).join(''):'<p>ไม่พบคำขอข้ามวันรออนุมัติในขอบเขตสิทธิ์</p>');
      host.querySelectorAll('[data-cross-review]').forEach(b=>b.onclick=()=>review(rows.find(q=>q.id===b.dataset.crossReview)));
      host.querySelectorAll('[data-cross-group]').forEach(b=>b.onclick=async()=>{const q=rows.find(q=>q.id===b.dataset.crossGroup);openModal('หลักฐานของกลุ่มคู่ข้ามวัน','<div id="crossDayGroupPreview"></div>','<button id="crossDayGroupBack">กลับคิว</button>');$('#crossDayGroupBack').onclick=closeModal;await StatementPreview.mount($('#crossDayGroupPreview'),{...q.snapshot.file,preview_page:q.source_page||1});});
      if(head&&rows.length){
        host.querySelector('#crossDayQueueSelectAll').onclick=()=>host.querySelectorAll('[data-cross-approve-pick]').forEach(c=>c.checked=true);
        host.querySelector('#crossDayQueueApprove').onclick=async()=>{
          const ids=new Set([...host.querySelectorAll('[data-cross-approve-pick]:checked')].map(c=>c.dataset.crossApprovePick));
          const selected=rows.filter(q=>ids.has(q.id)),note=host.querySelector('#crossDayQueueNote').value.trim();
          if(!selected.length||!note||!host.querySelector('#crossDayQueueChecked').checked)return toast('เลือกคู่และยืนยันผลตรวจของชุดก่อน','warn');
          host.querySelectorAll('button,input,textarea').forEach(b=>b.disabled=true);
          let result;
          try{result=await approveMany(selected,note,(q,i)=>{const progress=host.querySelector('#crossDayQueueProgress');if(progress)progress.textContent=`กำลังอนุมัติ ${i}/${selected.length} คู่`;host.querySelector(`[data-cross-queue-row="${q.id}"]`)?.remove();});}
          catch(error){result={ok:0,errors:[error.message]};}
          queueState.at=0;await mountQueue(host,scope);
          if(host.isConnected){const p=document.createElement('p');p.setAttribute('role','status');p.textContent=`อนุมัติสำเร็จ ${result.ok}/${selected.length} คู่${result.errors.length?' · '+result.errors.join(' · '):''} · ไม่รีหน้า`;host.prepend(p);}
        };
      }
    }
    catch(error){if(host.isConnected)host.innerHTML=`<h3>คู่ข้ามวัน</h3><p role="alert">ยังโหลดคิวไม่ได้: ${h(error.message)} — ไม่ใช่ไม่มีคำขอ</p>`;}
  }
  async function approveMany(rows,note,onSuccess=()=>{}) {
    if(!['lead','admin'].includes(state.role)||!Sb.signedIn())throw Error('เฉพาะหัวหน้า / แอดมินอนุมัติ');
    const actor=Sb.authUser()?.id,errors=[];let ok=0;
    for(const [i,q] of rows.entries()){
      if(Sb.authUser()?.id!==actor){errors.push('บัญชีเปลี่ยน หยุดชุดที่เหลือ');break;}
      try{
        const receipt=await (q.source_mode==='image'?Sb.decideCrossDayImageReview:Sb.decideCrossDayPair)({p_id:q.id,p_action:'approve',p_note:note});
        if(receipt?.id!==q.id||receipt.status!=='approved'||receipt.decided_by!==actor)throw Error('ยังยืนยันผลอนุมัติไม่ได้');
        ok++;const local=DB.exceptions.find(e=>e.dbId===q.exception_id);if(local)local.status='closed';onSuccess(q,i+1);
      }catch(error){errors.push(`${q.snapshot.bo.code}: ${error.message}`);if(/timed out|timeout|failed to fetch|network/i.test(error.message))break;}
    }
    return {ok,errors};
  }
  async function review(q) {
    if(q.source_mode==='image')return reviewImage(q);
    const bo=q.snapshot.bo,stm=q.snapshot.stm,blocked=!['lead','admin'].includes(state.role);
    openModal('ตรวจคู่ข้ามวันก่อนอนุมัติ',`<p>${h(q.company)} · ${h(bo.code)} · ${h(bo.business_date)} ${h(bo.occurred_at)} · BO ${money(bo.system_amount)} บาท</p><p>STM ${h(stm.date)} · แถว ${h(q.stm_row)} · ${money(stm.amount)} บาท · ${h(stm.desc)}</p><p>${h(q.reason)}</p><div id="crossDayApprovalPreview">กำลังโหลดสเตทเมนต์จริง…</div><label>ผลตรวจ / เหตุผลส่งกลับ<textarea id="crossDayDecision" maxlength="2000"></textarea></label><label><input id="crossDayDecisionChecked" type="checkbox"> ตรวจ BO กับเอกสารจริงของคู่นี้แล้ว</label>${blocked?'<p>เฉพาะหัวหน้าอีกบัญชีอนุมัติ ผู้ส่งห้ามอนุมัติคำขอตัวเอง</p>':''}`,`<button class="ghost-button" id="crossDayReject" ${blocked?'disabled':''}>ส่งกลับ Audit</button><button class="primary-button" id="crossDayApprove" ${blocked?'disabled':''}>อนุมัติปิดเคสข้ามวัน</button>`);
    const preview=$('#crossDayApprovalPreview');try{await StatementPreview.mount(preview,q.snapshot.file);}catch(error){if(preview.isConnected)preview.textContent='เปิดหลักฐานไม่ได้: '+error.message;return;}
    for(const [selector,action] of [['#crossDayApprove','approve'],['#crossDayReject','reject']])$(selector).onclick=async()=>{const note=$('#crossDayDecision').value.trim();if(!$('#crossDayDecisionChecked').checked||action==='reject'&&note.length<10)return toast('ตรวจหลักฐานและยืนยันก่อน — ส่งกลับต้องระบุเหตุผลอย่างน้อย 10 ตัวอักษร','warn');$('#crossDayApprove').disabled=$('#crossDayReject').disabled=true;try{await Sb.decideCrossDayPair({p_id:q.id,p_action:action,p_note:note});closeModal();const host=$('#pendingCrossDayQueue');await mountQueue(host);toast(action==='approve'?'อนุมัติปิดแล้ว โดยไม่แก้ยอดต้นทาง':'ส่งกลับ Audit แล้ว','success');}catch(error){toast('ยังยืนยันผลไม่ได้: '+error.message+' — ตรวจสถานะคำขอก่อนลองใหม่','warn');}};
  }
  function stageImage(caseRow,file,page,reason){
    scopeDrafts();
    if(!caseRow||!file||!Number.isInteger(page)||page<1||page>10000)throw Error('เลือก BO ไฟล์ STM และเลขหน้าที่อ้างอิงก่อน');
    if(caseRow.company!==file.company)throw Error('บริษัทของ BO และไฟล์ต้องตรงกัน');
    if(drafts.get(caseRow.id)?.uncertain)throw Error('คำขอเดิมยังไม่ทราบผล ต้องตรวจสถานะก่อนเปลี่ยนหลักฐาน');
    const draft={caseRow,file,row:{source_mode:'image',rowNo:page,amount:null},reason:String(reason||'').trim()||'ตรวจจากภาพ STM ต้นฉบับ ส่งหัวหน้าตรวจเทียบ BO ก่อนอนุมัติ',requestId:crypto.randomUUID(),uncertain:false};
    if(draft.reason.length>2000)throw Error('ข้อความอ้างอิงยาวเกิน 2000 ตัวอักษร');
    drafts.set(caseRow.id,draft);return draft;
  }
  async function reviewImage(q){
    const bo=q.snapshot.bo,blocked=!['lead','admin'].includes(state.role);
    openModal('หัวหน้าตรวจ BO + ภาพ STM',`<p>${h(q.company)} · ${h(bo.code)} · BO ${money(bo.system_amount)} บาท</p><p>${h(q.snapshot.file.file_name)} · หน้า ${q.source_page} · ยังไม่มีผลจับคู่อัตโนมัติ</p><p>${h(q.reason)}</p><div id="crossDayImageHeadPreview"></div><label>ผลตรวจจากภาพ<textarea id="crossDayImageHeadNote" maxlength="2000"></textarea></label><label><input id="crossDayImageHeadChecked" type="checkbox">ตรวจรายการนี้ในภาพต้นฉบับแล้ว และยืนยันว่าไม่ใช้ซ้ำกับคู่ที่สำเร็จหรือเคสอื่น</label>${blocked?'<p>ต้องให้หัวหน้าอีกบัญชีตรวจอนุมัติ</p>':''}`,`<button id="crossDayImageReject" ${blocked?'disabled':''}>ส่งกลับ</button><button id="crossDayImageApprove" class="primary-button" ${blocked?'disabled':''}>อนุมัติปิดเคสจากหลักฐานภาพ</button>`);
    const preview=$('#crossDayImageHeadPreview');
    await StatementPreview.mount(preview,{...q.snapshot.file,preview_page:q.source_page});
    if(!preview.isConnected)return;
    if(preview.dataset.ready!=='true')$('#crossDayImageApprove').disabled=true;
    for(const [id,action] of [['crossDayImageApprove','approve'],['crossDayImageReject','reject']])$('#'+id).onclick=async()=>{
      const note=$('#crossDayImageHeadNote').value.trim();
      if(blocked||!note||action==='approve'&&(!$('#crossDayImageHeadChecked').checked||preview.dataset.ready!=='true'))return toast('หัวหน้าตรวจภาพและระบุผลตรวจก่อน','warn');
      $('#crossDayImageApprove').disabled=$('#crossDayImageReject').disabled=true;
      try{await Sb.decideCrossDayImageReview({p_id:q.id,p_action:action,p_note:note});queueState.at=0;closeModal();await mountQueue($('#pendingCrossDayQueue'));toast(action==='approve'?'หัวหน้าอนุมัติปิดเคสจากภาพแล้ว':'ส่งกลับตรวจหลักฐานแล้ว');}
      catch(error){toast('ยังยืนยันผลไม่ได้: '+error.message+' — ตรวจคำขอเดิมก่อนลองซ้ำ','warn');}
    };
  }
  return {eligible,open,mountQueue,stage,stageImage,send,approveMany,drafts,queueState,loadPending,scopedData,lateNight,bankOf};
})();
