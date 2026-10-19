(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const canManage=role=>['lead','admin'].includes(role);
 function validate(v,reason){if(!v||v.blocked)throw Error(v?.message||'ยังตรวจไฟล์ไม่สำเร็จ');if(!v.id||!Number.isInteger(v.revision))throw Error('ขาดเวอร์ชันไฟล์ กรุณาโหลดใหม่');if(String(reason||'').trim().length<10)throw Error('ระบุเหตุผลอย่างน้อย 10 ตัวอักษร');}
 function open(opts){return new Promise(resolve=>{
  const doc=root.document,previous=doc.activeElement,dialog=doc.createElement('dialog'),actor=opts.actor(),sameActor=()=>actor===opts.actor();
  dialog.className='modal on file-run-confirm';dialog.setAttribute('aria-label','ยกเว้นไฟล์จากการรัน / คืนไฟล์');let alive=true,busy=false,v=null,reason='',error='';
  const close=saved=>{if(!alive||busy)return;alive=false;root.AuditUi?.close(dialog);dialog.remove();if(previous?.isConnected)previous.focus();resolve(!!saved);};
  function draw(){if(!alive)return;dialog.innerHTML=`<header class="modal-head"><h2>ยกเว้นไฟล์จากการรัน / คืนไฟล์</h2></header><div class="modal-body">${v?`<p><strong>${esc(v.name)}</strong></p><p>${esc(v.company)} · วันอ้างอิง ${esc(v.date)} · เวอร์ชัน ${esc(v.revision)}</p><p role="status">${v.excluded?'ยกเว้นอยู่ — บอทและรันมือไม่เลือกไฟล์นี้':'ยังไม่ได้ยกเว้นไฟล์'}</p><p>${esc(v.message)}</p>`:'<p role="status">กำลังตรวจเวอร์ชัน ผลหลัก และงานที่ใช้ไฟล์…</p>'}<p>ไม่ลบไฟล์ ไม่เปลี่ยนชนิดไฟล์หรือวันอ้างอิง ไม่รัน ไม่เปลี่ยนยอดหรือเคส การคืนไฟล์ไม่เปิดบอทให้รันอัตโนมัติ</p><p>ไฟล์ที่ยังไม่ใช้ในผลหลักจะเพิ่มประวัติการยกเว้น/คืนไฟล์ รอบที่มีเวอร์ชันแก้ไขต้องทบทวนก่อนสั่งรัน</p><label>เหตุผล (อย่างน้อย 10 ตัวอักษร)<input data-reason maxlength="2000" value="${esc(reason)}" ${busy?'disabled':''}></label><p role="alert">${esc(error)}</p></div><footer class="modal-foot"><button data-close ${busy?'disabled':''}>ยกเลิก</button><button class="primary" data-review ${busy||!v||v.blocked||!sameActor()||!canManage(opts.role())?'disabled':''}>${v?.excluded?'ทบทวนคืนไฟล์':'ทบทวนยกเว้นไฟล์'}</button></footer>`;
   dialog.querySelector('[data-reason]').oninput=e=>{reason=e.target.value;};dialog.querySelector('[data-close]').onclick=()=>close(false);
   dialog.querySelector('[data-review]').onclick=async()=>{
    if(busy||!sameActor()||!canManage(opts.role()))return;
    try{validate(v,reason);const review=v,note=reason.trim();busy=true;draw();
     const yes=await opts.confirm({title:review.excluded?'คืนไฟล์ให้เลือกใช้ในการรัน':'ยกเว้นไฟล์จากการรัน',message:`${review.name}\n${review.company} · ${review.date}\n${note}\nเก็บต้นฉบับและประวัติ ไม่รัน ไม่ยืนยันผลหลัก ไม่เปลี่ยนยอดหรือเคส`,confirmLabel:review.excluded?'ยืนยันคืนไฟล์ · ไม่รัน':'ยืนยันยกเว้นไฟล์ · ไม่รัน',allowed:()=>sameActor()&&canManage(opts.role())});
     if(!yes||!sameActor()||!canManage(opts.role()))return;
     // The server rechecks primary use, busy scopes and expected revision atomically.
     const result=await opts.save({fileId:review.id,expectedRevision:review.revision,excluded:!review.excluded,reason:note});
     if(result?.excluded!==!review.excluded)throw Error('ยังยืนยันผลบันทึกไม่ได้ กรุณาโหลดประวัติ ห้ามกดซ้ำ');
     busy=false;close(true);
    }catch(e){error=e.message;}finally{busy=false;draw();}
   };
  }
  dialog.addEventListener('cancel',e=>{e.preventDefault();close(false);});doc.body.appendChild(dialog);draw();dialog.showModal();root.AuditUi?.open(dialog);
  Promise.resolve().then(()=>opts.preview(opts.fileId)).then(value=>{if(!alive)return;if(!sameActor()||!canManage(opts.role()))throw Error('ผู้ใช้หรือสิทธิ์เปลี่ยน กรุณาเปิดใหม่');v=value;draw();}).catch(e=>{error=e.message;draw();});
 });}
 root.FileExclusion={open,canManage,validate};if(typeof module!=='undefined')module.exports=root.FileExclusion;
})(typeof window==='undefined'?globalThis:window);
