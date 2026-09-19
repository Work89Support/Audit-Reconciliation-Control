/* Shared policy for rows that require an Audit decision.
   Informational alerts remain in source data and Audit Log, but must not
   become an Audit action row or inflate the visible/exported case totals. */
(function(root){
  'use strict';
  const COMPANIES=Object.freeze(['3XB','MC8','MR9','PS8','UR9']);
  const companySet=new Set(COMPANIES);
  function companyOf(row){
    const raw=String(row?.company||row?.subco||'').trim().toUpperCase();
    return raw==='3X'?'3XB':raw;
  }
  function typeOf(row){return String(row?.ex_type||row?.type||row?.exType||'').trim().toLowerCase().replace(/[\s-]+/g,'_');}
  function textOf(row){return [row?.type_name,row?.typeName,row?.detail,row?.reason].filter(Boolean).join(' ');}
  function isInformational(row){
    if(!companySet.has(companyOf(row)))return false;
    /* ตามขั้นตอน Audit ของ 5 บริษัท: ยอดตรงแต่เวลาคลาดเป็นผลการจับคู่ที่ระบบ
       รับผ่านและเก็บหลักฐานไว้ ไม่ใช่เคสที่ต้องให้ Audit ยืนยันทีละรายการ */
    if(['large_amount','time_diff'].includes(typeOf(row)))return true;
    return /ยอดสูงผิดปกติ\s*(?:ต้องมีเอกสารกำกับ|ต้องแนบเอกสารอนุมัติ)|ต้องแนบเอกสารอนุมัติ/.test(textOf(row));
  }
  function isActionable(row){return !isInformational(row);}
  function filter(rows){return (Array.isArray(rows)?rows:[]).filter(isActionable);}
  const api=Object.freeze({version:'xb-actionable-audit-v2',COMPANIES,companyOf,typeOf,isInformational,isActionable,filter});
  root.AuditVisiblePolicy=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
