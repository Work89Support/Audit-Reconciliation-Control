/* Read-only Audit workbook view of persisted reconciliation evidence. */
(function(root){
  'use strict';
  const COMPANIES=Object.freeze(['3XB','MC8','MR9','PS8','UR9']);
  const SHEETS=Object.freeze(['AT ถ','AT ฝ','AZ ถ','AZ ฝ','CP ถ','CP ฝ','M ถ','M ฝ']);
  const AUDIT_HEADERS=Object.freeze(['เงื่อนไขที่จับคู่','ต่างเวลา','ผลต่างยอด','สถานะ Audit']);
  const BO_HEADERS=Object.freeze(['รหัส','เวลา','ประเภท','ประเภทดำเนินการ','ยูสเซอร์','ธนาคาร','จำนวน','จำนวนที่ได้รับ','ค่าธรรรมเนียม','เวลาทำรายการ','หมายเหตุ','ผู้ดำเนินการ']);
  const ALL_HEADERS=Object.freeze(['ผลตรวจระบบ','สถานะ Audit','เลขเคส','บัญชีบริษัท / Provider','ประเภท','BO · วัน / เวลา','BO · ยอด','BO · บัญชีลูกค้า','BO · ท้าย 4','BO · ธนาคารลูกค้า','BO · ชื่อ / User','BO · User','BO · อ้างอิง','BO · รายละเอียดต้นฉบับ','STM/PM · วัน / เวลา','STM/PM · ยอด','STM/PM · บัญชีลูกค้า','STM/PM · ท้าย 4','STM/PM · ธนาคารลูกค้า','STM/PM · ชื่อ / User','STM/PM · User','STM/PM · อ้างอิง','STM/PM · รายละเอียดต้นฉบับ','ต่างเวลา','เหตุผลระบบ','หมายเหตุ Audit','เอกสารอ้างอิง','สถานะสำหรับเทียบทีมกระทบมือ']);
  const STATEMENT_HEADERS=Object.freeze(['ลำดับ','บริษัท','วันที่','บัญชี Statement','ประเภท','วัน / เวลา Statement','ยอด Statement','บัญชีลูกค้า','ท้าย 4','ธนาคาร','ชื่อ / User Statement','เลขอ้างอิง Statement','วัน / เวลา BO','ยอด BO','User BO','ชื่อ / User BO','เลขอ้างอิง BO','ต่างเวลา','เงื่อนไขที่จับคู่','ผลต่างยอด','สถานะ Audit']);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numeric=v=>Number.isFinite(Number(v))?Number(v):null;
  const cents=v=>{const n=numeric(v);return n===null?null:Math.round(n*100);};
  const money=v=>v===null||v===undefined||v===''?'—':numeric(v)===null?'อ่านยอดไม่ได้':Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const moneyCents=v=>money(v/100);
  const slots=new WeakMap(),remembered={date:'',company:''};

  function directionOf(value){const s=String(value||'').trim().toLowerCase();return s==='deposit'||s==='ฝาก'?'deposit':s==='withdraw'||s==='ถอน'?'withdraw':s;}
  function providerOf(value){
    const s=String(value||'').trim().toUpperCase();
    if(/AUTOPEER|\bATP\b/.test(s))return 'AT';
    if(/AZPAY|\bAZP?\b/.test(s))return 'AZ';
    if(/COREPAY|CPPAY|CPXM|\bCP\b/.test(s))return 'CP';
    if(/MYPAY|\bM24\b|MYPAYS24/.test(s))return 'M';
    return 'OTHER';
  }
  function sheetOf(row){const p=providerOf(row?.account),d=directionOf(row?.direction);return p==='OTHER'||!['deposit','withdraw'].includes(d)?'OTHER':`${p} ${d==='deposit'?'ฝ':'ถ'}`;}
  function stamp(t){return t?.date?`${t.date} ${Number.isFinite(t.sec)&&t.sec>=0&&t.sec<86400?new Date(t.sec*1000).toISOString().slice(11,19):''}`.trim():'';}
  function realRaw(value){const s=String(value||'').trim();return s&&!/^[—–-]|^ไม่พบรายการ|^รอข้อมูล|^ไม่มีข้อมูล/i.test(s)?s:'';}

  function rowsOf(data,fallbackCompany=''){
    const pairs=Array.isArray(data?.run?.summary?.match_evidence)?data.run.summary.match_evidence:[];
    const cases=Array.isArray(data?.cases)?data.cases:[];
    return [
      ...pairs.map((p,index)=>({key:`pair-${index}`,isPair:true,kind:'matched',company:p.company||fallbackCompany,account:p.account||'ไม่ระบุ PM',direction:directionOf(p.direction),bo:p.customer?.bo||{},pm:p.customer?.stm||{},boAmount:p.boAmount??p.amount,pmAmount:p.stmAmount??p.amount,boTime:stamp(p.bo),pmTime:stamp(p.stm),boDate:p.bo?.date||'',pmDate:p.stm?.date||'',crossDay:!!p.crossDay||!!(p.bo?.date&&p.stm?.date&&p.bo.date!==p.stm.date),reason:p.method||'ผลจับคู่ที่บันทึกไว้',boSource:p.bo,pmSource:p.stm,code:`คู่ ${index+1}`,exType:''})),
      ...cases.map(e=>({key:e.id,isPair:false,kind:e.status==='closed'?'closed':e.status==='pending_next_day'?'pending_next_day':'review',company:e.company||fallbackCompany,account:e.account||'ไม่ระบุ PM',direction:directionOf(e.direction),bo:e.customer_details?.bo||{},pm:e.customer_details?.stm||{},boAmount:e.system_amount,pmAmount:e.bank_amount,boTime:[e.bo_date,e.bo_time].filter(Boolean).join(' '),pmTime:[e.stm_date,e.stm_time].filter(Boolean).join(' '),boDate:e.bo_date||'',pmDate:e.stm_date||'',crossDay:e.ex_type==='cross_day'||!!(e.bo_date&&e.stm_date&&e.bo_date!==e.stm_date),reason:e.resolution_note||e.detail||e.type_name||e.ex_type||'',boRaw:e.bo_raw||'',pmRaw:e.stm_raw||'',code:e.code||e.id,exType:e.ex_type||'',case:e}))
    ];
  }
  function hasSide(row,side){return cents(row[`${side}Amount`])!==null&&(row.isPair||!!(realRaw(row[`${side}Raw`])||row[`${side}Date`]||Object.values(row[side]||{}).some(Boolean)));}
  function sideKey(row,side){
    if(!hasSide(row,side))return '';
    const detail=row[side]||{},amount=cents(row[`${side}Amount`]);
    if(detail.reference)return `ref:${providerOf(row.account)}:${row.direction}:${amount}:${String(detail.reference).trim().toLowerCase()}`;
    const source=row[`${side}Source`]||{};
    if(source.fileId&&source.row!==null&&source.row!==undefined)return `src:${source.fileId}:${source.row}`;
    const raw=realRaw(row[`${side}Raw`]);
    if(raw)return `raw:${raw.replace(/\s+/g,' ').toLowerCase()}`;
    return `fallback:${providerOf(row.account)}:${row.direction}:${amount}:${row[`${side}Time`]||''}:${detail.user||''}:${detail.account||''}`;
  }
  function uniqueSides(rows,side){const map=new Map();rows.forEach(row=>{const key=sideKey(row,side);if(key&&!map.has(key))map.set(key,row);});return map;}
  function summarize(rows){
    const pm=uniqueSides(rows,'pm'),bo=uniqueSides(rows,'bo'),review=rows.filter(r=>!r.isPair),pairedPm=uniqueSides(rows.filter(r=>r.isPair),'pm'),pairedBo=uniqueSides(rows.filter(r=>r.isPair),'bo');
    const unmatchedPm=uniqueSides(review,'pm'),unmatchedBo=uniqueSides(review,'bo');
    pairedPm.forEach((_,key)=>unmatchedPm.delete(key));pairedBo.forEach((_,key)=>unmatchedBo.delete(key));
    const pairKeys=new Set(),matched=[];rows.filter(r=>r.isPair).forEach(row=>{const key=`${sideKey(row,'pm')}|${sideKey(row,'bo')}`;if(!pairKeys.has(key)){pairKeys.add(key);matched.push(row);}});
    const crossDay=new Map(),duplicate=new Map();
    rows.filter(r=>r.crossDay).forEach(r=>{const key=sideKey(r,'bo');if(key&&!crossDay.has(key))crossDay.set(key,r);});
    review.filter(r=>/duplicate|ambig|ซ้ำ|กำกวม/i.test(`${r.exType} ${r.reason}`)).forEach(r=>{const key=sideKey(r,'bo')||sideKey(r,'pm')||r.key;if(!duplicate.has(key))duplicate.set(key,r);});
    const total=(map,side)=>[...map.values()].reduce((sum,r)=>sum+(cents(r[`${side}Amount`])||0),0);
    const pmCents=total(pm,'pm'),boCents=total(bo,'bo'),crossDayBoCents=total(crossDay,'bo');
    return {pmCount:pm.size,pmCents,boCount:bo.size,boCents,matchedCount:matched.length,matchedPmCents:matched.reduce((s,r)=>s+(cents(r.pmAmount)||0),0),matchedBoCents:matched.reduce((s,r)=>s+(cents(r.boAmount)||0),0),unmatchedPmCount:unmatchedPm.size,unmatchedPmCents:total(unmatchedPm,'pm'),unmatchedBoCount:unmatchedBo.size,unmatchedBoCents:total(unmatchedBo,'bo'),crossDayCount:crossDay.size,crossDayBoCents,duplicateCount:duplicate.size,duplicateCents:[...duplicate.values()].reduce((s,r)=>s+(cents(r.boAmount)??cents(r.pmAmount)??0),0),diffBeforeCents:pmCents-(boCents-crossDayBoCents),diffAfterCents:pmCents-boCents};
  }
  function summaries(rows){return Object.fromEntries(SHEETS.map(name=>[name,summarize(rows.filter(r=>sheetOf(r)===name))]));}
  function isStatement(row){return /^\d{6,}$/.test(String(row?.account||''));}
  function filter(rows,pm,direction,status,sheet='all'){
    return rows.filter(r=>(pm==='all'||r.account===pm)
      &&(direction==='all'||r.direction===direction)
      &&(status==='all'||r.kind===status)
      &&(sheet==='all'||sheet==='summary'||(sheet==='statement'?isStatement(r):sheetOf(r)===sheet)));
  }
  function statusOf(s,complete){return !complete?'ข้อมูลยังไม่ครบ':s.diffAfterCents===0&&s.unmatchedPmCount===0&&s.unmatchedBoCount===0&&s.duplicateCount===0?'ยอดตรง':'ต้องตรวจ';}
  function summaryRow(name,s,complete){const warning=complete&&(s.diffAfterCents||s.unmatchedPmCount||s.unmatchedBoCount||s.duplicateCount);return `<tr class="${warning?'mc8-warning':''}"><th><button type="button" data-live-sheet="${esc(name)}">${esc(name)}</button></th><td>${s.pmCount} / ${moneyCents(s.pmCents)}</td><td>${s.boCount} / ${moneyCents(s.boCents)}</td><td>${s.matchedCount} / ${moneyCents(s.matchedPmCents)}</td><td>${s.unmatchedPmCount} / ${moneyCents(s.unmatchedPmCents)}</td><td>${s.unmatchedBoCount} / ${moneyCents(s.unmatchedBoCents)}</td><td>${s.crossDayCount} / ${moneyCents(s.crossDayBoCents)}</td><td>${s.duplicateCount} / ${moneyCents(s.duplicateCents)}</td><td>${moneyCents(s.diffBeforeCents)}</td><td>${moneyCents(s.diffAfterCents)}</td><td>${statusOf(s,complete)}</td></tr>`;}
  function summaryFooter(rows,complete){const s=summarize(rows);return `<tfoot><tr><th>รวม 8 หน้า</th><td>${s.pmCount} / ${moneyCents(s.pmCents)}</td><td>${s.boCount} / ${moneyCents(s.boCents)}</td><td>${s.matchedCount} / ${moneyCents(s.matchedPmCents)}</td><td>${s.unmatchedPmCount} / ${moneyCents(s.unmatchedPmCents)}</td><td>${s.unmatchedBoCount} / ${moneyCents(s.unmatchedBoCents)}</td><td>${s.crossDayCount} / ${moneyCents(s.crossDayBoCents)}</td><td>${s.duplicateCount} / ${moneyCents(s.duplicateCents)}</td><td>${moneyCents(s.diffBeforeCents)}</td><td>${moneyCents(s.diffAfterCents)}</td><td>${statusOf(s,complete)}</td></tr></tfoot>`;}
  function totalsPanel(label,s,complete){
    const rows=[['STM / PM',s.pmCount,s.pmCents,'ไม่รวมธุรกรรมซ้ำจากเคสเตือน'],['BO',s.boCount,s.boCents,'รวมรายการข้ามวัน'],['จับคู่แล้ว',s.matchedCount,s.matchedPmCents,'ยอด STM / PM ของคู่ที่บันทึกไว้'],['ยังไม่จับคู่ STM / PM',s.unmatchedPmCount,s.unmatchedPmCents,'อยู่ในเคสที่ต้องตรวจ'],['ยังไม่จับคู่ BO',s.unmatchedBoCount,s.unmatchedBoCents,'อยู่ในเคสที่ต้องตรวจ'],['BO ข้ามวัน',s.crossDayCount,s.crossDayBoCents,'แยกให้เห็นก่อนรวมเข้า BO'],['ซ้ำ / กำกวม',s.duplicateCount,s.duplicateCents,'ไม่นับซ้ำในยอดฝั่ง'],['ผลต่างก่อนรวมข้ามวัน','—',s.diffBeforeCents,'STM / PM − BO ในวัน'],['ผลต่างหลังรวมข้ามวัน','—',s.diffAfterCents,statusOf(s,complete)]];
    return `<section class="mc8-totals" aria-label="ยอดรวมท้ายตาราง"><h3>ยอดรวมท้ายตาราง · ${esc(label)}</h3><table><thead><tr><th>ฝั่ง / ผลตรวจ</th><th>จำนวน</th><th>ยอด (บาท)</th><th>หมายเหตุ</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td><td>${moneyCents(r[2])}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table><p>${complete?'คำนวณจากหลักฐานของรอบที่บันทึกไว้ โดยหักรายการอ้างอิงซ้ำก่อนรวมยอด':'หลักฐานรอบงานยังไม่ครบ ห้ามใช้ยอดนี้ยืนยันปิดงาน'}</p></section>`;
  }

  function thaiDirection(row){return row.direction==='deposit'?'ฝาก':row.direction==='withdraw'?'ถอน':'ไม่ระบุ';}
  function secondsBetween(row){
    const a=Date.parse(row.boTime||''),b=Date.parse(row.pmTime||'');
    if(!Number.isFinite(a)||!Number.isFinite(b))return '';
    const sec=Math.abs(Math.round((a-b)/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return `${h?'ต่าง '+h+' ชั่วโมง ':''}${m?'ต่าง '+m+' นาที ':''}${!h&&!m||s?s+' วินาที':''}`.trim();
  }
  function auditStatus(row,complete=true){
    if(row.kind==='closed')return 'ปิดเคสแล้ว';
    if(!complete)return 'ต้องตรวจเพิ่ม · ข้อมูลรอบไม่ครบ';
    if(row.kind==='matched')return 'ปิดได้ทันที';
    if(row.kind==='advisory')return 'แจ้งข้อมูล · ไม่ต้องยืนยัน';
    if(row.kind==='pending_next_day'||row.exType==='cross_day')return 'ค้างรอข้อมูลข้ามวัน · รอข้อมูลของวันถัดไป';
    const pm=cents(row.pmAmount),bo=cents(row.boAmount);
    // An equal, complete pair is allowed through. Extra informational flags
    // must not become an Audit action item or a visible "ต้องตรวจเพิ่ม" state.
    return hasSide(row,'pm')&&hasSide(row,'bo')&&pm!==null&&pm===bo?'ปิดได้ทันที':'ปิดไม่ได้/ต้องตรวจ';
  }
  function toneOf(status){return status==='ปิดได้ทันที'||status==='ปิดเคสแล้ว'||status.startsWith('แจ้งข้อมูล')?'success':status.startsWith('ต้องตรวจเพิ่ม')||status.startsWith('ค้างรอข้อมูลข้ามวัน')?'warning':'error';}
  function exportTones(rows,complete,statusIndex){
    const tones=rows.map(row=>toneOf(auditStatus(row,complete)));
    return {
      rowTones:tones.map(tone=>tone==='success'?'':tone),
      cellTones:tones.map(tone=>{const cells=[];cells[statusIndex]=tone;return cells;}),
    };
  }
  function amountDiff(row){const pm=cents(row.pmAmount),bo=cents(row.boAmount);return pm===null&&bo===null?'':((pm||0)-(bo||0))/100;}
  function detail(row,side,key){return row?.[side]?.[key]??'';}
  function sourceColumns(row){
    const time=row.pmSource?.timeColumn||(row.direction==='withdraw'?'updateTime':'paymentTime');
    const amount=row.pmSource?.amountColumn||(row.direction==='deposit'?'realAmount':/^(AT|M)$/.test(providerOf(row.account))?'transferredAmount':'amount');
    return {time,amount};
  }
  function sourceCondition(row){const s=sourceColumns(row);return [row.reason||'',`เวลา PM: ${s.time}`,`ยอด PM: ${s.amount}`].filter(Boolean).join(' · ');}
  function allExportRow(row,complete){
    const status=auditStatus(row,complete),bo=row.bo||{},pm=row.pm||{};
    const state=row.kind==='closed'?'ปิดเคสแล้ว':row.kind==='matched'?'คู่สำเร็จ':row.kind==='advisory'?'แจ้งข้อมูล':row.kind==='pending_next_day'?'ค้างรอข้อมูลข้ามวัน':'รอตรวจ';
    const sources=sourceColumns(row);
    return [row.isPair?'จับคู่ได้':'Exception',state,row.code||row.key,row.account||'',thaiDirection(row),row.boTime||'',numeric(row.boAmount)??'',bo.account||'',bo.tail||'',bo.bank||'',bo.name||bo.user||'',bo.user||'',bo.reference||'',row.boRaw||bo.note||'',row.pmTime||'',numeric(row.pmAmount)??'',pm.account||'',pm.tail||'',pm.bank||'',pm.name||pm.user||'',pm.user||'',pm.reference||'',row.pmRaw||pm.note||'',secondsBetween(row),sourceCondition(row),row.case?.resolution_note||'',[`BO ${row.boSource?.row??''}`,`PM ${row.pmSource?.row??''}`,`เวลา ${sources.time}`,`ยอด ${sources.amount}`].filter(v=>!v.endsWith(' ')).join(' · '),status];
  }
  function leftExportValue(header,row){
    const pm=row.pm||{},code=(providerOf(row.account)==='AT'?'autopeer':providerOf(row.account)==='AZ'?'azpay':providerOf(row.account)==='CP'?'corepay':'mypays24');
    const source=sourceColumns(row),sourceTime=header=>header===source.time?row.pmTime||'':'';
    const values={id:pm.reference||row.code,amount:source.amount==='amount'?(numeric(row.pmAmount)??''):'',provider:code,status:['matched','advisory','closed'].includes(row.kind)?'SUCCESSED':'REVIEW',requestTime:'',fee:'',reference:pm.reference||row.code,merchantRef:pm.reference||row.code,customerId:pm.user||'',systemRef:pm.reference||row.code,systemOrderNo:pm.reference||row.code,transactionId:(row.bo||{}).reference||row.code,bankCode:pm.bank||'',bankAccountNo:pm.account||'',bankAccountName:pm.name||'',updateTime:sourceTime('updateTime'),gatewayId:'',site:'',transferredAmount:source.amount==='transferredAmount'?(numeric(row.pmAmount)??''):'',_id:pm.reference||row.code,submitStatus:'',paymentMethods:'','gateway.name':code,'gateway.id':code,realAmount:source.amount==='realAmount'?(numeric(row.pmAmount)??''):'',payee:pm.name||'',paymentTime:sourceTime('paymentTime'),expiredTime:'',reason:sourceCondition(row)};
    return values[header]??'';
  }
  function providerExportRow(template,row,complete){
    const headers=template.headers||[],boStart=headers.indexOf('รหัส'),values=headers.map((header,index)=>index<boStart?leftExportValue(header,row):'');
    const bo=row.bo||{},boValues=[bo.reference||row.code,row.boTime||'',thaiDirection(row),bo.origin||'ออโต้',bo.user||'',bo.bank||row.account||'',numeric(row.boAmount)??'',row.direction==='deposit'?(numeric(row.boAmount)??''):0,'',row.boTime||'',bo.note||row.reason||'',bo.performedBy||''];
    BO_HEADERS.forEach((header,index)=>{const target=headers.indexOf(header,boStart);if(target>=0)values[target]=boValues[index];});
    return [...values,sourceCondition(row),secondsBetween(row),amountDiff(row),auditStatus(row,complete)];
  }
  function statementExportRow(row,index,company,date,complete){return [index+1,company,date,row.account,thaiDirection(row),row.pmTime||'',numeric(row.pmAmount)??'',detail(row,'pm','account'),detail(row,'pm','tail'),detail(row,'pm','bank'),detail(row,'pm','name')||detail(row,'pm','user'),detail(row,'pm','reference'),row.boTime||'',numeric(row.boAmount)??'',detail(row,'bo','user'),detail(row,'bo','name')||detail(row,'bo','user'),detail(row,'bo','reference'),secondsBetween(row),sourceCondition(row),amountDiff(row),auditStatus(row,complete)];}
  function totalRow(headers,rows,amountHeader){
    const result=Array(headers.length).fill(''),pmIndex=headers.indexOf(amountHeader),boIndex=headers.lastIndexOf('จำนวน'),diffIndex=headers.indexOf('ผลต่างยอด'),statusIndex=headers.indexOf('สถานะ Audit');
    result[0]='รวม';
    if(pmIndex>=0)result[pmIndex]=rows.reduce((sum,row)=>sum+(numeric(row[pmIndex])||0),0);
    if(boIndex>=0)result[boIndex]=rows.reduce((sum,row)=>sum+(numeric(row[boIndex])||0),0);
    if(diffIndex>=0)result[diffIndex]=(pmIndex>=0?result[pmIndex]:0)-(boIndex>=0?result[boIndex]:0);
    if(statusIndex>=0)result[statusIndex]=`รวม ${rows.length.toLocaleString('th-TH')} รายการ`;
    return result;
  }
  function buildAuditExportSheets(rows,company,date,complete=true,schema=root.MC8SheetSchema){
    if(!schema?.sheets?.length)throw new Error('ไม่พบโครงหัวตาราง Audit');
    const allRows=rows.map(row=>allExportRow(row,complete)),allTones=exportTones(rows,complete,ALL_HEADERS.length-1);
    const allTotal=Array(ALL_HEADERS.length).fill(''),allSummary=summarize(rows);allTotal[0]='รวม';allTotal[1]=`${rows.length.toLocaleString('th-TH')} รายการ`;allTotal[ALL_HEADERS.indexOf('BO · ยอด')]=allSummary.boCents/100;allTotal[ALL_HEADERS.indexOf('STM/PM · ยอด')]=allSummary.pmCents/100;allTotal[ALL_HEADERS.indexOf('ผลต่างยอด')]=allSummary.diffAfterCents/100;allTotal[ALL_HEADERS.length-1]='รวมทุกสถานะ';
    const supported=rows.filter(row=>SHEETS.includes(sheetOf(row))),statement=rows.filter(isStatement);
    const bySheet=summaries(supported);
    const summaryRows=SHEETS.map(name=>{const s=bySheet[name],issues=rows.filter(r=>sheetOf(r)===name&&['review','pending_next_day'].includes(r.kind)).length;return [name,providerOf(rows.find(r=>sheetOf(r)===name)?.account||name.split(' ')[0]),name.endsWith('ฝ')?'ฝาก':'ถอน',s.pmCount,s.pmCents/100,s.boCents/100,s.diffAfterCents/100,issues,statusOf(s,complete)];});
    const summaryTones=summaryRows.map(row=>row[6]!==0||row[7]>0?'warning':'');
    const statementHeaders=[...STATEMENT_HEADERS];
    const statementRows=statement.map((row,index)=>statementExportRow(row,index,company,date,complete));
    const sheets=[
      {name:'ข้อมูลทั้งหมด',headers:[...ALL_HEADERS],rows:allRows,...allTones,widths:[18,18,18,20,12,20,14,18,10,16,22,16,24,34,20,14,18,10,16,22,16,24,34,18,40,38,22,28],footerRows:[allTotal]},
      {name:'สรุป',headers:['ชีต','Provider','ประเภท','จำนวน STM/PM','รวมยอด STM/PM','รวมยอด BO','ผลต่าง','รายการต้องตรวจ','สถานะ'],rows:summaryRows,rowTones:summaryTones,widths:[12,16,12,16,20,20,18,18,20],footerRows:[['รวม','','',summaryRows.reduce((s,r)=>s+r[3],0),summaryRows.reduce((s,r)=>s+r[4],0),summaryRows.reduce((s,r)=>s+r[5],0),summaryRows.reduce((s,r)=>s+r[6],0),summaryRows.reduce((s,r)=>s+r[7],0),complete?'ครบตามรอบ':'ข้อมูลยังไม่ครบ']]},
      {name:'Statement',headers:statementHeaders,rows:statementRows,...exportTones(statement,complete,statementHeaders.length-1),widths:[8,12,14,20,12,20,16,20,10,16,24,24,20,16,18,24,20,18,40,16,26],footerRows:[totalRow(statementHeaders,statementRows,'ยอด Statement')]},
    ];
    for(const template of schema.sheets){const scoped=rows.filter(row=>sheetOf(row)===template.name),headers=[...template.headers,...AUDIT_HEADERS],data=scoped.map(row=>providerExportRow(template,row,complete));sheets.push({name:template.name,headers,rows:data,...exportTones(scoped,complete,headers.length-1),widths:headers.map(header=>!header?3:/Time|เวลา/.test(header)?20:/id|Ref|reference|system|transaction|merchant|รหัส/i.test(header)?24:/หมายเหตุ|เงื่อนไข/.test(header)?32:/สถานะ Audit/.test(header)?26:14),footerRows:[totalRow(headers,data,template.name.endsWith('ฝ')?'realAmount':/^(AT|M) /.test(template.name)?'transferredAmount':'amount')]});}
    sheets.forEach(sheet=>{sheet.headerStyle='template';});
    return sheets;
  }

  function tableView(rows,company,date,complete,sheet,schema=root.MC8SheetSchema){
    if(sheet==='statement')return {headers:[...STATEMENT_HEADERS],rows:rows.map((row,index)=>statementExportRow(row,index,company,date,complete))};
    if(SHEETS.includes(sheet)){
      const template=schema?.sheets?.find(item=>item.name===sheet);
      if(!template)throw new Error(`ไม่พบหัวตาราง ${sheet}`);
      return {headers:[...template.headers,...AUDIT_HEADERS],rows:rows.map(row=>providerExportRow(template,row,complete))};
    }
    return {headers:[...ALL_HEADERS],rows:rows.map(row=>allExportRow(row,complete))};
  }
  function headerTone(header,index,headers,sheet){
    if(header===null||header===undefined||header==='')return 'gap';
    if(sheet==='statement')return /Statement/.test(header)?'pm':/\bBO\b/.test(header)?'bo':'';
    if(SHEETS.includes(sheet)){
      const boStart=headers.indexOf('รหัส'),auditStart=headers.length-AUDIT_HEADERS.length;
      if(index<boStart)return 'pm';
      if(index<auditStart)return 'bo';
    }
    return '';
  }
  function renderCell(value,header=''){
    if(typeof value!=='number'||!Number.isFinite(value))return String(value??'');
    return /amount|ยอด|จำนวน|fee|realAmount|transferredAmount|ผลต่าง/i.test(String(header||''))?money(value):value.toLocaleString('en-US');
  }

  function mount(container,opts){
    const token={};slots.set(container,token);const alive=()=>slots.get(container)===token&&(opts.isActive?.()??true);
    const companies=(opts.companies||COMPANIES).filter(c=>COMPANIES.includes(c));
    let company=companies.includes(opts.company)?opts.company:(companies.includes(remembered.company)?remembered.company:companies[0]||'MC8');
    let date=remembered.date||opts.date||'2026-09-16',pm='all',direction='all',status='all',sheet='all',page=0,data=null,files=[],loading=false,error='',fileError='',generation=0;
    const labels={matched:'ระบบจับคู่แล้ว',advisory:'แจ้งข้อมูล · ไม่ต้องยืนยัน',pending_next_day:'ค้างรอข้อมูลข้ามวัน',review:'รอตรวจ / ชี้แจง',closed:'ปิดเคสแล้ว'};
    function isComplete(all){
      const evidence=Array.isArray(data?.run?.summary?.match_evidence)?data.run.summary.match_evidence.length:0,s=summarize(all);
      if(!data?.complete||!['completed','needs_review'].includes(data?.run?.jobStatus)||evidence<Number(data?.run?.matched||0))return false;
      if(Number.isFinite(Number(data.run.stm_count))&&s.pmCount!==Number(data.run.stm_count))return false;
      if(Number.isFinite(Number(data.run.bo_count))&&s.boCount!==Number(data.run.bo_count))return false;
      return true;
    }
    function draw(){
      if(!alive())return;
      const all=data?rowsOf(data,company):[],shown=filter(all,pm,direction,status,sheet),pages=Math.max(1,Math.ceil(shown.length/50));page=Math.min(page,pages-1);
      const complete=!!data?.run&&isComplete(all),bySheet=summaries(all),supported=all.filter(r=>SHEETS.includes(sheetOf(r))),scope=summarize(sheet==='all'?supported:sheet==='statement'?all.filter(isStatement):supported.filter(r=>sheetOf(r)===sheet));
      const evidence=Array.isArray(data?.run?.summary?.match_evidence)?data.run.summary.match_evidence.length:0,other=all.filter(r=>sheetOf(r)==='OTHER');
      const pageRows=shown.slice(page*50,page*50+50),view=tableView(pageRows,company,date,complete,sheet,root.MC8SheetSchema);
      const viewTabs=[['all','ข้อมูลทั้งหมด'],['summary','สรุป'],['statement','Statement'],...SHEETS.map(name=>[name,name])];
      container.innerHTML=`<section class="mc8-workbook"><header class="mc8-intro"><div><h2>ตาราง Audit · 5 บริษัท</h2><p>ผลกระทบยอด STM / PM กับ BO แยก 8 หน้าตามเทมเพลต Audit</p></div><span class="mc8-pending">${esc(company)}</span></header>
        <p class="mc8-note">อ่านผลรอบงานที่บันทึกไว้เท่านั้น · ไม่รันกติกาใหม่ ไม่ปิดเคส และไม่นำไฟล์ตัวอย่างมาแทนข้อมูลจริง</p>
        <div class="mc8-filters"><label>บริษัท<select id="mc8-live-company" ${loading?'disabled':''}>${companies.map(c=>`<option value="${c}" ${company===c?'selected':''}>${c}</option>`).join('')}</select></label><label>วันที่ตรวจ<input type="date" id="mc8-live-date" value="${esc(date)}" ${loading?'disabled':''}></label><button id="mc8-live-load" ${loading?'disabled':''}>${loading?'กำลังโหลด…':'โหลดข้อมูลจริง'}</button>${data?.run?'<button id="mc8-live-export">ออก Excel ตามแบบ Audit</button>':''}${company==='MC8'?'<button id="mc8-local-view">เทียบไฟล์ Excel ต้นแบบ MC8</button>':''}</div>
        ${error?`<p role="alert">${esc(error)}</p>`:''}
        ${data?.run?`<p>วันที่ผลที่โหลด: <strong>${esc(date)}</strong> · Run: ${esc(data.run.id)} · สถานะงาน: ${esc(data.run.jobStatus)}</p><p>ระบบรายงานจับคู่ ${esc(data.run.matched??'ไม่ระบุ')} คู่ · มีหลักฐานคู่ ${evidence} คู่ · โหลด ${data.cases.length} เคส</p>${!complete?'<p role="alert" class="mc8-warning">ผลหรือหลักฐานยังไม่ครบ หรือจำนวนที่สร้างใหม่ไม่ตรงกับรอบงาน ห้ามใช้ยอดนี้ยืนยันปิดงาน</p>':''}${other.length?`<p role="alert" class="mc8-warning">มี ${other.length} แถวที่จัดเข้า AT / AZ / CP / M ไม่ได้ จึงไม่ปนในยอดรวม 8 หน้า</p>`:''}
        <section class="mc8-summary" id="mc8-live-summary"><h3>สรุปยอดแยกทุกหน้า</h3><div class="mc8-summary-scroll"><table><thead><tr><th>หน้า</th><th>STM / PM<br>รายการ / ยอด</th><th>BO<br>รายการ / ยอด</th><th>จับคู่แล้ว</th><th>ไม่จับคู่ PM</th><th>ไม่จับคู่ BO</th><th>ข้ามวัน</th><th>ซ้ำ / กำกวม</th><th>ต่างก่อนข้ามวัน</th><th>ต่างหลังข้ามวัน</th><th>สถานะ</th></tr></thead><tbody>${SHEETS.map(name=>summaryRow(name,bySheet[name],complete)).join('')}</tbody>${summaryFooter(supported,complete)}</table></div><p>จำนวนและยอดคั่นด้วย / · กดชื่อหน้าเพื่อเปิดรายละเอียด · แถวรวมอยู่ท้ายตารางเหมือน Excel</p></section>
        <div class="mc8-tabs" role="tablist" aria-label="หน้า Audit">${viewTabs.map(([value,label])=>`<button type="button" role="tab" aria-selected="${sheet===value}" data-live-sheet="${esc(value)}">${esc(label)}<small>${value==='all'?'ทุกสถานะ':value==='summary'?'ภาพรวม':value==='statement'?'STM ธนาคาร':value.endsWith('ฝ')?'ฝาก':'ถอน'}</small></button>`).join('')}</div>
        <div class="mc8-filters"><label>PM<select id="mc8-live-pm"><option value="all">ทุก PM</option>${[...new Set(all.map(r=>r.account))].sort().map(a=>`<option ${pm===a?'selected':''} value="${esc(a)}">${esc(a)}</option>`).join('')}</select></label><label>ประเภท<select id="mc8-live-direction">${[['all','ฝากและถอน'],['deposit','ฝาก'],['withdraw','ถอน']].map(([v,t])=>`<option value="${v}" ${direction===v?'selected':''}>${t}</option>`).join('')}</select></label><label>ผลตรวจ<select id="mc8-live-status">${[['all','ทั้งหมด'],...Object.entries(labels)].map(([v,t])=>`<option value="${v}" ${status===v?'selected':''}>${t}</option>`).join('')}</select></label></div>
        ${sheet==='summary'?'<p class="mc8-summary-focus">หน้าสรุปแสดงจำนวนและยอดของทั้ง 8 หน้า พร้อมแถวรวมท้ายตารางด้านบน</p>':`<p role="status">แสดง ${shown.length} แถว · หน้า ${page+1}/${pages}</p><div class="mc8-scroll" tabindex="0" aria-label="ตาราง ${esc(sheet==='all'?'ข้อมูลทั้งหมด':sheet)}"><table class="mc8-grid"><thead><tr>${view.headers.map((header,index)=>`<th class="${headerTone(header,index,view.headers,sheet)}">${esc(header)||' '}</th>`).join('')}</tr></thead><tbody>${view.rows.map((values,rowIndex)=>{const source=pageRows[rowIndex],status=auditStatus(source,complete),tone=toneOf(status);return `<tr class="mc8-${tone}">${values.map((value,index)=>{const displayed=renderCell(value,view.headers[index]);return `<td class="${headerTone(view.headers[index],index,view.headers,sheet)}" title="${esc(displayed)}">${esc(displayed)||'—'}${index===values.length-1&&source.case?` <button data-live-case="${esc(source.key)}">เปิดเคสจริง</button>`:''}</td>`;}).join('')}</tr>`;}).join('')||`<tr><td colspan="${view.headers.length}">ไม่พบรายการตามตัวกรอง</td></tr>`}</tbody></table></div><div class="mc8-filters"><button id="mc8-live-prev" ${page===0?'disabled':''}>ก่อนหน้า</button><button id="mc8-live-next" ${page+1>=pages?'disabled':''}>ถัดไป</button></div>${totalsPanel(sheet==='all'?'ข้อมูลทั้งหมด':sheet,scope,complete)}`}
        <details><summary>ไฟล์ต้นทางของผลรอบนี้ (${files.length})</summary>${fileError?`<p role="alert">${esc(fileError)}</p>`:''}<ul>${files.map(f=>`<li>${esc(f.file_name)} · ${esc(f.kind)} ${opts.onFile?`<button data-live-file="${esc(f.id)}">ดูไฟล์ต้นทาง</button>`:''}</li>`).join('')}</ul></details>`:!loading&&!error?`<p>ยังไม่มีผลกระทบยอดที่อ่านได้ของ ${esc(company)} ในวันที่เลือก</p>`:''}</section>`;
      container.querySelector('#mc8-live-company').onchange=e=>{company=e.target.value;remembered.company=company;opts.onCompany?.(company);sheet='all';pm='all';load();};
      container.querySelector('#mc8-live-load').onclick=()=>{const v=container.querySelector('#mc8-live-date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){error='กรุณาเลือกวันที่';draw();return;}date=v;remembered.date=v;opts.onDate?.(date);load();};
      const local=container.querySelector('#mc8-local-view');if(local)local.onclick=()=>{slots.delete(container);opts.onLocal?.();};
      if(!data?.run)return;
      const exportButton=container.querySelector('#mc8-live-export');if(exportButton)exportButton.onclick=()=>{
        try{
          const sheets=buildAuditExportSheets(all,company,date,complete,root.MC8SheetSchema);
          const filename=`Audit_${company}_${date}_AllCases.xlsx`;
          const result=opts.exportWorkbook?.(sheets,filename,`บริษัท ${company} · วันที่ ${date} · ข้อมูลครบทุกสถานะ`);
          if(!result?.ok)throw new Error(result?.reason||'ตัวเขียน Excel ยังไม่พร้อม');
          opts.onExported?.({filename,company,date,rows:all.length,sheets:sheets.length,complete});
        }catch(e){error=`ออก Excel ไม่สำเร็จ: ${e.message}`;draw();}
      };
      for(const key of ['pm','direction','status'])container.querySelector(`#mc8-live-${key}`).onchange=e=>{if(key==='pm')pm=e.target.value;else if(key==='direction')direction=e.target.value;else status=e.target.value;page=0;draw();};
      container.querySelectorAll('[data-live-sheet]').forEach(b=>b.onclick=()=>{sheet=b.dataset.liveSheet;page=0;draw();});
      const prev=container.querySelector('#mc8-live-prev'),next=container.querySelector('#mc8-live-next');if(prev)prev.onclick=()=>{page--;draw();};if(next)next.onclick=()=>{page++;draw();};
      container.querySelectorAll('[data-live-case]').forEach(b=>b.onclick=()=>opts.onCase?.(all.find(r=>r.key===b.dataset.liveCase)?.case,company));
      container.querySelectorAll('[data-live-file]').forEach(b=>b.onclick=()=>opts.onFile?.(files.find(f=>f.id===b.dataset.liveFile),date,company));
    }
    async function load(){
      const g=++generation;data=null;files=[];error='';fileError='';loading=true;page=0;draw();
      try{if(!opts.signedIn())throw new Error('กรุณาเข้าสู่ระบบจริงก่อนอ่านข้อมูล Audit');const next=await opts.load(company,date);if(!alive()||g!==generation)return;if(!Array.isArray(next?.cases))throw new Error('รูปแบบผลกระทบยอดไม่ถูกต้อง');data=next;if(next.run?.id&&opts.loadFiles){try{files=await opts.loadFiles(next.run.id);}catch(e){fileError=`โหลดทะเบียนไฟล์ไม่ได้: ${e.message}`;}}}catch(e){error=e.message;}finally{if(alive()&&g===generation){loading=false;draw();}}
    }
    load();
  }
  root.MC8LiveSheets={mount,rowsOf,filter,providerOf,sheetOf,summarize,summaries,auditStatus,buildAuditExportSheets,tableView,COMPANIES,SHEETS,ALL_HEADERS,STATEMENT_HEADERS};
  if(typeof module!=='undefined')module.exports=root.MC8LiveSheets;
})(typeof window==='undefined'?globalThis:window);
