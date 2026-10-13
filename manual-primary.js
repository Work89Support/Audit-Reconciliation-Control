(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const allowed=role=>['lead','admin'].includes(role);
 function html(p){const a=p.after||{},b=p.before||{},keys=[['stm_count','STM / PM'],['bo_count','BO'],['matched','จับคู่'],['exception_count','ต้องตรวจ']];return `<header><div><small>ผลหลักเวอร์ชันใหม่ · เก็บผลเดิมและเคสเดิม</small><h2 id="primaryTitle">ทบทวนใช้ผลตรวจมือเป็นผลหลัก</h2></div><button data-cancel aria-label="ปิด">✕</button></header><div class="manual-final-content"><p class="manual-final-scope"><strong>${esc(p.company)}</strong> · ${esc(p.date)} · ${esc(p.account)} · ${esc(p.direction)}</p><p>ตรวจไฟล์ล่าสุด ${esc(p.file_count)} ไฟล์ · ทุกบัญชีและฝาก–ถอนครบเท่านั้น</p><table class="primary-comparison"><thead><tr><th>รายการ</th><th>ผลหลักเดิม</th><th>ผลตรวจมือใหม่</th></tr></thead><tbody>${keys.map(([k,t])=>`<tr><th>${t}</th><td>${esc(b[k]??'—')}</td><td>${esc(a[k]??'—')}</td></tr>`).join('')}</tbody></table>${!p.allowed?`<div role="alert" class="manual-final-safety"><b>ยังใช้เป็นผลหลักไม่ได้</b><ul>${(p.problems||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}<p class="manual-final-safety">เว็บและ Excel ใช้รายงานเวอร์ชันเดียวกัน ไม่เขียนทับยอดต้นฉบับ ไม่เปิด/ปิดเคส ไม่คัดลอกการอนุมัติ และไม่ปลดพักบอท ผลเดิมและประวัติเคสยังอยู่ครบ</p><label class="manual-reason-label">เหตุผลใช้เป็นผลหลัก<select data-reason><option value="">เลือกเหตุผล…</option>${(root.AccountRecheck?.confirmationReasons||[]).map(([k,t])=>`<option value="${k}">${esc(t)}</option>`).join('')}<option value="other">อื่น ๆ — ระบุเหตุผล</option></select></label><textarea data-other hidden rows="3" maxlength="2000" placeholder="เหตุผลอย่างน้อย 10 ตัวอักษร"></textarea><label class="manual-check"><input data-reviewed type="checkbox" ${!p.allowed?'disabled':''}> ฉันทบทวนไฟล์ล่าสุด ขอบเขต และผลทั้งหมดแล้ว</label><p data-error role="alert"></p></div><footer><button data-cancel>กลับไปทบทวน</button><button class="primary" data-next disabled>ทบทวนและยืนยันขั้นสุดท้าย</button></footer>`;}
 async function open(id,opts){
  const actor=opts.actor(),same=()=>opts.actor()===actor&&allowed(opts.role());
  if(!same())throw Error('เฉพาะหัวหน้า/ผู้ดูแล');
  const p=await opts.preview(id);if(!same())throw Error('ผู้ใช้หรือสิทธิ์เปลี่ยน');
  const d=root.document.createElement('dialog');d.className='manual-final-dialog primary-result-dialog';d.setAttribute('aria-labelledby','primaryTitle');d.innerHTML=html(p);root.document.body.appendChild(d);
  const close=()=>{d.close();d.remove();};d.querySelectorAll('[data-cancel]').forEach(x=>x.onclick=close);d.addEventListener('cancel',e=>{e.preventDefault();close();});
  const reason=()=>root.AccountRecheck.confirmationReason(d.querySelector('[data-reason]').value,d.querySelector('[data-other]').value);
  let busy=false;const enable=()=>{d.querySelector('[data-next]').disabled=busy||!same()||!p.allowed||!!p.already_applied||!d.querySelector('[data-reviewed]').checked||reason().length<10;};
  d.querySelector('[data-reason]').onchange=e=>{d.querySelector('[data-other]').hidden=e.target.value!=='other';enable();};d.querySelector('[data-other]').oninput=enable;d.querySelector('[data-reviewed]').onchange=enable;
  d.querySelector('[data-next]').onclick=async()=>{
   if(busy||!same()||!p.allowed||!d.querySelector('[data-reviewed]').checked||reason().length<10)return;
   busy=true;enable();try{
    const latest=await opts.preview(id);if(!same()||!latest.allowed||latest.token!==p.token)throw Error('ไฟล์ ผลหลัก หรือขอบเขตเปลี่ยน ต้องเปิดทบทวนใหม่');
    const note=reason();d.querySelector('[data-next]').textContent='ยืนยันใช้เป็นผลหลัก';
    const final=root.document.createElement('dialog');final.className='manual-final-dialog';final.innerHTML=`<header><h2>ยืนยันขั้นสุดท้าย</h2></header><div class="manual-final-content"><p>${esc(p.company)} · ${esc(p.date)}</p><p>${esc(note)}</p><p>จะเปลี่ยนรายงานหลักที่เว็บและ Excel ใช้เท่านั้น เก็บผลเดิม ไม่แก้ยอดหรือเปิด/ปิดเคส</p></div><footer><button data-back>ยกเลิก</button><button data-accept class="primary">ยืนยันใช้ผลตรวจมือเป็นผลหลัก</button></footer>`;root.document.body.appendChild(final);
    const accepted=await new Promise(resolve=>{const finish=v=>{final.close();final.remove();resolve(v);};final.querySelector('[data-back]').onclick=()=>finish(false);final.querySelector('[data-accept]').onclick=()=>finish(true);final.addEventListener('cancel',e=>{e.preventDefault();finish(false);});final.showModal();});
    if(!accepted)return;if(!same())throw Error('ผู้ใช้หรือสิทธิ์เปลี่ยน');
    await opts.accept({p_id:id,p_token:p.token,p_reason:note,p_reviewed:true});close();opts.onAccepted?.();
   }catch(e){d.querySelector('[data-error]').textContent=e.message;}finally{busy=false;if(d.isConnected)enable();}
  };d.showModal();enable();return d;
 }
 function run(v){const r=v.report;return {id:v.base_run_id,company:v.company,business_date:v.business_date,stm_count:r.stm_count,bo_count:r.bo_count,matched:r.matched,exception_count:(r.exceptions?.length||0)+(r.summary?.waiting_bo?.length||0),summary:{...r.summary,match_evidence:r.match_evidence||[],manual_primary:{id:v.id,recheck_id:v.recheck_id,accepted_at:v.accepted_at,reason:v.reason}},primaryResult:v,jobStatus:'completed',boWaitingSnapshot:null};}
 function cases(v){return (v.report.exceptions||[]).map((e,i)=>({...e,id:null,code:`ผลตรวจมือ ${i+1}`,company:v.company,business_date:v.business_date,status:'open',resolution_note:null,resolved_by:null,primaryRowKey:`primary-${v.id}-${i}`}));}
 function sheets(v){return [{name:'เวอร์ชันผลหลัก',title:'ผลตรวจมือที่ใช้เป็นผลหลัก · ประวัติเคสไม่เปลี่ยน',headers:['บริษัท','วันที่','เวอร์ชันผลหลัก','รายงานตรวจมือ','ผลรอบเดิม','ผู้ยืนยัน','ยืนยันเมื่อ','เหตุผล'],rows:[[v.company,v.business_date,v.id,v.recheck_id,v.base_run_id||'',v.accepted_by,v.accepted_at,v.reason]],widths:[14,14,42,42,42,42,26,60]}];}
 root.ManualPrimary={allowed,html,open,run,cases,sheets};if(typeof module!=='undefined')module.exports=root.ManualPrimary;
})(typeof window==='undefined'?globalThis:window);
