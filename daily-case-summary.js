(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const count=v=>Number(v).toLocaleString('th-TH');
 function markup(row){
  const ready=row.currentCountsReady===true&&!row.caseSetPending;
  const main=row.caseSetPending?'รอสร้างชุดเคสปัจจุบัน':!ready?'กำลังตรวจจำนวนเคสค้าง':`ค้างปัจจุบัน ${count(row.openCount)} เคส`;
  return `<div data-current-case-summary><strong class="${ready&&row.openCount>0?'danger':''}">${esc(main)}</strong><small class="sub">${ready?`ปิดแล้ว ${count(row.resolvedCount)} เคส · ชุดเคสปัจจุบัน`:'ยังไม่ใช้ผลตรวจเดิมแทนจำนวนเคสค้าง'}</small><small class="sub muted">ผลตรวจตอนรัน ${count(row.generatedExceptionCount)} รายการ · ไม่ใช่เคสค้าง</small></div>`;
 }
 root.DailyCaseSummary={markup};if(typeof module!=='undefined')module.exports=root.DailyCaseSummary;
})(typeof window==='undefined'?globalThis:window);
