(function(root){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const canRespond=(status,role)=>status==='clarifying'||(role==='shift_lead'&&status==='answered');
 const draftMarkup=file=>file?`<section class="case-selected-evidence" role="status"><b>เลือกไฟล์ไว้แล้ว — ยังไม่ได้ส่งคำชี้แจง</b><p>${esc(file.file_name)}</p><p>กรอก “ต้องการชี้แจงเคสนี้ โดยสาเหตุ…” แล้วกดส่งคำชี้แจงพร้อมหลักฐานด้านล่าง</p></section>`:'';
 function historyMarkup(rows,date){return rows?.length?`<details class="case-response-history"><summary>ข้อความเดิมและประวัติคำชี้แจง (${rows.length})</summary>${rows.map(r=>`<article><b>${esc(r.label||'คำชี้แจง')}</b><p class="clarification-request-text">${esc(r.text)}</p><small>${esc(r.actor_name||'ไม่พบชื่อผู้บันทึก')} · ${esc(date(r.at))}</small>${r.file_name?`<p>หลักฐาน: ${esc(r.file_name)}</p>`:''}</article>`).join('')}</details>`:'<p class="hint">ยังไม่มีข้อความเดิมที่บันทึกไว้</p>';}
 root.ClarificationFlow={canRespond,draftMarkup,historyMarkup};if(typeof module!=='undefined')module.exports=root.ClarificationFlow;
})(typeof window==='undefined'?globalThis:window);
