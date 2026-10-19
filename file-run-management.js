(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const canManage=role=>['lead','admin'].includes(role);
 const kinds=['bo_main','stm_pdf','pm_statement','doc_clarify','unknown'];
 const kindLabel={bo_main:'BO หลังบ้าน',stm_pdf:'STM ธนาคาร',pm_statement:'Statement PM',doc_clarify:'หลักฐานประกอบ',unknown:'ยังไม่ระบุประเภท'};
 // An HTML dialog keeps review explicit without a blocking browser confirm.
 // This helper only returns a decision; it never saves or starts a worker.
 function confirmAction({title,message,confirmLabel='ยืนยัน',allowed=()=>true}){
  return new Promise(resolve=>{
   const doc=root.document,previous=doc.activeElement,dialog=doc.createElement('dialog');
   dialog.className='modal on file-run-confirm';
   dialog.setAttribute('aria-labelledby','fileRunConfirmTitle');
   dialog.innerHTML=`<header class="modal-head"><h2 id="fileRunConfirmTitle">${esc(title)}</h2></header><div class="modal-body"><p class="file-run-confirm-message">${esc(message)}</p></div><footer class="modal-foot"><button data-cancel>ยกเลิก</button><button class="primary" data-accept>${esc(confirmLabel)}</button></footer>`;
   let settled=false;
   const finish=value=>{if(settled)return;settled=true;root.AuditUi?.close(dialog);dialog.remove();if(previous?.isConnected)previous.focus();resolve(value);};
   dialog.querySelector('[data-cancel]').onclick=()=>finish(false);
   dialog.querySelector('[data-accept]').onclick=()=>finish(!!allowed());
   dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
   dialog.addEventListener('close',()=>finish(false));
   doc.body.appendChild(dialog);
   try{dialog.showModal();root.AuditUi?.open(dialog);dialog.querySelector('[data-cancel]').focus();}catch(e){finish(false);}
  });
 }
 function runNotice(s){
  if(!s)return {title:'ยังตรวจสถานะรันไม่ได้',reason:'โหลดสถานะไม่สำเร็จ ไม่ถือว่างานพร้อมรัน',next:'โหลดสถานะล่าสุดก่อนสั่งงาน',blocked:true};
  const j=s.job||s;
  if(s.workerFailure?.source_kind==='manual'&&j.status==='error')return {title:s.workerFailure.diagnostic_only?'ผลตรวจไฟล์ในเครื่อง · ยังไม่รันใหม่':'ประวัติรอบตรวจมือที่ไม่ผ่าน',reason:`หลักฐานตรวจมือ ${s.workerFailure.execution_id||'—'} · ${s.workerFailure.detail} · รายละเอียด: ${s.workerFailure.message}`,next:'เก็บคำขอและประวัติเดิม · ตรวจ OCR และแถวต้นทางให้ครบก่อนสั่งงานใหม่ ไม่ใช้ผลที่อ่านไม่ครบเป็นยอดศูนย์',blocked:false};
  if(s.workerFailure&&j.status==='error')return {title:'รอบหลักบันทึกผลไม่สำเร็จ',reason:`หลักฐานรันเดิม ${s.workerFailure.execution_id||'—'} · ${s.workerFailure.detail} · ข้อความ worker: ${s.workerFailure.message}`,next:'เก็บคำขอและประวัติเดิม · ตรวจผลรันมือและแถวอ้างอิงก่อนให้หัวหน้า/Admin ยืนยัน ไม่ลองรันซ้ำอัตโนมัติ',blocked:false};
  if(j.status==='running')return {title:'บอทรอบหลักกำลังรัน',reason:'ยังไม่รับงานตรวจมือซ้อนกับบริษัทและวันนี้',next:'รอรอบหลักจบ แล้วโหลดสถานะล่าสุด',blocked:true};
  if(s.hold?.paused||s.manualOnly)return {title:'พักบอทรอบหลัก'+(s.manualOnly?' · มีไฟล์แก้ไข':''),reason:s.hold?.reason||'ล็อกผลรอบหลักเพื่อรักษาประวัติเคสเดิมและป้องกันเคสซ้ำ',next:'เลือกไฟล์แล้วรันตรวจมือเป็นรายงานแยกได้ แม้ยังไม่มีผลเดิม · หัวหน้า/ผู้ดูแลยืนยันผลเท่านั้น',blocked:false};
  if(Number(j.attempt_count)>=3&&['queued','error'].includes(j.status))return {title:'รอบหลักลองครบ 3 ครั้ง',reason:j.last_error?.includes('ตรวจรูปแบบไฟล์หรือเพิ่มไฟล์ที่ถูกต้อง')?'หยุดหลังลองครบ 3 ครั้ง · ยังไม่ทราบสาเหตุจากข้อความนี้ ต้องตรวจบันทึก worker ไม่ได้ยืนยันว่าไฟล์เสีย':j.last_error||'ต้องตรวจสาเหตุเดิมก่อนส่งรอบหลักซ้ำ',next:'ตรวจไฟล์และเหตุผลล้มเหลว · ใช้รันตรวจมือเพื่อทบทวนผลแยกได้',blocked:false};
  if(j.status==='error')return {title:'รอบหลักล้มเหลว',reason:j.last_error||'ยังไม่มีรายละเอียดข้อผิดพลาด',next:'ตรวจไฟล์และโหลดสถานะล่าสุดก่อนสั่งตรวจมือ',blocked:false};
  return {title:j.status==='queued'?'คิวหลักรอรอบบอท':'สถานะรอบหลัก',reason:j.last_run_id?'มีผลเดิมอ้างอิง':'ยังไม่มีผลเดิม ไม่ใช่ยอดศูนย์',next:j.status?'รันตรวจมือได้ทันทีเป็นรายงานแยก · ไม่เปลี่ยนคิวหลัก ยอด หรือเคส':'ยังไม่มีคิวบริษัท/วันที่นี้ กรุณาตรวจการรับไฟล์',blocked:!j.status};
 }
 function noticeHtml(s){const n=runNotice(s);return `<aside class="manual-note" role="status"><strong>${esc(n.title)}</strong><p>สาเหตุ: ${esc(n.reason)}</p><p>ทำต่อ: ${esc(n.next)}</p></aside>`;}
 function preflightHtml(s){
  const p=s?.preflight;if(!p)return '';
  const labels={file_day_mismatch:'วันในชื่อไฟล์ไม่ตรงรอบ',parse_error:'ไฟล์อ่านไม่ผ่าน',files_after_run:'มีไฟล์ใหม่หลังผลเดิม',cross_day_scope:'รายการข้ามวันรอทบทวน',source_held:'รอบนี้พักรันหรือมีไฟล์แก้ไข'};
  const warnings=Array.isArray(p.warnings)?p.warnings:[],queue=Array.isArray(p.cross_day_queue)?p.cross_day_queue:[];
  return `<aside class="manual-note" role="${p.blocked?'alert':'status'}"><strong>${p.blocked?'พักอัตโนมัติเมื่อพบคำเตือน — รอคนตัดสินใจ':'ตรวจคำเตือนก่อนรันแล้ว — รอบปกติทำงานอัตโนมัติได้'}</strong>
   <p>รับและเก็บไฟล์เดิมได้ แต่ไม่ลองรันซ้ำเองเมื่อมีคำเตือน การดูหน้านี้ยังไม่รัน ไม่ยืนยันผลหลัก ไม่ส่งชี้แจง และไม่เปลี่ยนเคส</p>
   ${warnings.length?`<ul>${warnings.map(w=>`<li>${esc(labels[w.code]||w.code)}${w.file_name?' · '+esc(w.file_name):''} · ${esc(w.detail||'')}</li>`).join('')}</ul>`:''}
   ${queue.length?`<details open><summary>คิวข้ามวันรอทบทวน (${queue.length}) — อ่านอย่างเดียว</summary><p>คงวันและสถานะเคสเดิม ไม่รวมเป็นเคสวันที่ใหม่และไม่เปิดเคสซ้ำ หัวหน้าตรวจแถวต้นทางและคิวเดิมก่อนนำไปชี้แจง</p><table><thead><tr><th>เคสเดิม</th><th>วันรายการ / รอบที่อ่านพบ</th><th>บัญชี / ทิศทาง</th><th>ยอดเดิม</th><th>แถวต้นทาง</th></tr></thead><tbody>${queue.map(e=>`<tr><td>${esc(e.code)}</td><td>${esc(e.source_date)} / ${esc(e.report_date)}</td><td>${esc(e.account)} · ${esc(e.direction)}</td><td>${esc(e.amount)}</td><td>${esc(e.source_rows?.bo?.fileId||e.source_rows?.stm?.fileId||'ขาดอ้างอิง')} · แถว ${esc(e.source_rows?.bo?.row??e.source_rows?.stm?.row??'—')}</td></tr>`).join('')}</tbody></table></details>`:''}</aside>`;
 }
 function validateCorrection(b){
  if(!b?.fileId||!b.expectedRevision||!String(b.reason||'').trim()||b.reason.trim().length<10)throw Error('ระบุเหตุผลอย่างน้อย 10 ตัวอักษร');
  if(!/^[A-Z0-9]+$/.test(b.company)||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!kinds.includes(b.kind))throw Error('บริษัท วันที่ หรือประเภทไฟล์ไม่ถูกต้อง');
  if(!String(b.name||'').trim()||/[\\/\x00-\x1f]/.test(b.name))throw Error('ชื่อไฟล์ไม่ถูกต้อง');
  return b;
 }
 function selectionSummary(files,selected){
  const chosen=files.filter(f=>selected.has(f.id)&&!f.excluded),count=kind=>chosen.filter(f=>f.kind===kind).length;
  return `เลือกใช้ตรวจ ${chosen.length} ไฟล์ · BO ${count('bo_main')} · STM ${count('stm_pdf')} · PM ${count('pm_statement')} — ยังไม่รัน`;
 }
 function mount(host,opts){
  let files=[],hold=null,manualOnly=false,runState=null,error='',busy=false,selected=new Set(),selectionLoaded=false,alive=true,reviewing=null,editor=null,upload=null,holdReason='',picker=null,addition=null,initialOpened=false;
  const actor=opts.actor?.(),sameActor=()=>!actor||opts.actor?.()===actor;
  function draw(){
   if(!alive)return;
   if(!sameActor()){host.innerHTML='<p role="alert">ผู้ใช้เปลี่ยน กรุณาเปิดหน้าจัดการไฟล์ใหม่</p>';return;}
   host.innerHTML=`<section class="manual-tools"><div class="manual-scope"><strong>${esc(opts.company)} · ${esc(opts.date)}</strong><span>เลือกไฟล์ → ตรวจซ้ำ → หัวหน้ายืนยันผล</span></div><h3>เลือกไฟล์และจัดการรอบตรวจ</h3>
    <p>เก็บไฟล์ต้นฉบับทุกฉบับ การแก้ข้อมูลเป็นเวอร์ชันใหม่ ไม่แก้ยอดและไม่ปิดเคส</p>
    <details class="file-run-flow"><summary>ขั้นตอนรอบปกติ / รอบที่ต้องรันใหม่</summary><p>รอบปกติ: บอทรับไฟล์ → อ่านและกระทบยอดตามปกติ</p><p>รอบผิดปกติ: เลือก/เพิ่มไฟล์ → ทบทวนและสั่งรันมือ → หัวหน้า/Admin ยืนยันผลหลักและชุดเคส → ดำเนินการ ส่งชี้แจง และปิดเคสตามสิทธิ์และเงื่อนไขเดิม</p><p>การเลือกไฟล์หรือรันมืออย่างเดียวยังไม่เปลี่ยนผลหลัก ไม่สร้างหรือปิดเคส และไม่ย้ายคำอนุมัติจากเคสเก่า</p></details>
    ${noticeHtml(runState)}${preflightHtml(runState)}
    <p role="status">${hold?.paused?'พักรันอยู่ · '+esc(hold.reason):runState?.preflight?.blocked?'พักรันอัตโนมัติจากคำเตือน · ไม่ลองรันซ้ำเอง':'ยังไม่ได้พักรัน'}</p>
    <label>เหตุผลพัก/เปิดงาน <input data-hold-reason maxlength="2000" value="${esc(holdReason)}"></label>
    <button data-hold ${busy||!canManage(opts.role())||(hold?.paused&&manualOnly)?'disabled':''}>${hold?.paused?'เปิดให้รันต่อ':'พักรันบริษัท–วันที่นี้'}</button>
    ${manualOnly?'<p class="manual-note">ไฟล์มีเวอร์ชันแก้ไข: ตรวจมือและยืนยันรายงานแยกได้ แต่ยังล็อกบอทรอบหลักไว้จนตรวจการเชื่อมเคสเดิมครบ เพื่อไม่เปิดเคสซ้ำหรือย้ายประวัติอนุมัติผิดรายการ</p>':''}
    <button data-refresh ${busy?'disabled':''}>โหลดไฟล์/สถานะล่าสุด</button>
    <p role="alert">${esc(error)}</p>
    <div class="manual-actions"><button data-find ${busy?'disabled':''}>ค้นไฟล์จากวัน/บริษัทอื่น</button><button data-add ${busy||!canManage(opts.role())?'disabled':''}>เพิ่มไฟล์จากเครื่อง</button></div>
    <p>ไฟล์ที่หัวข้อวัน/บริษัทผิด ต้องทบทวนและแก้วันอ้างอิงก่อนนำเข้ารอบ ห้ามนำยอดคนละบริษัทมาปนกันโดยไม่ตรวจต้นทาง</p>
    ${picker?pickerHtml():''}${addition?additionHtml():''}
    <p class="manual-scope" data-selection-summary role="status">${esc(selectionSummary(files,selected))}</p>
    <div class="file-run-table-scroll"><table class="file-run-table"><colgroup><col class="use-col"><col class="name-col"><col class="kind-col"><col class="version-col"><col class="actions-col"></colgroup><thead><tr><th>ใช้ตรวจ</th><th>ชื่อไฟล์ / สถานะ</th><th>ประเภท</th><th>เวอร์ชัน</th><th>จัดการ</th></tr></thead><tbody>
     ${files.map(f=>`<tr><td><input type="checkbox" data-select="${esc(f.id)}" aria-label="ใช้ไฟล์ ${esc(f.file_name)}" ${selected.has(f.id)?'checked':''} ${busy||f.excluded||!['bo_main','stm_pdf','pm_statement'].includes(f.kind)?'disabled':''}></td><td>${esc(f.file_name)}<br>${f.excluded?'กักไฟล์ ไม่นำไปกระทบยอด':f.kind==='doc_clarify'?'หลักฐานประกอบ · ไม่เข้ากระทบยอด':f.kind==='unknown'?'รอจัดประเภท · ยังไม่ใช้ตรวจ':f.parsed?'อ่านแล้ว':'ต้องอ่านใหม่'}</td><td>${esc(kindLabel[f.kind]||f.kind)}</td><td>${esc(f.revision)}</td><td><button data-edit="${esc(f.id)}" ${busy||!canManage(opts.role())?'disabled':''}>แก้ข้อมูล / เลือกฉบับแทน</button><button data-history="${esc(f.id)}" ${busy?'disabled':''}>ดูประวัติ</button></td></tr>`).join('')}
    </tbody></table></div>
    <button data-run ${busy||!selected.size||runNotice(runState).blocked?'disabled':''}>ถัดไป: ทบทวนรันมือ (${selected.size} ไฟล์) — ยังไม่รัน</button>
    <p>ผลต้องผ่านการทบทวนและยืนยันจากหัวหน้า/ผู้ดูแลก่อนใช้ ไม่เปิดเคสจากการตรวจเปรียบเทียบ</p>
    <div data-detail>${editor?editorHtml():reviewing||''}</div></section>`;
   host.querySelector('[data-hold-reason]').oninput=e=>{holdReason=e.target.value;};
   host.querySelector('[data-refresh]').onclick=load;
   host.querySelector('[data-find]').onclick=()=>{picker={company:opts.company,date:opts.date,files:[],loaded:false,loading:false,error:''};addition=null;draw();};
   host.querySelector('[data-add]').onclick=()=>{if(!sameActor()||!canManage(opts.role()))return;addition={kind:'pm_statement',reason:'',file:null};picker=null;draw();};
   if(picker)bindPicker();if(addition)bindAddition();
   host.querySelectorAll('[data-select]').forEach(el=>el.onchange=()=>{
    el.checked?selected.add(el.dataset.select):selected.delete(el.dataset.select);
    const run=host.querySelector('[data-run]');run.disabled=busy||!selected.size||runNotice(runState).blocked;run.textContent=`ถัดไป: ทบทวนรันมือ (${selected.size} ไฟล์) — ยังไม่รัน`;
    host.querySelector('[data-selection-summary]').textContent=selectionSummary(files,selected);
   });
   host.querySelector('[data-run]').onclick=async()=>{
    if(!sameActor()||busy||runNotice(runState).blocked)return;
    const warnings=runState?.preflight?.warnings||[];
    if(warnings.length){
     busy=true;draw();
     let confirmed=false;try{confirmed=await opts.confirmRunWarnings?.({company:opts.company,date:opts.date,warnings});}
     finally{busy=false;draw();}
     if(!confirmed||!sameActor())return;
    }
    // This only opens the existing manual-run review. It does not approve a
    // primary result, resume the automatic worker or submit a clarification.
    opts.onRun([...selected]);
   };
   host.querySelector('[data-hold]').onclick=async()=>{
    const reason=host.querySelector('[data-hold-reason]').value.trim();
    if(!sameActor()||!canManage(opts.role()))return;
    if(reason.length<10){error='ระบุเหตุผลอย่างน้อย 10 ตัวอักษร';draw();return;}
    if(!await opts.confirmHold?.({paused:!hold?.paused,reason}))return;
    if(!sameActor()||!canManage(opts.role()))return;
    await action(()=>opts.setHold({company:opts.company,date:opts.date,paused:!hold?.paused,reason,expectedRevision:hold?.revision||0}));
   };
   host.querySelectorAll('[data-history]').forEach(el=>el.onclick=async()=>{
    try{const h=await opts.history(el.dataset.history);editor=null;upload=null;reviewing='<h4>ประวัติไฟล์ — เก็บต้นฉบับครบ</h4>'+(h.length?h.map((r,i)=>`<p>${esc(root.AuditDisplay.dateTime(r.created_at))} · ${esc(r.reason)} · เวอร์ชัน ${esc(r.revision)} · ต้นฉบับ ${esc(r.original?.file_name||r.originalName||'')} ${r.original?.storage_path?`<button data-original="${i}">เปิดไฟล์เดิม</button>`:''}</p>`).join(''):'<p>ยังไม่มีการแก้ไข ไฟล์ต้นฉบับยังอยู่ครบ</p>');draw();host.querySelectorAll('[data-original]').forEach(b=>b.onclick=()=>opts.onFile?.(h[Number(b.dataset.original)].original));}catch(e){error=e.message;draw();}
   });
   host.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>edit(files.find(f=>f.id===el.dataset.edit)));
   if(canManage(opts.role())&&opts.onExclude)host.querySelectorAll('[data-edit]').forEach(el=>{
    const file=files.find(f=>f.id===el.dataset.edit),button=root.document.createElement('button');
    button.type='button';button.textContent=file.excluded?'คืนไฟล์ให้เลือกใช้':'ยกเว้นไฟล์จากการรัน';button.disabled=busy;
    button.dataset.excludeFile=file.id;button.onclick=async()=>{if(!sameActor()||busy||!canManage(opts.role()))return;if(await opts.onExclude(file.id))await load();};
    el.parentElement.appendChild(button);
   });
   if(editor)bindEditor();
  }
  function edit(f,foreign=false){
   if(!sameActor()||!canManage(opts.role()))return;
   editor={fileId:f.id,expectedRevision:f.revision,name:f.file_name,company:foreign?opts.company:f.company,date:foreign?opts.date:f.business_date,kind:f.kind,replacementId:null,excluded:!!f.excluded,reason:'',...(foreign?{originCompany:f.company,originDate:f.business_date}:{})};upload=null;addition=null;draw();
  }
  function pickerHtml(){return `<section class="manual-review"><h4>ค้นไฟล์ในคลัง — อ่านอย่างเดียวจนกดยืนยันแก้ข้อมูล</h4><div class="manual-fields"><label>บริษัทต้นทาง<select data-source-company>${(opts.companies||[opts.company]).map(c=>`<option ${c===picker.company?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>วันที่ต้นทาง<input type="date" data-source-date value="${esc(picker.date)}"></label></div><button data-source-search ${busy||picker.loading?'disabled':''}>ค้นไฟล์ต้นทาง</button><button data-source-close>ปิดการค้นหา</button><p role="status">${esc(picker.error||(!picker.loaded?'เลือกบริษัทและวันที่แล้วค้นหา':picker.files.length?`พบ ${picker.files.length} ไฟล์`:'ไม่พบไฟล์ที่ใช้ตรวจในขอบเขตนี้'))}</p>${picker.files.map((f,i)=>`<article><strong>${esc(f.file_name)}</strong><p>${esc(f.company)} · วันอ้างอิง ${esc(f.business_date)} · ${esc(kindLabel[f.kind])} · เวอร์ชัน ${esc(f.revision)}</p><button data-source-use="${i}" ${busy||f.excluded||!canManage(opts.role())||files.some(x=>x.id===f.id||x.physical_source_file_id===f.physical_source_file_id&&f.physical_source_file_id)?'disabled':''}>ทบทวนนำไฟล์เข้ารอบ ${esc(opts.company)} · ${esc(opts.date)}</button></article>`).join('')}</section>`;}
  function bindPicker(){
   host.querySelector('[data-source-company]').onchange=e=>{picker.company=e.target.value;picker.files=[];picker.loaded=false;draw();};
   host.querySelector('[data-source-date]').onchange=e=>{picker.date=e.target.value;picker.files=[];picker.loaded=false;draw();};
   host.querySelector('[data-source-close]').onclick=()=>{picker=null;draw();};
   host.querySelector('[data-source-search]').onclick=async()=>{if(!sameActor()||busy||picker.loading)return;const search=picker,company=picker.company,date=picker.date;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;search.loading=true;search.error='';draw();try{const found=await opts.searchSources(company,date);if(!alive||!sameActor()||picker!==search||picker.company!==company||picker.date!==date)return;search.files=found.filter(f=>['bo_main','stm_pdf','pm_statement'].includes(f.kind));search.loaded=true;}catch(e){search.error=e.message;}finally{search.loading=false;draw();}};
   host.querySelectorAll('[data-source-use]').forEach(b=>b.onclick=()=>{if(!sameActor()||busy)return;const f=picker.files[Number(b.dataset.sourceUse)];if(f&&!f.excluded)edit(f,true);});
  }
  function additionHtml(){return `<section class="manual-review"><h4>เพิ่มไฟล์จากเครื่อง · ไม่แทนที่ไฟล์เดิมและยังไม่รัน</h4><p>${esc(opts.company)} · ${esc(opts.date)} · เลือกเฉพาะไฟล์ของรอบนี้ ตรวจวันธุรกรรมก่อนยืนยัน</p><div class="manual-fields"><label>ไฟล์ที่จะเพิ่ม<input type="file" data-add-file accept=".xlsx,.xls,.xlsm,.csv,.pdf,.docx"></label><label>ประเภทไฟล์ใหม่<select data-add-kind>${kinds.filter(k=>['bo_main','stm_pdf','pm_statement'].includes(k)).map(k=>`<option value="${k}" ${addition.kind===k?'selected':''}>${esc(kindLabel[k])}</option>`).join('')}</select></label></div>${addition.file?`<p>เลือกไว้ ${esc(addition.file.name)} · ${esc(addition.file.size)} ไบต์</p>`:''}<label>เหตุผลเพิ่มไฟล์<input data-add-reason maxlength="2000" value="${esc(addition.reason)}"></label><p>ตรวจไฟล์ซ้ำก่อนลงทะเบียน เก็บเป็นหลักฐานรับไฟล์ด้วยมือแยกจากอีเมล และพักบอทรอบนี้ให้คนสั่งรันเอง</p><button data-add-save ${busy?'disabled':''}>ทบทวนเพิ่มไฟล์ · ยังไม่รัน</button><button data-add-cancel ${busy?'disabled':''}>ยกเลิกเพิ่มไฟล์</button></section>`;}
  function bindAddition(){
   host.querySelector('[data-add-file]').onchange=e=>{addition.file=e.target.files[0]||null;};
   host.querySelector('[data-add-kind]').onchange=e=>{addition.kind=e.target.value;};
   host.querySelector('[data-add-reason]').oninput=e=>{addition.reason=e.target.value;};
   host.querySelector('[data-add-cancel]').onclick=()=>{addition=null;draw();};
   host.querySelector('[data-add-save]').onclick=async()=>{try{if(!sameActor()||busy||!canManage(opts.role()))return;const b=addition,file=b.file;if(!file||!file.size||file.size>50*1024*1024)throw Error('เลือกไฟล์ที่มีข้อมูลและไม่เกิน 50 MB');if(b.reason.trim().length<10)throw Error('ระบุเหตุผลอย่างน้อย 10 ตัวอักษร');if(!await opts.confirmAddition({company:opts.company,date:opts.date,kind:b.kind,name:file.name,reason:b.reason}))return;if(!sameActor()||!canManage(opts.role())||addition!==b)return;await action(async()=>{const result=await opts.addSource({company:opts.company,date:opts.date,kind:b.kind,reason:b.reason},file);selected.add(result.source_file_id);addition=null;reviewing=result.reused?'<p role="status">ใช้ไฟล์เดิมที่มีอยู่แล้ว ไม่เพิ่มรายการซ้ำ</p>':'<p role="status">เพิ่มไฟล์แล้ว พักบอทรอบนี้ไว้ ยังไม่รันหรือใช้ผลหลัก</p>';});}catch(e){error=e.message;draw();}};
  }
  function editorHtml(){const f=editor;return `<div class="manual-review"><h4>เพิ่มเวอร์ชันไฟล์ · เก็บต้นฉบับไว้</h4>${f.originCompany?`<p class="manual-note">ต้นทาง ${esc(f.originCompany)} · ${esc(f.originDate)} → รอบที่จะใช้ ${esc(opts.company)} · ${esc(opts.date)} ตรวจเนื้อไฟล์และเหตุผลก่อนยืนยัน เก็บรอบเดิมเป็นประวัติและพักบอททั้งสองรอบ ไม่คัดลอกยอดหรือเคส</p>`:''}<div class="manual-fields"><label>ชื่อใหม่ <input data-name value="${esc(f.name)}"></label>
    <label>บริษัท <select data-company>${(opts.companies||[opts.company]).map(c=>`<option value="${esc(c)}" ${c===f.company?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>วันที่ <input type="date" data-date value="${esc(f.date)}"></label>
    <label>ประเภท <select data-kind>${kinds.map(k=>`<option value="${k}" ${f.kind===k?'selected':''}>${esc(kindLabel[k])}</option>`).join('')}</select></label>
    <label>ฉบับแทน <select data-replacement><option value="">ใช้ไฟล์เดิม</option>${files.filter(x=>x.id!==f.fileId&&!x.excluded).map(x=>`<option value="${esc(x.id)}" ${f.replacementId===x.id?'selected':''}>${esc(x.file_name)}</option>`).join('')}</select></label>
    <label>หรืออัปโหลดฉบับแก้ไข <input type="file" data-upload accept=".xlsx,.xls,.xlsm,.csv,.pdf,.docx"></label>
    ${upload?`<p>เลือกฉบับอัปโหลดไว้: ${esc(upload.name)} · ${upload.size} ไบต์</p>`:''}</div><label class="manual-check"><input type="checkbox" data-exclude ${f.excluded?'checked':''}>กักไฟล์นี้ ไม่นำเข้ารัน</label>
    <label>เหตุผล <input data-reason maxlength="2000" value="${esc(f.reason)}"></label><p>บันทึกแล้วพักบอทรอบหลักของวัน/บริษัทที่เกี่ยวข้อง ใช้ตรวจมือและยืนยันรายงานแยกก่อน เพื่อรักษาเคสเดิมและป้องกันเคสซ้ำ</p><button data-save ${busy?'disabled':''}>ทบทวนและบันทึกเวอร์ชันใหม่</button><button data-cancel-edit ${busy?'disabled':''}>ยกเลิกการแก้ไข</button></div>`;}
  function bindEditor(){
   for(const [selector,key] of [['name','name'],['company','company'],['date','date'],['kind','kind'],['replacement','replacementId'],['reason','reason']])host.querySelector('[data-'+selector+']').oninput=e=>{editor[key]=e.target.value||null;};
   host.querySelector('[data-exclude]').onchange=e=>{editor.excluded=e.target.checked;};
   host.querySelector('[data-upload]').onchange=e=>{upload=e.target.files[0]||null;};
   host.querySelector('[data-cancel-edit]').onclick=()=>{editor=null;upload=null;draw();};
   host.querySelector('[data-save]').onclick=async()=>{
    try{
     if(!sameActor()||!canManage(opts.role()))throw Error('เฉพาะหัวหน้า/ผู้ดูแล');
     const b=validateCorrection({...editor,name:editor.name.trim(),company:editor.company.trim().toUpperCase(),reason:String(editor.reason||'').trim()});
     if(upload&&b.replacementId)throw Error('เลือกฉบับแทนจากคลังหรืออัปโหลด อย่างใดอย่างหนึ่ง');
     if(upload&&(!upload.size||upload.size>50*1024*1024))throw Error('ไฟล์ต้องมีข้อมูลและไม่เกิน 50 MB');
     if(!await opts.confirmCorrection(b))return;
     if(!sameActor()||!canManage(opts.role()))return;
     await action(async()=>{await (upload?opts.uploadCorrection(b,upload):opts.correct(b));selected.add(b.fileId);editor=null;upload=null;});
    }catch(e){error=e.message;draw();}
   };
  }
  async function action(fn){busy=true;error='';draw();try{await fn();await load();opts.onUpdated?.();}catch(e){error=e.message;}finally{busy=false;draw();}}
  async function load(){try{const result=await opts.load(opts.company,opts.date);if(!alive||!sameActor())return;runState=result;files=result.files;hold=result.hold;manualOnly=!!result.manualOnly;selected=new Set(files.filter(f=>!f.excluded&&['bo_main','stm_pdf','pm_statement'].includes(f.kind)&&(!selectionLoaded||selected.has(f.id))).map(f=>f.id));selectionLoaded=true;error='';if(opts.initialFileId&&!initialOpened){initialOpened=true;const file=files.find(f=>f.id===opts.initialFileId);if(file)edit(file);}}catch(e){runState=null;error=e.message;}draw();}
  draw();load();return()=>{alive=false;};
 }
 root.FileRunManagement={mount,canManage,validateCorrection,runNotice,noticeHtml,preflightHtml,confirmAction,selectionSummary};if(typeof module!=='undefined')module.exports=root.FileRunManagement;
})(typeof window==='undefined'?globalThis:window);
