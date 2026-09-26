/* Shared policy for rows that require an Audit decision.
   Informational alerts remain in source data and Audit Log, but must not
   become an Audit action row or inflate the visible/exported case totals. */
(function(root){
  'use strict';
  const COMPANIES=Object.freeze(['3XB','MC8','MR9','PS8','UR9','AT4','FR8','SK8']);
  const companySet=new Set(COMPANIES);
  function companyOf(row){
    const raw=String(row?.company||row?.subco||'').trim().toUpperCase();
    return raw==='3X'?'3XB':raw;
  }
  function typeOf(row){return String(row?.ex_type||row?.type||row?.exType||'').trim().toLowerCase().replace(/[\s-]+/g,'_');}
  function textOf(row){return [row?.type_name,row?.typeName,row?.detail,row?.reason].filter(Boolean).join(' ');}
  function directionOf(value){const raw=String(value||'').trim().toLowerCase();return raw==='ฝาก'?'deposit':raw==='ถอน'?'withdraw':raw;}
  function cents(value){const n=Number(value);return Number.isFinite(n)?Math.round(n*100):null;}
  function timeOf(date,time,sec){
    const day=String(date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return '';
    if(Number.isFinite(Number(sec))&&Number(sec)>=0&&Number(sec)<86400)return `${day}|${Math.round(Number(sec))}`;
    const hit=String(time||'').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    return hit?`${day}|${Number(hit[1])*3600+Number(hit[2])*60+Number(hit[3]||0)}`:'';
  }
  function clean(value){return String(value||'').trim().toUpperCase().replace(/\s+/g,' ');}
  function providerReference(value){
    const hit=String(value||'').match(/\b6aa[a-f0-9]{21}\b/i);
    return hit?hit[0].toUpperCase():'';
  }
  function detailOf(row,side){return row?.customer_details?.[side]||row?.customer?.[side]||{};}
  function sideOfMissing(row){const type=typeOf(row);return type==='missing_stm'?'bo':type==='missing_bo'?'stm':'';}
  function caseFingerprint(row,side){
    const detail=detailOf(row,side),amount=side==='bo'?row?.system_amount:row?.bank_amount;
    const date=row?.[`${side}_date`]||row?.business_date||row?.date;
    const time=row?.[`${side}_time`]||row?.occurred_at||row?.time;
    return {company:companyOf(row),account:clean(row?.account),direction:directionOf(row?.direction),amount:cents(amount),stamp:timeOf(date,time),providerReference:providerReference(detail.providerReference||detail.note||row?.bo_raw||row?.stm_raw),reference:clean(detail.reference),customerAccount:clean(detail.account),tail:clean(detail.tail||detail.last4),bank:clean(detail.bank),name:clean(detail.name),user:clean(detail.user)};
  }
  function evidenceFingerprint(pair,side){
    const detail=detailOf(pair,side),source=pair?.[side]||{},amount=side==='bo'?(pair?.boAmount??pair?.amount):(pair?.stmAmount??pair?.amount);
    return {company:companyOf(pair),account:clean(pair?.account),direction:directionOf(pair?.direction),amount:cents(amount),stamp:timeOf(source.date,'',source.sec),providerReference:providerReference(detail.providerReference||detail.note||source.raw),reference:clean(detail.reference),customerAccount:clean(detail.account),tail:clean(detail.tail||detail.last4),bank:clean(detail.bank),name:clean(detail.name),user:clean(detail.user)};
  }
  function sameIdentity(a,b){
    const fields=['reference','customerAccount','tail','bank','name','user'];
    for(const field of fields)if(a[field]&&b[field]&&a[field]!==b[field])return false;
    return fields.some(field=>a[field]&&b[field]&&a[field]===b[field]);
  }
  function samePersistedSide(a,b){
    if(!a.company||a.company!==b.company||!a.account||a.account!==b.account)return false;
    if(!a.direction||a.direction!==b.direction||a.amount===null||a.amount!==b.amount)return false;
    // The XB provider id is the authoritative identity. It remains valid even
    // when a legacy case stored the wrong BO time, which is the exact failure
    // mode that previously left matched Sapan rows open in the UI/export.
    if(a.providerReference&&b.providerReference)return a.providerReference===b.providerReference;
    if(!a.stamp||a.stamp!==b.stamp)return false;
    /* Exact date/time/account/amount is the base transaction fingerprint. When
       either side retains customer/reference fields, at least one identity field
       must agree and no populated field may conflict. */
    const hasIdentity=['reference','customerAccount','tail','bank','name','user'].some(field=>a[field]||b[field]);
    return !hasIdentity||sameIdentity(a,b);
  }
  function isInformational(row){
    if(!companySet.has(companyOf(row)))return false;
    /* ตามขั้นตอน Audit ของ 5 บริษัท: ยอดตรงแต่เวลาคลาดเป็นผลการจับคู่ที่ระบบ
       รับผ่านและเก็บหลักฐานไว้ ไม่ใช่เคสที่ต้องให้ Audit ยืนยันทีละรายการ */
    if(['large_amount','time_diff'].includes(typeOf(row)))return true;
    return /ยอดสูงผิดปกติ\s*(?:ต้องมีเอกสารกำกับ|ต้องแนบเอกสารอนุมัติ)|ต้องแนบเอกสารอนุมัติ/.test(textOf(row));
  }
  function isActionable(row){return !isInformational(row);}
  function removeMatchedMissing(rows,evidence){
    const source=(Array.isArray(rows)?rows:[]).filter(isActionable),pairs=Array.isArray(evidence)?evidence:[];
    if(!pairs.length)return source;
    const companies=[...new Set(source.map(companyOf).filter(Boolean))],fallbackCompany=companies.length===1?companies[0]:'';
    const scopedPairs=pairs.map(pair=>companyOf(pair)||!fallbackCompany?pair:{...pair,company:fallbackCompany});
    const available={bo:scopedPairs.map((pair,index)=>({index,fingerprint:evidenceFingerprint(pair,'bo')})),stm:scopedPairs.map((pair,index)=>({index,fingerprint:evidenceFingerprint(pair,'stm')}))};
    const used={bo:new Set(),stm:new Set()};
    return source.filter(row=>{
      const side=sideOfMissing(row);
      if(!side)return true;
      const fingerprint=caseFingerprint(row,side);
      const hit=available[side].find(item=>!used[side].has(item.index)&&samePersistedSide(fingerprint,item.fingerprint));
      if(!hit)return true;
      used[side].add(hit.index);
      return false;
    });
  }
  function stableTransactionReference(row,side){
    const detail=detailOf(row,side);
    const value=detail.reference||row?.[`${side}_reference`]||row?.[`${side}_ref`]||'';
    const text=clean(value);
    return text&&!/^EX-/i.test(text)?text:'';
  }
  function removeDuplicateTransactions(rows){
    const seen=new Set();
    return (Array.isArray(rows)?rows:[]).filter(row=>{
      // Closed history remains auditable. Only collapse repeated active projections
      // of the same persisted BO/STM transaction.
      if(String(row?.status||'').toLowerCase()==='closed')return true;
      const boRef=stableTransactionReference(row,'bo'),stmRef=stableTransactionReference(row,'stm');
      const ref=boRef?`BO|${boRef}`:stmRef?`STM|${stmRef}`:'';
      if(!ref)return true;
      const key=[companyOf(row),clean(row?.account),directionOf(row?.direction),ref].join('|');
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }
  function filter(rows,evidence){return removeDuplicateTransactions(removeMatchedMissing(rows,evidence));}
  const api=Object.freeze({version:'actionable-audit-v6',COMPANIES,companyOf,typeOf,isInformational,isActionable,removeMatchedMissing,removeDuplicateTransactions,filter});
  root.AuditVisiblePolicy=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
