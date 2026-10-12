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
     source_checksum:f.checksum||null,parsed:!!f.parsed,parse_error:f.parse_error||null,status:'failed'};
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
  let busy=false,prepared=null,message='',cancel=false,company=opts.company||opts.companies[0],date=opts.date,includeEvidence=false;
  function draw(){
   if(cancel)return;
   host.innerHTML=`<h3>ดาวน์โหลดไฟล์จริงสำหรับกระทบยอดมือ</h3><p>ZIP แยกโฟลเดอร์ STM/PM → BO → หลักฐาน เก็บไบนารีเดิม ไม่แปลงข้อมูล</p><label>บริษัท <select data-company ${busy?'disabled':''}>${opts.companies.map(c=>`<option ${c===company?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>วันที่ <input type="date" data-date value="${esc(date)}" ${busy?'disabled':''}></label><label><input type="checkbox" data-evidence ${includeEvidence?'checked':''} ${busy?'disabled':''}> รวมหลักฐานประกอบและประวัติไฟล์</label><button data-prepare ${busy?'disabled':''}>เตรียม ZIP ไฟล์จริง</button><p role="status">${esc(message)}</p>${prepared?`<p>${prepared.manifest.complete?'ครบตามทะเบียน':'ชุดบางส่วน'} · ได้ ${prepared.manifest.downloaded_files}/${prepared.manifest.expected_files} ไฟล์</p><button data-save ${busy?'disabled':''}>${prepared.manifest.complete?'ดาวน์โหลด ZIP':'ดาวน์โหลดชุดบางส่วนพร้อมรายการไฟล์ที่ขาด'}</button>`:''}<p>ไม่รันบอท ไม่แก้ยอด ไม่เปิดหรือปิดเคส หากระบบคลังล่มต้องใช้ชุดที่ดาวน์โหลดไว้ก่อนแล้ว</p>`;
   host.querySelector('[data-company]').onchange=e=>{company=e.target.value;prepared=null;message='';draw();};
   host.querySelector('[data-date]').onchange=e=>{date=e.target.value;prepared=null;message='';draw();};
   host.querySelector('[data-evidence]').onchange=e=>{includeEvidence=e.target.checked;prepared=null;message='';draw();};
   host.querySelector('[data-prepare]').onclick=async()=>{
    busy=true;prepared=null;message='กำลังตรวจสิทธิ์และอ่านไฟล์จริง…';draw();
    try{prepared=await prepare({...opts,company,date,includeEvidence,cancelled:()=>cancel,progress:(n,total)=>{message=`อ่านไฟล์ ${n}/${total}`;const status=host.querySelector('[role=status]');if(status)status.textContent=message;}});message=prepared.manifest.complete?'ตรวจขนาดและ SHA-256 แล้ว':'มีไฟล์ขาด/อ่านไม่ได้ ต้องดูรายการก่อนใช้';}
    catch(e){message=e.message;}finally{busy=false;draw();}
   };
   const save=host.querySelector('[data-save]');if(save)save.onclick=async()=>{
    const result=prepared;busy=true;draw();
    try{await result.revalidate();if(cancel||opts.actorId()!==opts.initialActor)throw Error('สิทธิ์เปลี่ยน ห้ามดาวน์โหลด');opts.save(opts.zip(result.entries),result.filename);message='ดาวน์โหลดแล้ว ไม่มีผลหรือเคสจริงถูกเปลี่ยน';}
    catch(e){message=e.message;}finally{prepared=null;busy=false;draw();}
   };
  }
  draw();return()=>{cancel=true;prepared=null;host.innerHTML='';};
 }
 root.AuditSourceArchive={prepare,mount,scopeAllowed,safeName,folder,MAX_BYTES};if(typeof module!=='undefined')module.exports=root.AuditSourceArchive;
})(typeof window==='undefined'?globalThis:window);
