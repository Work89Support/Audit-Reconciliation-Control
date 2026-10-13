/* Explicit new-case-set workflow. Never reopens/closes history or edits amounts. */
(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function open(id,opts){
  const actor=opts.actor(),allowed=()=>actor===opts.actor()&&['lead','admin'].includes(opts.role());
  if(!allowed())throw Error('เฉพาะหัวหน้า/ผู้ดูแล');
  const p=await opts.preview(id);if(!allowed())throw Error('สิทธิ์ผู้ใช้เปลี่ยน');
  const d=root.document.createElement('dialog');d.className='manual-final-dialog primary-result-dialog';
  d.innerHTML=`<header><h2>ใช้เคสชุดใหม่จากผลหลักล่าสุด</h2><button data-cancel aria-label="ปิด">✕</button></header><div class="manual-final-content"><p><b>${esc(p.company)} · ${esc(p.date)}</b></p><p>สร้างเคสใหม่ ${esc(p.case_count)} เคส · เก็บเคสเดิม ${esc(p.history_count)} เคสเป็นประวัติ</p><p>เคสเดิมและหลักฐานคงอยู่ ไม่ปิดหรือแก้สถานะ ไม่คัดลอกหลักฐาน/การอนุมัติไปเคสใหม่ และไม่นับชุดเดิมซ้ำในงานปัจจุบัน</p><p>ยอดต้นฉบับและผลกระทบยอดไม่เปลี่ยน · กดซ้ำไม่สร้างเคสเพิ่ม</p><label>เหตุผล<textarea data-reason rows="3" maxlength="2000">ใช้ผลตรวจมือล่าสุดเป็นผลหลักและสร้างเคสชุดใหม่ โดยเก็บเคสเดิมพร้อมหลักฐานเป็นประวัติ</textarea></label><label class="manual-check"><input type="checkbox" data-reviewed> ฉันทบทวนไฟล์ล่าสุด ผลหลัก และเคสที่จะสร้างครบแล้ว</label><p data-error role="alert"></p></div><footer><button data-cancel>ยกเลิก</button><button data-confirm class="primary" disabled>ยืนยันสร้างเคสชุดใหม่ ${esc(p.case_count)} เคส</button></footer>`;
  let busy=false;const close=()=>{d.close();d.remove();};d.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{if(!busy)close();});d.addEventListener('cancel',e=>{e.preventDefault();if(!busy)close();});
  const enable=()=>{d.querySelectorAll('[data-cancel]').forEach(b=>b.disabled=busy);d.querySelector('[data-confirm]').disabled=busy||!allowed()||p.already_created||!d.querySelector('[data-reviewed]').checked||d.querySelector('[data-reason]').value.trim().length<10;};
  d.querySelector('[data-reviewed]').onchange=enable;d.querySelector('[data-reason]').oninput=enable;
  d.querySelector('[data-confirm]').onclick=async()=>{if(d.querySelector('[data-confirm]').disabled)return;busy=true;enable();try{const latest=await opts.preview(id);if(!allowed()||latest.token!==p.token)throw Error('ไฟล์หรือผลหลักเปลี่ยน ต้องทบทวนใหม่');const result=await opts.activate({p_id:id,p_token:p.token,p_reason:d.querySelector('[data-reason]').value.trim(),p_reviewed:true});close();opts.onActivated?.(result);}catch(e){d.querySelector('[data-error]').textContent=e.message;}finally{busy=false;if(d.isConnected)enable();}};
  root.document.body.appendChild(d);d.showModal();enable();return d;
 }
 root.PrimaryCaseSets={open};if(typeof module!=='undefined')module.exports=root.PrimaryCaseSets;
})(typeof window==='undefined'?globalThis:window);
