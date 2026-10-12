(function(root){
 'use strict';
 const MAX_BYTES=200*1024*1024,MAX_FILES=500;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeName=n=>String(n||'unnamed').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/^\.+/,'_').replace(/[. ]+$/,'').slice(0,120)||'unnamed';
 const folder=f=>f.origin==='source_history'?'05_HISTORY':['stm_pdf','pm_statement'].includes(f.kind)?'01_STM_PM':f.kind==='bo_main'?'02_BO':f.kind==='doc_clarify'||f.origin==='case_evidence'?'03_EVIDENCE':'04_OTHER';
 const scopeAllowed=(access,company)=>access?.active&&['monitor','audit_assistant','lead','admin'].includes(access.role)
  &&(['lead','admin'].includes(access.role)||access.companies?.some(c=>c==='*'||String(c).toUpperCase()===company));
 async function prepare({company,date,includeEvidence=false,catalog,download,access,actorId,validate,progress=()=>{},cancelled=()=>false,sha256}){
  if(!/^[A-Z0-9]+$/.test(company)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('เลือกบริษัทและวันที่ให้ครบ');
  const actor=actorId();if(!actor)throw Error('ต้องเข้าสู่ระบบ');
  async function guard(){if(cancelled())throw Error('ยกเลิกการจัดชุดไฟล์');if(actorId()!==actor||!scopeAllowed(await access(),company))throw Error('สิทธิ์หรือบัญชีเปลี่ยน หยุดดาวน์โหลดทันที');}
  await guard();const data=await catalog(company,date,includeEvidence);
  if(data.company!==company||data.business_date!==date||!Array.isArray(data.files))throw Error('คลังไฟล์คืนข้อมูลผิดขอบเขต');
  if(!data.files.length)throw Error('ไม่พบไฟล์จริงในวันที่เลือก ไม่สร้าง ZIP ว่างแทนข้อมูล');
  if(data.files.length>MAX_FILES)throw Error('เกิน 500 ไฟล์ กรุณาแยกชุดหรือไม่รวมหลักฐาน');
  if(data.files.reduce((n,f)=>n+Number(f.size_bytes||0),0)>MAX_BYTES)throw Error('เกิน 200 MB กรุณาแยกชุดหรือไม่รวมหลักฐาน');
  const entries=[],records=[],names=new Set(),hashes=new Map();let bytes=0;
  for(const f of data.files){
   await guard();
   if(!f.id||f.company!==company)throw Error('ทะเบียนไฟล์มีรายการนอกบริษัทหรือข้อมูลไม่ครบ');
   const path=`${company}/${date}/${folder(f)}/${safeName(f.id)}_${safeName(f.file_name)}`;
   if(names.has(path))throw Error('ทะเบียนไฟล์มีรหัส/ชื่อซ้ำ ต้องตรวจคลังก่อน');names.add(path);
   const r={id:f.id,origin:f.origin,original_name:f.file_name,kind:f.kind,source_date:f.source_date,path,
     source_checksum:f.checksum||null,expected_size_bytes:f.size_bytes??null,registered_size_bytes:f.registered_size_bytes??null,
     object_version:f.object_version??null,object_etag:f.object_etag??null,parsed:!!f.parsed,parse_error:f.parse_error||null,status:'failed'};
   if(f.registered_size_bytes!=null&&f.size_bytes!=null&&Number(f.registered_size_bytes)!==Number(f.size_bytes))r.size_warning='ขนาดทะเบียนเดิมต่างจาก Storage ใช้ขนาด Storage ตรวจไฟล์โดยไม่แก้ทะเบียน';
   if(!f.storage_path){r.error='ไม่มีเส้นทางไฟล์ต้นฉบับในคลัง';records.push(r);progress(records.length,data.files.length);continue;}
   if(!await validate(company,date,includeEvidence,[f]))throw Error('ข้อมูลหรือสิทธิ์ไฟล์เปลี่ยน ต้องโหลดทะเบียนใหม่');
   let buffer;
   try{buffer=await download(f.storage_path);}
   catch(e){r.error='ดาวน์โหลดไฟล์ไม่ได้ กรุณาตรวจคลังหรือสิทธิ์ไฟล์';records.push(r);progress(records.length,data.files.length);continue;}
   await guard();if(!(buffer instanceof ArrayBuffer)&&!(buffer instanceof Uint8Array))throw Error('คลังไฟล์ไม่คืนข้อมูลไบนารี');const raw=new Uint8Array(buffer);bytes+=raw.byteLength;
   if(bytes>MAX_BYTES)throw Error('ขนาดจริงเกิน 200 MB หยุดสร้างชุดไฟล์');
   r.size_bytes=raw.byteLength;r.sha256=await sha256(raw);
   if(f.size_bytes!=null&&Number(f.size_bytes)!==raw.byteLength){r.error='ขนาดไฟล์ไม่ตรงทะเบียน';}
   else if(/^[0-9a-f]{64}$/i.test(f.checksum||'')&&f.checksum.toLowerCase()!==r.sha256){r.error='SHA-256 ไม่ตรงต้นฉบับในคลัง';}
   else{r.status='downloaded';if(hashes.has(r.sha256))r.duplicate_of=hashes.get(r.sha256);else hashes.set(r.sha256,r.id);entries.push({name:path,data:raw});}
   records.push(r);progress(records.length,data.files.length);
  }
  await guard();const complete=records.every(f=>f.status==='downloaded');
  const manifest={version:1,company,business_date:date,include_evidence:!!includeEvidence,created_at:new Date().toISOString(),
    complete,expected_files:records.length,downloaded_files:entries.length,failed_files:records.filter(f=>f.status!=='downloaded').length,
    files:records,run_id:data.run_id||null,job_status:data.job_status||null,
    note:'ครบหมายถึงดาวน์โหลดครบตามทะเบียนที่ระบบคืนมา ไม่ยืนยันว่าได้รับไฟล์ครบทุกบัญชี สำเนานี้ไม่ใช่ผลกระทบยอดใหม่ ไม่แก้ยอด ไม่อนุมัติหรือปิดเคส'};
  const prefix=`${company}/${date}/`,enc=new TextEncoder();
  entries.push({name:prefix+'manifest.json',data:enc.encode(JSON.stringify(manifest,null,2))});
  entries.push({name:prefix+'รายการไฟล์.html',data:enc.encode(`<!doctype html><html lang="th"><meta charset="utf-8"><title>รายการไฟล์ต้นฉบับ</title><style>body{font:16px Arial;margin:30px}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}code{word-break:break-all}</style><h1>${esc(company)} ${esc(date)} — ${complete?'ดาวน์โหลดครบ':'ชุดบางส่วน ห้ามถือว่าข้อมูลครบ'}</h1><p>ได้ ${manifest.downloaded_files}/${manifest.expected_files} ไฟล์ · ขาด ${manifest.failed_files} ไฟล์</p><table><tr><th>ชื่อเดิม</th><th>โฟลเดอร์</th><th>สถานะ</th><th>SHA-256 / ข้อผิดพลาด</th></tr>${records.map(f=>`<tr><td>${esc(f.original_name)}</td><td>${esc(f.path)}</td><td>${esc(f.status)}</td><td><code>${esc(f.error||f.sha256)}</code></td></tr>`).join('')}</table><p>${esc(manifest.note)}</p></html>`)});
  entries.push({name:prefix+'อ่านก่อนทำงานมือ.txt',data:enc.encode('แตก ZIP ก่อนใช้งาน\n01_STM_PM = ต้นฉบับธนาคาร/PM\n02_BO = ต้นฉบับหลังบ้าน\n03_EVIDENCE = หลักฐานประกอบ ไม่เอาไปนับยอด\n04_OTHER = ไฟล์อื่นที่ต้องตรวจประเภทก่อนใช้\n05_HISTORY = รุ่นเดิมเพื่ออ้างอิง ไม่เอามานับยอดซ้ำกับรุ่นปัจจุบัน\nไฟล์ที่ duplicate_of ระบุใน manifest มีเนื้อหาเหมือนกัน ต้องตรวจต้นทางก่อนนับซ้ำ\nไฟล์ที่เข้ารหัสยังคงเข้ารหัส ใช้รหัสจากผู้ส่งเดิม\nตรวจวันที่และรายการไฟล์ก่อนทำงาน สำเนาต้นฉบับเก็บไว้ แยกไฟล์ทำงานอีกชุด\nเรียงการตรวจ STM → BO → ผลเทียบ และอย่ายุบยอดเท่ากันที่คนละเวลา\nถ้า manifest ระบุ complete=false ต้องตามไฟล์ที่ขาด ห้ามถือว่าเป็นยอดศูนย์\nการทำงานมือนี้ไม่เปลี่ยนผลหรือเคสในระบบ และไม่ใช่ชุดสำรองทั้งฐานข้อมูล\nไฟล์มีข้อมูลส่วนบุคคล/การเงิน เก็บในพื้นที่บริษัทที่จำกัดสิทธิ์ ไม่ส่งต่อโดยไม่ได้รับอนุญาต\nถ้าคลังไฟล์ล่มจะดาวน์โหลดไม่ได้ ควรเก็บชุดล่าสุดไว้ล่วงหน้า\n')});
  const revalidate=async()=>{await guard();if(!await validate(company,date,includeEvidence,data.files.filter(f=>records.some(r=>r.id===f.id&&r.status==='downloaded'))))throw Error('คลังไฟล์หรือสิทธิ์เปลี่ยน กรุณาเตรียม ZIP ใหม่');};
  await revalidate();return {entries,manifest,revalidate,filename:`Audit_Sources_${company}_${date}${complete?'':'_PARTIAL'}.zip`};
 }
 function mount(host,opts){
  let busy=false,prepared=null,receipt=null,message='',cancel=false,readDone=0,readTotal=0,company=opts.company||opts.companies[0],date=opts.date,includeEvidence=false;
  const folderNames={'01_STM_PM':'STM / PM','02_BO':'BO หลังบ้าน','03_EVIDENCE':'หลักฐานประกอบ','04_OTHER':'ไฟล์อื่น ๆ','05_HISTORY':'ประวัติไฟล์เดิม'};
  function draw(focusSelector){
   if(cancel)return;
   const summary=prepared?.manifest||receipt?.manifest,step=receipt||prepared?3:busy?2:1;
   const counts={};for(const f of summary?.files||[]){const k=f.path.split('/')[2];counts[k]??={ok:0,all:0};counts[k].all++;if(f.status==='downloaded')counts[k].ok++;}
   host.setAttribute('aria-busy',String(busy));
   host.innerHTML=`<section class="source-archive">
    <div class="sa-intro"><span class="sa-tag">สำเนาต้นฉบับ · ไม่รันบอท</span><h3>เก็บไฟล์ไว้ทำกระทบยอดมือ</h3>${summary?'':'<p>เลือกบริษัทและวันที่ แล้วดาวน์โหลดครั้งเดียวเป็น ZIP แตกไฟล์แล้วจะได้โฟลเดอร์แยกพร้อมใช้งาน</p>'}</div>
    <ol class="sa-steps" aria-label="ขั้นตอนดาวน์โหลด">${['เลือกข้อมูล','ตรวจไฟล์','ดาวน์โหลด'].map((t,i)=>`<li class="${step===i+1?'is-current':step>i+1?'is-done':''}" ${step===i+1?'aria-current="step"':''}><span>${i+1}</span>${t}</li>`).join('')}</ol>
    ${summary?`<details class="sa-selection"><summary><strong>${esc(company)} · ${esc(date?.split('-').reverse().join('/'))}</strong><span>เปลี่ยนบริษัท / วัน / หลักฐาน</span></summary>`:''}
    <div class="sa-fields"><label>บริษัท<select data-company ${busy?'disabled':''}>${opts.companies.map(c=>`<option ${c===company?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>วันที่กระทบยอด<input type="date" data-date value="${esc(date)}" ${busy?'disabled':''}></label></div>
    <label class="sa-option"><input type="checkbox" data-evidence ${includeEvidence?'checked':''} ${busy?'disabled':''}><span><strong>รวมหลักฐานประกอบและประวัติไฟล์</strong><small>แยกโฟลเดอร์ไว้ให้ ไม่เอาหลักฐานหรือไฟล์รุ่นเดิมไปนับยอดซ้ำ</small></span></label>
    ${summary?'</details>':''}
    <button class="sa-prepare ${summary?'sa-recheck':''}" data-prepare ${busy||!date||!company?'disabled':''}>${busy?'กำลังตรวจไฟล์…':prepared||receipt?'ตรวจไฟล์ใหม่':'ตรวจไฟล์ก่อนดาวน์โหลด'}</button>
    <div class="sa-status" role="status" aria-live="polite"><span data-progress-text>${esc(message)}</span>${busy?`<progress data-progress max="${Math.max(1,readTotal)}" value="${readDone}" aria-label="ความคืบหน้าการอ่านไฟล์"></progress>`:''}</div>
    ${summary?`<div class="sa-result ${summary.complete?'is-complete':'is-partial'}"><strong>${receipt?'ดาวน์โหลดแล้ว':summary.complete?'พร้อมดาวน์โหลด':'ไฟล์ยังไม่ครบ'}</strong><b>${summary.downloaded_files} / ${summary.expected_files} ไฟล์</b><span>${summary.complete?'ครบตามทะเบียนไฟล์ที่ระบบพบ':'ขาดหรืออ่านไม่ได้ '+summary.failed_files+' ไฟล์ · ห้ามถือว่าเป็นยอดศูนย์'}</span></div>
    <div class="sa-folders">${Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).map(([k,n])=>`<div><strong>${esc(folderNames[k]||k)}</strong><b>${n.ok} / ${n.all} ไฟล์</b></div>`).join('')}</div>
    ${prepared?`<button class="sa-download ${summary.complete?'':'is-partial'}" data-save ${busy?'disabled':''}>${summary.complete?'ดาวน์โหลด ZIP ทั้งชุด':'ดาวน์โหลดเฉพาะไฟล์ที่ได้ (ยังไม่ครบ)'}</button><p class="sa-after">หลังดาวน์โหลด: แตก ZIP → เก็บชุดต้นฉบับ → ทำงานบนสำเนาอีกชุด</p>`:`<p class="sa-after">ไฟล์: <strong>${esc(receipt.filename)}</strong><br>เปิดโฟลเดอร์ Downloads แล้วแตก ZIP ก่อนใช้งาน</p>`}
    ${summary.failed_files?`<div class="sa-missing"><strong>ไฟล์ที่ต้องตามเพิ่มเติม</strong><ul>${summary.files.filter(f=>f.status!=='downloaded').map(f=>`<li>${esc(f.original_name)}<small>${esc(f.error)}</small></li>`).join('')}</ul></div>`:''}
    <details class="sa-details"><summary>ดูรายชื่อไฟล์และรายละเอียดการตรวจ</summary><p>เก็บผลตรวจขนาดและลายนิ้วมือไฟล์ไว้ใน manifest.json หากขนาดทะเบียนเดิมต่างจาก Storage จะมีคำเตือน แต่ไม่แก้ทะเบียน</p><div class="sa-file-list">${summary.files.map(f=>`<div><span>${esc(f.original_name)}</span><strong>${f.status==='downloaded'?'ได้ไฟล์แล้ว':'ต้องตามไฟล์'}</strong>${f.size_warning?`<small>${esc(f.size_warning)}</small>`:''}</div>`).join('')}</div></details>`:''}
    <p class="sa-safety">ไม่เปลี่ยนยอด ผลกระทบยอด หรือเคสในระบบ · ถ้าคลังไฟล์ล่ม ต้องใช้ชุดที่ดาวน์โหลดเก็บไว้ก่อนแล้ว</p>
   </section>`;
   const reset=()=>{prepared=null;receipt=null;message='';};
   host.querySelector('[data-company]').onchange=e=>{company=e.target.value;reset();draw('[data-company]');};
   host.querySelector('[data-date]').onchange=e=>{date=e.target.value;reset();draw('[data-date]');};
   host.querySelector('[data-evidence]').onchange=e=>{includeEvidence=e.target.checked;reset();draw('[data-evidence]');};
   host.querySelector('[data-prepare]').onclick=async()=>{
    busy=true;prepared=null;receipt=null;readDone=0;readTotal=0;message='กำลังตรวจสิทธิ์และอ่านไฟล์ต้นฉบับ กรุณารอสักครู่';draw();
    try{prepared=await prepare({...opts,company,date,includeEvidence,cancelled:()=>cancel,progress:(n,total)=>{readDone=n;readTotal=total;message=`ตรวจไฟล์ ${n} จาก ${total} ไฟล์`;const status=host.querySelector('[data-progress-text]'),bar=host.querySelector('[data-progress]');if(status)status.textContent=message;if(bar){bar.max=total;bar.value=n;}}});message=prepared.manifest.complete?'ตรวจไฟล์เรียบร้อยแล้ว เลือกดาวน์โหลดทั้งชุดด้านล่างได้เลย':'ดูรายการไฟล์ที่ขาดด้านล่างก่อนใช้ข้อมูล';}
    catch(e){message=e.message;}finally{busy=false;draw();}
   };
   const save=host.querySelector('[data-save]');if(save)save.onclick=async()=>{
    const result=prepared;busy=true;draw();
    try{await result.revalidate();if(cancel||opts.actorId()!==opts.initialActor)throw Error('สิทธิ์เปลี่ยน ห้ามดาวน์โหลด');opts.save(opts.zip(result.entries),result.filename);receipt={manifest:result.manifest,filename:result.filename};message='ดาวน์โหลดสำเร็จ ไม่เปลี่ยนยอดหรือเคสในระบบ';}
    catch(e){message=e.message;}finally{prepared=null;busy=false;draw();}
   };
   if(focusSelector)host.querySelector(focusSelector)?.focus();
  }
  draw();return()=>{cancel=true;prepared=null;receipt=null;host.innerHTML='';};
 }
 root.AuditSourceArchive={prepare,mount,scopeAllowed,safeName,folder,MAX_BYTES};if(typeof module!=='undefined')module.exports=root.AuditSourceArchive;
})(typeof window==='undefined'?globalThis:window);
