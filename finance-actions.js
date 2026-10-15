(function(root){
 'use strict';
 const types={remediated:'แก้ไขต้นเหตุแล้ว',finance_notified:'แจ้งการเงินแล้ว',recovery_received:'บันทึกติดตามว่าเก็บเงินคืนแล้ว'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function latest(events){const m=new Map();for(const e of events||[]){if(!types[e.action_type]||!['done','reopened'].includes(e.state))throw Error('รูปแบบ Action ไม่ถูกต้อง');const key=e.company+'|'+e.exception_id+'|'+e.action_type;const old=m.get(key);if(!old||Number(e.seq)>Number(old.seq))m.set(key,e);}return [...m.values()];}
 function summary(events){const rows=latest(events);return Object.fromEntries(Object.keys(types).map(k=>[k,rows.filter(r=>r.action_type===k&&r.state==='done').length]));}
 function validate(p,today,incident){
  if(!types[p.p_action]||!['done','reopened'].includes(p.p_state)||!p.p_owner||!/^\d{4}-\d{2}-\d{2}$/.test(p.p_date||'')||p.p_date>today||p.p_date<incident||new Date(p.p_date+'T00:00:00Z').toISOString().slice(0,10)!==p.p_date)throw Error('ระบุขั้นตอน ผู้รับผิดชอบ และวันที่ตั้งแต่วันเกิดเหตุถึงวันนี้');
  if(String(p.p_note||'').trim().length<3||p.p_note.trim().length>4000)throw Error('กรอกรายละเอียด 3–4,000 ตัวอักษร');
  if(!Array.isArray(p.p_files)||p.p_files.length>10||(p.p_state==='done'&&!p.p_files.length))throw Error('ขั้นตอนที่เสร็จต้องมีหลักฐาน 1–10 ไฟล์');
  return p;
 }
 const text=e=>`${types[e.action_type]}: ${e.state==='done'?'บันทึกเสร็จแล้ว':'เปิดติดตามใหม่'} · ${e.action_date} · ผู้รับผิดชอบ ${e.responsible_id} · หลักฐาน ${(e.evidence_ids||[]).length} ไฟล์`;
 async function mount(host,ctx,ref){
  const actor=ctx.actor();let value=null,request=null,busy=false,files=[],disposed=false,dirty=false,discardArmed=false;
  const active=()=>!disposed&&host.isConnected&&ctx.active()&&ctx.actor()===actor;
  host.financeActionDispose=()=>{disposed=true;files=[];value=null;};
  host.financeActionHasDraft=()=>busy||dirty||!!request;
  const notice=t=>{const n=host.querySelector('[data-action-message]');if(n)n.textContent=t;};
  async function openProof(id){if(!active())return;try{await ctx.checkScope();const f=value.files.find(f=>f.id===id);if(!f)throw Error('ไม่พบหลักฐาน');const url=await ctx.url(f.storage_path);if(!active())return;const link=host.querySelector('[data-action-open-link]');link.href=url;link.hidden=false;link.textContent='เปิดหลักฐาน '+f.file_name;notice('ลิงก์ชั่วคราวพร้อมแล้ว กดเปิดหลักฐานด้านล่าง');}catch(e){notice(e.message);}}
  function draw(message=''){
   if(!active())return;
   const current=latest(value.history),proofLabel=id=>value.files.find(f=>f.id===id)?.file_name||'ไฟล์เดิมไม่พร้อมเปิด';
   host.innerHTML=`<section class="panel finance-action-detail"><h2>ติดตาม Action · ${esc(value.company)} ${esc(value.code)}</h2><p>วันเกิดเหตุ ${esc(value.date)} · สถานะเคสเดิม ${esc(value.case_status)} (ไม่เปลี่ยนจากหน้านี้)</p><p class="hint">แยก 3 ขั้นตอน ไม่ถือว่าการแจ้งการเงินคือการเงินรับทราบ และไม่ใช้ Action เก็บเงินคืนแทนยอดรับคืนที่ยืนยันในบัญชี</p><p role="status" data-action-message>${esc(message)}</p><a data-action-open-link hidden target="_blank" rel="noopener noreferrer">เปิดหลักฐาน</a><h3>สถานะติดตามล่าสุด</h3><ul>${Object.keys(types).map(k=>{const e=current.find(e=>e.action_type===k);return `<li>${esc(types[k])}: ${e?`${e.state==='done'?'บันทึกเสร็จแล้ว':'เปิดติดตามใหม่'} · ${esc(e.action_date)} · ${esc(e.responsible_name||e.responsible_id)}`:'ยังไม่มีการบันทึก'}</li>`;}).join('')}</ul>${value.can_write?`<form data-action-form class="fin-action-form"><label>ขั้นตอน<select name="action">${Object.entries(types).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label><label>ผลการติดตาม<select name="state"><option value="done">บันทึกขั้นตอนนี้เสร็จแล้ว</option><option value="reopened">เปิดติดตามใหม่ / แก้ข้อมูลเดิม (เก็บประวัติ)</option></select></label><label>ผู้รับผิดชอบ<select name="owner" required><option value="">เลือกผู้รับผิดชอบ</option>${value.owners.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><label>วันที่ดำเนินการ<input name="date" type="date" min="${esc(value.date)}" max="${esc(ctx.today)}" value="${esc(ctx.today)}" required></label><label>รายละเอียด / เหตุผลแก้ข้อมูล<textarea name="note" minlength="3" maxlength="4000" required></textarea></label><fieldset><legend>เลือกหลักฐาน Action เดิมของเคสนี้ หรือแนบเพิ่ม (ไม่แก้ไฟล์เคส)</legend>${value.files.map(f=>`<label><input type="checkbox" data-action-proof value="${esc(f.id)}">${esc(f.file_name)}</label>`).join('')}<input name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt"><p class="hint">ไม่เกิน 10 ไฟล์ ไฟล์ละ 20 MB · เลือกไฟล์ยังไม่อัปโหลด จะส่งเมื่อกดบันทึก Action เท่านั้น</p></fieldset><label><input name="confirm" type="checkbox" required>ยืนยันข้อมูล Action และหลักฐาน โดยไม่แก้ยอดหรือสถานะเคส</label><button class="primary-button" type="submit">บันทึก Action แยกจากเคส</button><p data-action-retry hidden>คำขออาจบันทึกแล้วแต่ตอบกลับไม่ครบ ให้ลองต่อด้วยคำขอเดิม หรือกดตรวจประวัติก่อนเปลี่ยนข้อมูล</p><button type="button" data-action-check class="ghost-button" hidden>ตรวจประวัติของคำขอเดิม</button></form>`:'<p>สิทธิ์ผู้บริหาร: อ่านเท่านั้น หัวหน้า/Admin ในบริษัทเป็นผู้บันทึก</p>'}<h3>ประวัติย้อนหลัง (ไม่ลบรายการเดิม)</h3><ol>${value.history.map(e=>`<li>${esc(types[e.action_type])} · ${e.state==='done'?'เสร็จ':'เปิดติดตามใหม่'} · ${esc(e.action_date)}<br>รับผิดชอบ ${esc(e.responsible_name||e.responsible_id)} · ผู้บันทึก ${esc(e.actor_name||e.actor_id)} · ${esc(ctx.formatTime(e.created_at))}<p>${esc(e.note)}</p>${(e.evidence_ids||[]).map(id=>`<button class="ghost-button sm" data-action-open="${esc(id)}">${esc(proofLabel(id))}</button>`).join('')}</li>`).join('')||'<li>ยังไม่มีประวัติ Action ไม่ได้สรุปว่าได้ดำเนินการแล้ว</li>'}</ol><button class="ghost-button" data-action-back>กลับรายงานล่าสุด</button></section>`;
   host.querySelectorAll('[data-action-open]').forEach(b=>b.onclick=()=>openProof(b.dataset.actionOpen));
   host.querySelector('[data-action-back]').onclick=()=>{if(busy)return;if((dirty||request)&&!discardArmed){discardArmed=true;notice('ยังมีร่างหรือคำขอที่ต้องตรวจ กดกลับรายงานล่าสุดอีกครั้งเพื่อออกโดยทิ้งร่างในหน้านี้ (ไฟล์/ประวัติที่บันทึกแล้วไม่ถูกลบ)');return;}ctx.back();};
   const form=host.querySelector('[data-action-form]');if(!form)return;
   form.addEventListener('input',()=>{dirty=true;discardArmed=false;});form.addEventListener('change',()=>{dirty=true;discardArmed=false;});
   form.elements.files.onchange=()=>{files=[...form.elements.files.files];};
   form.onsubmit=e=>{e.preventDefault();save(form);};
   host.querySelector('[data-action-check]').onclick=async()=>{if(busy||!request||!active())return;try{await ctx.checkScope();const next=await ctx.read(ref.company,ref.caseId);if(!active())return;if(next.history.some(e=>e.request_id===request.id)){value=next;request=null;files=[];dirty=false;discardArmed=false;ctx.updated(next);draw('พบคำขอเดิมบันทึกสำเร็จแล้ว ไม่บันทึกซ้ำ');}else notice('ยังไม่พบคำขอเดิมที่บันทึกสำเร็จ สามารถลองต่อได้โดยไม่แก้ข้อมูล');}catch(e){notice(e.message);}};
  }
  async function save(form){
   if(busy||!active())return;busy=true;form.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=true);
   try{
    await ctx.checkScope();if(!active())return;
    if(!request){
     if(!form.elements.confirm.checked)throw Error('ต้องยืนยันก่อนบันทึก');
     const selected=[...form.querySelectorAll('[data-action-proof]:checked')].map(e=>e.value),action=form.elements.action.value,previous=latest(value.history).find(e=>e.action_type===action);
     const p={p_company:ref.company,p_case:ref.caseId,p_action:action,p_state:form.elements.state.value,p_owner:form.elements.owner.value,p_date:form.elements.date.value,p_note:form.elements.note.value.trim(),p_files:selected,p_expected:previous?.id||null};
     // Validate before any upload; allow selected new files to satisfy evidence requirement.
     validate({...p,p_files:[...selected,...files.map((_,i)=>'new-'+i)]},ctx.today,value.date);
     request={id:crypto.randomUUID(),payload:p,files:[...files],uploaded:[]};
    }
    for(const f of request.files){if(request.uploaded.some(x=>x.file===f))continue;notice('กำลังเก็บหลักฐาน Action แยก ไม่เปลี่ยนเคส…');const saved=await ctx.upload(ref.company,ref.caseId,f);if(!active())return;request.uploaded.push({file:f,id:saved.id});}
    const p={...request.payload,p_files:[...new Set([...request.payload.p_files,...request.uploaded.map(x=>x.id)])],p_request:request.id};validate(p,ctx.today,value.date);
    notice('กำลังบันทึกทะเบียน Action…');const next=await ctx.save(p);if(!active())return;
    value=next;ctx.updated(next);request=null;files=[];dirty=false;discardArmed=false;draw('บันทึก Action สำเร็จ เก็บประวัติเดิมครบ ไม่เปลี่ยนยอดหรือสถานะเคส');
   }catch(e){if(active()){notice(e.message);const retry=host.querySelector('[data-action-retry]'),check=host.querySelector('[data-action-check]');if(request){retry.hidden=false;check.hidden=false;form.querySelector('button[type=submit]').textContent='ลองต่อด้วยคำขอเดิม';}}}
   finally{busy=false;if(active()){form.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=!!request&&!e.matches('button'));host.querySelectorAll('button').forEach(e=>e.disabled=false);}}
  }
  host.innerHTML='<section class="panel" role="status">กำลังตรวจสิทธิ์และประวัติ Action…</section>';
  try{await ctx.checkScope();value=ref.value||await ctx.read(ref.company,ref.caseId);if(!active())return;if(value.company!==ref.company||value.case_id!==ref.caseId)throw Error('ผลตอบกลับไม่ตรงเคส');draw();}catch(e){if(active())host.innerHTML=`<section class="panel" role="alert">${esc(e.message)}</section>`;}
 }
 root.FinanceActions={types,latest,summary,validate,text,mount};if(typeof module!=='undefined')module.exports=root.FinanceActions;
})(typeof window==='undefined'?globalThis:window);
