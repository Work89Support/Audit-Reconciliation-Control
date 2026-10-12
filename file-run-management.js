(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const canManage=role=>['lead','admin'].includes(role);
 const kinds=['bo_main','stm_pdf','pm_statement','doc_clarify','unknown'];
 const kindLabel={bo_main:'BO หลังบ้าน',stm_pdf:'STM ธนาคาร',pm_statement:'Statement PM',doc_clarify:'หลักฐานประกอบ',unknown:'ยังไม่ระบุประเภท'};
 function validateCorrection(b){
  if(!b?.fileId||!b.expectedRevision||!String(b.reason||'').trim()||b.reason.trim().length<10)throw Error('ระบุเหตุผลอย่างน้อย 10 ตัวอักษร');
  if(!/^[A-Z0-9]+$/.test(b.company)||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!kinds.includes(b.kind))throw Error('บริษัท วันที่ หรือประเภทไฟล์ไม่ถูกต้อง');
  if(!String(b.name||'').trim()||/[\\/\x00-\x1f]/.test(b.name))throw Error('ชื่อไฟล์ไม่ถูกต้อง');
  return b;
 }
 function mount(host,opts){
  let files=[],hold=null,manualOnly=false,error='',busy=false,selected=new Set(),selectionLoaded=false,alive=true,reviewing=null,editor=null,upload=null,holdReason='';
  const actor=opts.actor?.(),sameActor=()=>!actor||opts.actor?.()===actor;
  function draw(){
   if(!alive)return;
   if(!sameActor()){host.innerHTML='<p role="alert">ผู้ใช้เปลี่ยน กรุณาเปิดหน้าจัดการไฟล์ใหม่</p>';return;}
   host.innerHTML=`<section class="manual-tools"><div class="manual-scope"><strong>${esc(opts.company)} · ${esc(opts.date)}</strong><span>เลือกไฟล์ → ตรวจซ้ำ → หัวหน้ายืนยันผล</span></div><h3>เลือกไฟล์และจัดการรอบตรวจ</h3>
    <p>เก็บไฟล์ต้นฉบับทุกฉบับ การแก้ข้อมูลเป็นเวอร์ชันใหม่ ไม่แก้ยอดและไม่ปิดเคส</p>
    <p role="status">${hold?.paused?'พักรันอยู่ · '+esc(hold.reason):'ยังไม่ได้พักรัน'}</p>
    <label>เหตุผลพัก/เปิดงาน <input data-hold-reason maxlength="2000" value="${esc(holdReason)}"></label>
    <button data-hold ${busy||!canManage(opts.role())||(hold?.paused&&manualOnly)?'disabled':''}>${hold?.paused?'เปิดให้รันต่อ':'พักรันบริษัท–วันที่นี้'}</button>
    ${manualOnly?'<p class="manual-note">ไฟล์มีเวอร์ชันแก้ไข: ตรวจมือและยืนยันรายงานแยกได้ แต่ยังล็อกบอทรอบหลักไว้จนตรวจการเชื่อมเคสเดิมครบ เพื่อไม่เปิดเคสซ้ำหรือย้ายประวัติอนุมัติผิดรายการ</p>':''}
    <button data-refresh ${busy?'disabled':''}>โหลดไฟล์/สถานะล่าสุด</button>
    <p role="alert">${esc(error)}</p>
    <table><thead><tr><th>ใช้ตรวจ</th><th>ชื่อไฟล์ / สถานะ</th><th>ประเภท</th><th>เวอร์ชัน</th><th>จัดการ</th></tr></thead><tbody>
     ${files.map(f=>`<tr><td><input type="checkbox" data-select="${esc(f.id)}" aria-label="ใช้ไฟล์ ${esc(f.file_name)}" ${selected.has(f.id)?'checked':''} ${busy||f.excluded||!['bo_main','stm_pdf','pm_statement'].includes(f.kind)?'disabled':''}></td><td>${esc(f.file_name)}<br>${f.excluded?'กักไฟล์ ไม่นำไปกระทบยอด':f.kind==='doc_clarify'?'หลักฐานประกอบ · ไม่เข้ากระทบยอด':f.kind==='unknown'?'รอจัดประเภท · ยังไม่ใช้ตรวจ':f.parsed?'อ่านแล้ว':'ต้องอ่านใหม่'}</td><td>${esc(kindLabel[f.kind]||f.kind)}</td><td>${esc(f.revision)}</td><td><button data-edit="${esc(f.id)}" ${busy||!canManage(opts.role())?'disabled':''}>แก้ข้อมูล / เลือกฉบับแทน</button><button data-history="${esc(f.id)}" ${busy?'disabled':''}>ดูประวัติ</button></td></tr>`).join('')}
    </tbody></table>
    <button data-run ${busy||!selected.size?'disabled':''}>รันด้วยไฟล์ที่เลือก (${selected.size})</button>
    <p>ผลต้องผ่านการทบทวนและยืนยันจากหัวหน้า/ผู้ดูแลก่อนใช้ ไม่เปิดเคสจากการตรวจเปรียบเทียบ</p>
    <div data-detail>${editor?editorHtml():reviewing||''}</div></section>`;
   host.querySelector('[data-hold-reason]').oninput=e=>{holdReason=e.target.value;};
   host.querySelector('[data-refresh]').onclick=load;
   host.querySelectorAll('[data-select]').forEach(el=>el.onchange=()=>{
    el.checked?selected.add(el.dataset.select):selected.delete(el.dataset.select);
    const run=host.querySelector('[data-run]');run.disabled=busy||!selected.size;run.textContent=`รันด้วยไฟล์ที่เลือก (${selected.size})`;
   });
   host.querySelector('[data-run]').onclick=()=>{if(sameActor())opts.onRun([...selected]);};
   host.querySelector('[data-hold]').onclick=async()=>{
    const reason=host.querySelector('[data-hold-reason]').value.trim();
    if(!sameActor()||!canManage(opts.role()))return;
    if(reason.length<10){error='ระบุเหตุผลอย่างน้อย 10 ตัวอักษร';draw();return;}
    if(!await opts.confirmHold?.({paused:!hold?.paused,reason}))return;
    await action(()=>opts.setHold({company:opts.company,date:opts.date,paused:!hold?.paused,reason,expectedRevision:hold?.revision||0}));
   };
   host.querySelectorAll('[data-history]').forEach(el=>el.onclick=async()=>{
    try{const h=await opts.history(el.dataset.history);editor=null;upload=null;reviewing='<h4>ประวัติไฟล์ — เก็บต้นฉบับครบ</h4>'+(h.length?h.map((r,i)=>`<p>${esc(r.created_at)} · ${esc(r.reason)} · เวอร์ชัน ${esc(r.revision)} · ต้นฉบับ ${esc(r.original?.file_name||r.originalName||'')} ${r.original?.storage_path?`<button data-original="${i}">เปิดไฟล์เดิม</button>`:''}</p>`).join(''):'<p>ยังไม่มีการแก้ไข ไฟล์ต้นฉบับยังอยู่ครบ</p>');draw();host.querySelectorAll('[data-original]').forEach(b=>b.onclick=()=>opts.onFile?.(h[Number(b.dataset.original)].original));}catch(e){error=e.message;draw();}
   });
   host.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>edit(files.find(f=>f.id===el.dataset.edit)));
   if(editor)bindEditor();
  }
  function edit(f){
   if(!sameActor()||!canManage(opts.role()))return;
   editor={fileId:f.id,expectedRevision:f.revision,name:f.file_name,company:f.company,date:f.business_date,kind:f.kind,replacementId:null,excluded:!!f.excluded,reason:''};upload=null;draw();
  }
  function editorHtml(){const f=editor;return `<div class="manual-review"><h4>เพิ่มเวอร์ชันไฟล์ · เก็บต้นฉบับไว้</h4><div class="manual-fields"><label>ชื่อใหม่ <input data-name value="${esc(f.name)}"></label>
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
     await action(async()=>{await (upload?opts.uploadCorrection(b,upload):opts.correct(b));editor=null;upload=null;});
    }catch(e){error=e.message;draw();}
   };
  }
  async function action(fn){busy=true;error='';draw();try{await fn();await load();}catch(e){error=e.message;}finally{busy=false;draw();}}
  async function load(){try{const result=await opts.load(opts.company,opts.date);files=result.files;hold=result.hold;manualOnly=!!result.manualOnly;selected=new Set(files.filter(f=>!f.excluded&&['bo_main','stm_pdf','pm_statement'].includes(f.kind)&&(!selectionLoaded||selected.has(f.id))).map(f=>f.id));selectionLoaded=true;error='';}catch(e){error=e.message;}draw();}
  draw();load();return()=>{alive=false;};
 }
 root.FileRunManagement={mount,canManage,validateCorrection};if(typeof module!=='undefined')module.exports=root.FileRunManagement;
})(typeof window==='undefined'?globalThis:window);
