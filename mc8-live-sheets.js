/* Read-only Audit workbook view of persisted reconciliation evidence. */
(function(root){
  'use strict';
  const auditPolicy=root.AuditVisiblePolicy||(typeof require==='function'?require('./audit-visible-policy.js'):null);
  const registryCatalog=root.Registry||(typeof require==='function'?require('./registry.js'):null);
  const COMPANIES=Object.freeze(['3XB','MC8','MR9','PS8','UR9','AT4','FR8','SK8','UFABET7M']);
  const BASE_SHEETS=Object.freeze(['AT ถ','AT ฝ','AZ ถ','AZ ฝ','CP ถ','CP ฝ','M ถ','M ฝ']);
  const LOCALPAY_SHEETS=Object.freeze(['LP ถ','LP ฝ']);
  const ANT_SHEETS=Object.freeze(['ANT ถ','ANT ฝ']);
  const BORROW_SHEET='ยืม PM บริษัทอื่น';
  const isBorrowAccount=value=>/ยืม\s*PM\s*(?:บ้านอื่น|บริษัทอื่น|ต่างบริษัท)/i.test(String(value||''));
  const XB_COMPANIES=Object.freeze(['3XB','MC8','MR9','PS8','UR9']);
  const SEVEN_M_SHEETS=Object.freeze(['AT ถ','AT ฝ','CP ถ','CP ฝ','CY ถ','CY ฝ','AZ ฝ','M ถ','M ฝ','LO ถ','LO ฝ']);
  const SYS123_SHEETS=Object.freeze(['AT ถ','AT ฝ','AZ ฝ','CP ถ','CP ฝ','CY ถ','CY ฝ','LP ถ','LP ฝ']);
  const SHEETS=Object.freeze([...new Set([...BASE_SHEETS,...LOCALPAY_SHEETS,...ANT_SHEETS,...SEVEN_M_SHEETS,...SYS123_SHEETS,BORROW_SHEET])]);
  const AUDIT_HEADERS=Object.freeze(['เงื่อนไขที่จับคู่','ต่างเวลา','ผลต่างยอด','สถานะ Audit']);
  const BO_HEADERS=Object.freeze(['รหัส','เวลา','ประเภท','ประเภทดำเนินการ','ยูสเซอร์','ธนาคาร','จำนวน','จำนวนที่ได้รับ','ค่าธรรรมเนียม','เวลาทำรายการ','หมายเหตุ','ผู้ดำเนินการ']);
  const BO_COMPACT_HEADERS=Object.freeze(['เวลา','ประเภท','ยูสเซอร์','บัญชี','บัญชีบริษัท','ยอดเงิน','โบนัส','โน้ต','ผู้ดำเนินการ','แก้ไข']);
  const SEVEN_M_LEFT=Object.freeze({
    'AT ถ':['วันที่','Ref','Username','ธนาคาร','เลขบัญชี','ชื่อ - นามสกุล ผู้รับ','แจ้งถอน','P2P จ่าย','Progress','Status'],
    'AT ฝ':['วันที่','Ref','Username','ธนาคาร','สร้างฝาก','โอนจริง','Status'],
    'CP ถ':['วันที่ทำรายการ','วันเวลาอัพเดต','Ref Id','ธนาคาร','เลขบัญชี','ชื่อ - นามสกุล ผู้รับ','ยูสเซอร์','จำนวนเงิน','ค่าธรรมเนียม','รวมหักเงิน','สถานะ'],
    'CP ฝ':['วันที่ทำรายการ','Ref Id','user ที่ฝาก','จำนวนที่ฝาก','จำนวนที่ได้รับ','เลขบัญชีที่โอน','ธนาคารต้นทาง','สถานะ'],
    'CY ถ':['วันที่ทำรายการ','วันเวลาอัพเดต','Ref Id','ธนาคาร','เลขบัญชี','ชื่อ - นามสกุล ผู้รับ','ยูสเซอร์','จำนวนเงิน','ค่าธรรมเนียม','รวมหักเงิน','สถานะ'],
    'CY ฝ':['วันที่ทำรายการ','Ref Id','user ที่ฝาก','จำนวนเงิน','เลขบัญชีที่โอน','ธนาคารต้นทาง','สถานะ'],
    'AZ ฝ':['วันที่ทำรายการ','Ref Id','Payment Id','user ที่ฝาก','จำนวนเงิน','เลขบัญชีที่โอน','ธนาคารต้นทาง','สถานะ'],
    'M ถ':['วันที่ทำรายการ','วันเวลาอัพเดต','Ref Id','Payment Id','ธนาคาร','เลขบัญชี','ชื่อ - นามสกุล ผู้รับ','ยูสเซอร์','จำนวนเงิน','ค่าธรรมเนียม','รวมหักเงิน','สถานะ'],
    'M ฝ':['วันที่ทำรายการ','Ref Id','Payment Id','user ที่ฝาก','จำนวนเงิน','เลขบัญชีที่โอน','ธนาคารต้นทาง','สถานะ'],
    'LO ถ':['วันที่ทำรายการ','วันเวลาอัพเดต','Ref Id','Payment Id','ธนาคาร','เลขบัญชี','ชื่อ - นามสกุล ผู้รับ','ยูสเซอร์','จำนวนเงิน','ค่าธรรมเนียม','รวมหักเงิน','สถานะ'],
    'LO ฝ':['วันที่ทำรายการ','Ref Id','Payment Id','user ที่ฝาก','จำนวนเงิน','เลขบัญชีที่โอน','ธนาคารต้นทาง','สถานะ'],
  });
  const SYS123_LEFT=Object.freeze({
    'AT ถ':['วัน/เวลา','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินถอน','สถานะ'],
    'AT ฝ':['วัน/เวลา','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินฝาก','สถานะ'],
    'AZ ฝ':['วัน/เวลา','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินฝาก','สถานะ'],
    'CP ถ':['วัน/เวลา','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินถอน','สถานะ'],
    'CP ฝ':['วัน/เวลา','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินฝาก','สถานะ'],
    'CY ถ':['วัน/เวลา','รหัสสมาชิก','จำนวนเงินถอน','สถานะ'],
    'CY ฝ':['วัน/เวลา','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินฝาก','สถานะ'],
    'LP ถ':['วัน/เวลา','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินถอน','สถานะ'],
    'LP ฝ':['วัน/เวลา','รหัสสมาชิก','เลขบัญชีสมาชิก','จำนวนเงินฝาก','สถานะ'],
  });
  const ALL_HEADERS=Object.freeze(['ผลตรวจระบบ','สถานะ Audit','เลขเคส','บัญชีบริษัท / Provider','ประเภท','STM/PM · วัน / เวลา','STM/PM · ยอด','STM/PM · บัญชีลูกค้า','STM/PM · ท้าย 4','STM/PM · ธนาคารลูกค้า','STM/PM · ชื่อ / User','STM/PM · User','STM/PM · อ้างอิง','STM/PM · รายละเอียดต้นฉบับ','BO · วัน / เวลา','BO · ยอด','BO · บัญชีลูกค้า','BO · ท้าย 4','BO · ธนาคารลูกค้า','BO · ชื่อ / User','BO · User','BO · อ้างอิง','BO · รายละเอียดต้นฉบับ','ต่างเวลา','เหตุผลระบบ','หมายเหตุ Audit','เอกสารอ้างอิง','ผลต่างยอด','สถานะสำหรับเทียบทีมกระทบมือ']);
  const STATEMENT_HEADERS=Object.freeze(['ลำดับ','บริษัท','วันที่','บัญชี Statement','ประเภท','วัน / เวลา Statement','ยอด Statement','บัญชีลูกค้า','ท้าย 4','ธนาคาร','ชื่อ / User Statement','เลขอ้างอิง Statement','วัน / เวลา BO','ยอด BO','User BO','ชื่อ / User BO','เลขอ้างอิง BO','ต่างเวลา','เงื่อนไขที่จับคู่','ผลต่างยอด','สถานะ Audit']);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numeric=v=>v===null||v===undefined||typeof v==='boolean'||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
  const cents=v=>{const n=numeric(v);return n===null?null:Math.round(n*100);};
  const money=v=>v===null||v===undefined||v===''?'—':numeric(v)===null?'อ่านยอดไม่ได้':Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const moneyCents=v=>money(v/100);
  const slots=new WeakMap(),remembered={date:'',company:''};

  function directionOf(value){const s=String(value||'').trim().toLowerCase();return s==='deposit'||s==='ฝาก'?'deposit':s==='withdraw'||s==='ถอน'?'withdraw':s;}
  function providerOf(value){
    const s=String(value||'').trim().toUpperCase();
    if(/(?:^|[^A-Z0-9])(?:ANT|ANYPAY)(?=$|[^A-Z0-9])/.test(s))return 'ANT';
    if(/AUTOPEER|\bATP\b/.test(s))return 'AT';
    if(/AZPAY|\bAZP?\b/.test(s))return 'AZ';
    if(/COREPAY|CPPAY|CP2|CPXM|\bCP\b/.test(s))return 'CP';
    if(/CYBERPLUS|CYNERPLUS|\bCBY\b|\bCY\b/.test(s))return 'CY';
    if(/MYPAY|\bM24\b|MYPAYS24/.test(s))return 'M';
    if(/LOCALPAY|LOCELPAY|\bLP\b/.test(s))return 'LP';
    return 'OTHER';
  }
  function providerOfRow(row){
    const direct=providerOf(row?.account);
    if(direct!=='OTHER')return direct;
    const pmRef=String(row?.pm?.reference||'').trim().toUpperCase();
    if(/(?:^|[-_])CP$/.test(pmRef))return 'CP';
    return 'OTHER';
  }
  function isSevenM(value){return ['7M','UFABET7M'].includes(String(value||'').toUpperCase());}
  function isSys123(value){return ['AT4','FR8','SK8'].includes(String(value||'').toUpperCase());}
  function sheetOf(row){if(isBorrowAccount(row?.account)&&['deposit','withdraw'].includes(directionOf(row?.direction)))return BORROW_SHEET;let p=providerOfRow(row),d=directionOf(row?.direction);if(p==='LP'&&isSevenM(row?.company))p='LO';return p==='OTHER'||!['deposit','withdraw'].includes(d)?'OTHER':`${p} ${d==='deposit'?'ฝ':'ถ'}`;}
  function stamp(t){return t?.date?`${t.date} ${t.noTime?'(ไม่มีเวลา)':Number.isFinite(t.sec)&&t.sec>=0&&t.sec<86400?new Date(t.sec*1000).toISOString().slice(11,19):''}`.trim():'';}
  function chronologicalRows(rows){
    const key=value=>String(value||'').trim();
    return rows.map((row,index)=>({row,index})).sort((a,b)=>{
      const aPm=key(a.row.pmTime),bPm=key(b.row.pmTime),aBo=key(a.row.boTime),bBo=key(b.row.boTime);
      const primary=(aPm||aBo).localeCompare(bPm||bBo,'en',{numeric:true});
      if(primary)return primary;
      const secondary=aBo.localeCompare(bBo,'en',{numeric:true});
      return secondary||a.index-b.index;
    }).map(item=>item.row);
  }
  function realRaw(value){const s=String(value||'').trim();return s&&!/^[—–-]|^ไม่พบรายการ|^รอข้อมูล|^ไม่มีข้อมูล/i.test(s)?s:'';}
  function sapanProviderId(value){const hit=String(value??'').match(/\b(?:sapan|spean)\s*[:：]?\s*(6aa[a-f0-9]{21})\b/i);return hit?hit[1].toLowerCase():'';}
  async function hydrateBoOperators(data,files,readRows){
    const names={};
    data.borrowBo=[];
    if(typeof readRows!=='function')return;
    const company=data?.run?.company;
    const needed=new Set([
      ...(data?.run?.summary?.match_evidence||[]).filter(p=>!p.customer?.bo?.performedBy).map(p=>p.bo?.fileId),
      ...(data?.cases||[]).filter(e=>!e.customer_details?.bo?.performedBy).map(e=>e.customer_details?.source_rows?.bo?.fileId)
    ].filter(Boolean));
    const errors=[];
    for(const file of files.filter(f=>f.kind==='bo_main'&&f.parsed&&!f.parse_error&&f.company===company)){
      try{
        const result=await readRows(file,data.run.business_date);
        if(!Array.isArray(result))throw new Error('ข้อมูลต้นทางไม่ใช่รายการ BO');
        for(const r of result){
          const account=r.boIdentityRaw||r.account||'';
          if(r.company===company&&(r.boDate||r.date)===data.run.business_date&&r.kind!=='bookkeeping'&&(!r.originalType||/^(ฝาก|ถอน|deposit|withdraw)$/i.test(r.originalType.trim()))&&isBorrowAccount(account)&&['deposit','withdraw'].includes(directionOf(r.direction))&&numeric(r.amount)!==null&&Number.isInteger(r.rowNo)&&r.rowNo>0){
            data.borrowBo.push({company,account,direction:r.direction,systemAmount:r.amount,boDate:r.boDate||r.date,
              boTime:stamp({date:r.boDate||r.date,sec:r.boSec??r.sec}).slice(11),boRaw:r.raw||'',
              boSource:{fileId:file.id,row:r.rowNo,fileName:file.file_name},
              customerDetails:{bo:{reference:r.ref,user:r.memberCode,account:r.custAccount,bank:account,note:r.note,performedBy:r.performedBy||r.username,origin:r.origin||''}},
              detail:'BO ต้นทาง · ยืม PM บริษัทอื่น · ยังไม่กระทบยอด'});
          }
          const name=String(r.performedBy||r.username||'').trim();
          if(r.company===company&&Number.isInteger(r.rowNo)&&r.rowNo>0&&name&&!/^(—|–|-|ไม่ระบุ)$/.test(name))names[`${file.id}|${r.rowNo}`]=name;
        }
      }catch(e){errors.push(`${file.file_name}: ${e.message}`);}
    }
    data.boOperators=names;
    return errors;
  }
  function normalizedBo(bo,raw='',sourceOperator=''){
    const source=bo&&typeof bo==='object'?bo:{};
    const providerReference=String(source.providerReference||'').trim().toLowerCase()||sapanProviderId(source.note)||sapanProviderId(raw);
    const performedBy=source.performedBy||sourceOperator||'';
    return {...source,performedBy,...(providerReference?{providerReference,note:providerReference}:{})};
  }
  function uniqueProviderId(value){
    const ids=[...new Set(String(value??'').toLowerCase().match(/\b6aa[a-f0-9]{21}\b/g)||[])];
    return ids.length===1?ids[0]:'';
  }
  function normalizedPm(pm,raw='',fallbackProviderReference=''){
    const source=pm&&typeof pm==='object'?pm:{};
    const providerReference=String(source.providerReference||'').trim().toLowerCase()||uniqueProviderId(raw)||String(fallbackProviderReference||'').trim().toLowerCase();
    if(!providerReference)return source;
    const firstCell=String(raw||'').split(/\s*\|\s*/)[0]?.trim()||'';
    const sourceId=source.sourceId||source.transactionReference||(/^P2C-/i.test(firstCell)?firstCell:'');
    return {...source,providerReference,...(sourceId?{sourceId}:{} )};
  }

  function rowsOf(data,fallbackCompany=''){
    const pairs=Array.isArray(data?.run?.summary?.match_evidence)?data.run.summary.match_evidence:[];
    const rawCases=Array.isArray(data?.cases)?data.cases:[];
    const cases=(auditPolicy?auditPolicy.filter(rawCases,pairs):rawCases).filter(e=>!(
      e.status==='closed' && e.auto_closed===true
      && e.closure_rule==='scb-overlap-duplicate-source-verified'
      && e.resolved_by==='system:scb-overlap-repair'
    ));
    // Verified duplicate alerts are retained in case history/Audit Log, not
    // rendered as additional financial transactions in sheets and exports.
    const pairRows=pairs.map((p,index)=>{const bo=normalizedBo(p.customer?.bo,'',data.boOperators?.[`${p.bo?.fileId}|${p.bo?.row}`]);return {key:`pair-${index}`,isPair:true,kind:'matched',company:p.company||fallbackCompany,account:p.account||'ไม่ระบุ PM',direction:directionOf(p.direction),bo,pm:normalizedPm(p.customer?.stm,p.stm?.raw,bo.providerReference),boAmount:p.boAmount??p.amount,pmAmount:p.stmAmount??p.amount,boTime:stamp(p.bo),pmTime:stamp(p.stm),boDate:p.bo?.date||'',pmDate:p.stm?.date||'',crossDay:!!p.crossDay||!!(p.bo?.date&&p.stm?.date&&p.bo.date!==p.stm.date),reason:p.method||'ผลจับคู่ที่บันทึกไว้',boSource:p.bo,pmSource:p.stm,code:`คู่ ${index+1}`,exType:''};});
    const caseRows=cases.map(e=>{const bo=normalizedBo(e.customer_details?.bo,e.bo_raw,data.boOperators?.[`${e.customer_details?.source_rows?.bo?.fileId}|${e.customer_details?.source_rows?.bo?.row}`]);return {key:e.id,isPair:false,kind:e.status==='closed'?'closed':e.status==='pending_next_day'?'pending_next_day':'review',company:e.company||fallbackCompany,account:e.account||'ไม่ระบุ PM',direction:directionOf(e.direction),bo,pm:normalizedPm(e.customer_details?.stm,e.stm_raw,bo.providerReference),boAmount:e.system_amount,pmAmount:e.bank_amount,boTime:[e.bo_date,e.bo_time].filter(Boolean).join(' '),pmTime:[e.stm_date,e.stm_time].filter(Boolean).join(' '),boDate:e.bo_date||'',pmDate:e.stm_date||'',crossDay:e.ex_type==='cross_day'||!!(e.bo_date&&e.stm_date&&e.bo_date!==e.stm_date),reason:e.resolution_note||e.detail||e.type_name||e.ex_type||'',boRaw:e.bo_raw||'',pmRaw:e.stm_raw||'',code:e.code||e.id,exType:e.ex_type||'',case:e};});
    // A closed BBL carry-over is history of an existing matched transaction,
    // not another BO row. Link only a unique, fully identified saved pair.
    const linkedPairs=new Set(),remainingCases=[];
    for(const row of caseRows){
      const e=row.case,ref=String(row.bo.reference||'').trim(),user=String(row.bo.user||'').trim();
      const closedCrossDay=e.status==='closed'&&e.auto_closed===true&&e.ex_type==='cross_day'
        &&e.closure_rule==='reserved-unique-bo-identity-match'
        &&e.closing_run_id===data?.run?.id&&ref&&user;
      const crossDayHits=closedCrossDay?pairRows.filter(p=>p.company===row.company
        &&p.account===row.account&&p.direction===row.direction
        &&cents(p.boAmount)===cents(row.boAmount)
        &&String(p.bo.reference||'').trim()===ref&&String(p.bo.user||'').trim()===user
        &&(p.boSource?.boDate||p.boDate)===(e.bo_date||e.business_date)
        &&p.pmSource?.fileId&&p.pmSource?.row!==null&&p.pmSource?.row!==undefined):[];
      if(crossDayHits.length===1&&!linkedPairs.has(crossDayHits[0])){
        const pair=crossDayHits[0];linkedPairs.add(pair);
        pair.case=e;pair.code=row.code;pair.kind='closed';pair.exType='cross_day';
        pair.reason=[pair.reason,'ปิดเคสข้ามวันโดยระบบ',e.resolution_note].filter(Boolean).join(' · ');
        continue;
      }
      // A manual-review case describes an already matched pair, not a third
      // transaction. Merge only the uniquely identified pair, retaining the
      // open case and evidence requirement; never hide the excess BO row.
      const manualHits=e.ex_type==='manual_review'&&ref&&user&&row.boDate&&row.boTime&&row.pmDate&&row.pmTime
        ? pairRows.filter(p=>p.company===row.company&&p.account===row.account&&p.direction===row.direction
          &&p.boTime===row.boTime&&p.pmTime===row.pmTime
          &&cents(p.boAmount)===cents(row.boAmount)&&cents(p.pmAmount)===cents(row.pmAmount)
          &&String(p.bo.reference||'').trim()===ref&&String(p.bo.user||'').trim()===user)
        : [];
      if(manualHits.length===1&&!linkedPairs.has(manualHits[0])){
        const pair=manualHits[0];linkedPairs.add(pair);
        pair.case=e;pair.code=row.code;pair.exType='manual_review';pair.kind=row.kind;
        pair.reason=row.reason;pair.boRaw=row.boRaw;pair.pmRaw=row.pmRaw;
        continue;
      }
      const hits=e.status==='closed'&&e.closure_rule==='bbl-continuity-exact-bo-evidence'&&ref&&user&&row.boDate&&row.boTime
        ? pairRows.filter(p=>p.company===row.company&&p.account===row.account&&p.direction===row.direction&&p.boDate===row.boDate&&p.boTime===row.boTime&&cents(p.boAmount)===cents(row.boAmount)&&String(p.bo.reference||'').trim()===ref&&String(p.bo.user||'').trim()===user&&p.pmSource?.fileId&&p.pmSource?.row!==null&&p.pmSource?.row!==undefined)
        : [];
      if(hits.length!==1||linkedPairs.has(hits[0])){remainingCases.push(row);continue;}
      const pair=hits[0];linkedPairs.add(pair);
      pair.case=e;pair.code=row.code;pair.kind='closed';
      pair.reason=[pair.reason,'หลักฐานปิดเคสย้อนหลัง',e.resolution_note,`STM ไฟล์ ${pair.pmSource.fileId} · แถว ${pair.pmSource.row}`].filter(Boolean).join(' · ');
      if(pair.pmSource.noTime)pair.pmTime=`${pair.pmDate} (ไม่มีเวลา)`;
    }
    const financialRows=[...pairRows,...remainingCases];
    const foldedAlerts=new Set();
    financialRows.filter(row=>row.exType==='duplicate'&&row.case?.status!=='closed').forEach(alert=>{
      // Legacy Rules alerts hold both BO UUIDs in raw text. Link only when
      // BOTH UUIDs independently resolve to one real transaction each within
      // this company/account/direction. Never fold by equal amounts or time.
      const refs=[...new Set(String(alert.boRaw||'').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)||[])];
      if(refs.length!==2)return;
      const hits=refs.map(ref=>financialRows.filter(row=>row!==alert&&row.exType!=='duplicate'
        &&row.company===alert.company&&row.account===alert.account&&row.direction===alert.direction
        &&String(row.bo?.reference||'').toLowerCase()===ref.toLowerCase()
        &&cents(row.boAmount)===cents(alert.boAmount)));
      if(hits.some(rows=>rows.length!==1)||hits[0][0]===hits[1][0])return;
      const target=hits[1][0];
      (target.relatedAlerts ||= []).push(alert.case);
      target.reason=[target.reason,'สงสัยเติมซ้ำ — ต้องตรวจ STM ไม่ใช่ความเสียหายที่ยืนยันแล้ว',`คำเตือน ${alert.code}`].filter(Boolean).join(' · ');
      foldedAlerts.add(alert);
    });
    const visibleRows=financialRows.filter(row=>!foldedAlerts.has(row));
    const borrowSources=new Map((data.borrowBo||[]).map(e=>[`${e.boSource.fileId}|${e.boSource.row}`,e]));
    for(const row of visibleRows){
      const source=row.boSource||row.case?.customer_details?.source_rows?.bo;
      const original=borrowSources.get(`${source?.fileId}|${source?.row}`);
      if(original&&row.company===original.company&&directionOf(row.direction)===directionOf(original.direction)&&cents(row.boAmount)===cents(original.systemAmount)){
        row.account=original.account;row.boSource={...source,fileName:original.boSource.fileName};
      }
    }
    const representedBo=new Set(visibleRows.map(row=>sideKey(row,'bo')).filter(Boolean));
    const sourceIdentity=row=>{
      const source=row.boSource||row.case?.customer_details?.source_rows?.bo;
      return source?.fileId&&source.row!==null&&source.row!==undefined
        ?`${row.company}|${row.account}|${row.direction}|${source.fileId}|${source.row}`:'';
    };
    const representedSources=new Set(visibleRows.map(sourceIdentity).filter(Boolean));
    const snapshot=data?.run?.boWaitingSnapshot;
    const waitingBo=snapshot?.company===fallbackCompany&&snapshot?.business_date===data?.run?.business_date&&Array.isArray(snapshot.waiting_bo)
      ?snapshot.waiting_bo:Array.isArray(data?.run?.summary?.waiting_bo)?data.run.summary.waiting_bo:[];
    for(const [index,e] of [...waitingBo,...(data.borrowBo||[])].entries()){
      if(e.company&&fallbackCompany&&e.company!==fallbackCompany)continue;
      const boSource=e.boSource||e.customerDetails?.source_rows?.bo;
      const row={key:`waiting-bo-${index}`,isPair:false,kind:'waiting_source',waiting:true,
        company:e.company||fallbackCompany,account:e.account||'ไม่ระบุ PM',direction:directionOf(e.direction),
        bo:normalizedBo(e.customerDetails?.bo,e.boRaw,data.boOperators?.[`${boSource?.fileId}|${boSource?.row}`]),pm:{},
        boAmount:e.systemAmount,pmAmount:null,boDate:e.boDate||e.date||'',pmDate:'',
        boTime:[e.boDate||e.date,e.boTime||e.time].filter(Boolean).join(' '),pmTime:'',
        boSource,pmSource:null,boRaw:e.boRaw||'',pmRaw:'',crossDay:false,
        code:'ยังไม่สร้างเคส',exType:'waiting_source',reason:e.detail||'อ่าน BO แล้ว · ยังไม่มี STM/PM'};
      const key=sideKey(row,'bo');
      const source=sourceIdentity(row);
      if(key&&!representedBo.has(key)&&(!source||!representedSources.has(source))){
        visibleRows.push(row);representedBo.add(key);if(source)representedSources.add(source);
      }
    }
    return visibleRows;
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
    rows.filter(r=>(r.relatedAlerts||[]).some(e=>e.status!=='closed')
      ||(r.kind!=='closed'&&(r.case?.customer_details?.reviewAlerts||[]).some(e=>e.type==='suspected_duplicate'))
      ||(!r.isPair&&/duplicate|ambig|ซ้ำ|กำกวม/i.test(`${r.exType} ${r.reason}`))).forEach(r=>{const key=sideKey(r,'bo')||sideKey(r,'pm')||r.key;if(!duplicate.has(key))duplicate.set(key,r);});
    const total=(map,side)=>[...map.values()].reduce((sum,r)=>sum+(cents(r[`${side}Amount`])||0),0);
    const pmCents=total(pm,'pm'),boCents=total(bo,'bo'),crossDayBoCents=total(crossDay,'bo');
    const waitingBo=uniqueSides(rows.filter(r=>r.waiting),'bo'),waitingBoCents=total(waitingBo,'bo');
    return {pmCount:pm.size,pmCents,boCount:bo.size,boCents,waitingBoCount:waitingBo.size,waitingBoCents,matchedCount:matched.length,matchedPmCents:matched.reduce((s,r)=>s+(cents(r.pmAmount)||0),0),matchedBoCents:matched.reduce((s,r)=>s+(cents(r.boAmount)||0),0),unmatchedPmCount:unmatchedPm.size,unmatchedPmCents:total(unmatchedPm,'pm'),unmatchedBoCount:unmatchedBo.size,unmatchedBoCents:total(unmatchedBo,'bo'),crossDayCount:crossDay.size,crossDayBoCents,duplicateCount:duplicate.size,duplicateCents:[...duplicate.values()].reduce((s,r)=>s+(cents(r.boAmount)??cents(r.pmAmount)??0),0),diffBeforeCents:pmCents-(boCents-crossDayBoCents-waitingBoCents),diffAfterCents:pmCents-(boCents-waitingBoCents)};
  }
  function providerSheets(company,rows=[]){
    if(isSevenM(company))return [...SEVEN_M_SHEETS,BORROW_SHEET];
    if(isSys123(company))return [...SYS123_SHEETS,BORROW_SHEET];
    const names=company==='3XB'||rows.some(row=>providerOf(row.account)==='LP')?[...BASE_SHEETS,...LOCALPAY_SHEETS]:[...BASE_SHEETS];
    return [...(XB_COMPANIES.includes(company)?[...names,...ANT_SHEETS]:names),BORROW_SHEET];
  }
  function rulePanel(company){
    if(isSevenM(company)) return `<details class="mc8-requirements" open><summary>เงื่อนไขกระทบยอด 7M ที่ใช้รอบนี้</summary><div class="mc8-rule-columns"><div><h4>PM · จับคู่ 3 จุด</h4><ul><li>Ref / Ref Id ใน STM PM ↔ Note ของ BO</li><li>User / Username ใน STM PM ↔ User ใน BO</li><li>ยอดเงินจริงของ Provider ↔ ยอด BO</li><li>ATP ฝาก: โอนจริง · ATP ถอน: P2P จ่าย</li><li>COREPAY/CYBERPLUS ฝาก: จำนวนที่ได้รับ</li><li>AZPAY/MYPAY/LOCALPAY ใช้จำนวนเงินตามช่องรายการ</li></ul></div><div><h4>เกณฑ์ปิดเคส</h4><ul><li>เวลาเป็นข้อมูลประกอบ ไม่ใช่คีย์หลัก</li><li>Ref + User + ยอดตรงกัน ปิดได้แม้เวลาต่าง</li><li>User ไม่ครบ ใช้ Ref + ยอดได้เมื่อเป็นคู่เดียวที่ไม่ซ้ำ</li><li>ค้นหาข้ามแถว/ข้ามชีตได้ แต่คู่ซ้ำหรือกำกวมต้องตรวจเพิ่ม</li><li>Note ที่มีข้อความ P2P/MyPay สำเร็จ ระบบค้นหา Ref ภายในข้อความ</li></ul></div><div><h4>STM ธนาคาร</h4><ul><li>ธนาคารปกติรวมฝาก-ถอน D-W ไว้ชีตเดียวต่อบัญชี</li><li>เฉพาะ TMN แยกชีตฝาก D และถอน W</li><li>รองรับ BO/STM เรียงแถวไม่ตรงกัน</li><li>ใช้เวลาที่ใกล้ที่สุดช่วยเลือกคู่เมื่อยอดซ้ำ</li></ul></div></div><p class="mc8-rule-note">สีเขียว = ปิดได้ทันที · สีเหลือง = รอตรวจ · ระบบไม่ปิดจากเวลาใกล้เคียงเพียงอย่างเดียว</p></details>`;
    if(isSys123(company)) return `<details class="mc8-requirements" open><summary>เงื่อนไขกระทบยอดเครือ 123 ที่ใช้รอบนี้</summary><div class="mc8-rule-columns"><div><h4>PM · จุดที่ต้องตรง</h4><ul><li>AUTOPEER / COREPAY / LOCALPAY ฝาก-ถอน: รหัสสมาชิก + เลขบัญชีสมาชิก + ยอด</li><li>AZPAY: เปิดเฉพาะฝาก ใช้รหัสสมาชิก + เลขบัญชีสมาชิก + ยอดฝาก</li><li>CYBERPLUS ฝาก: ใช้ 3 จุด</li><li>CYBERPLUS ถอน: รหัสสมาชิก + ยอดถอนจริง (2 จุด)</li></ul></div><div><h4>เกณฑ์ปิดเคส</h4><ul><li>ต้องเป็นบริษัท Provider และทิศทางเดียวกัน</li><li>ต้องเป็นคู่ 1:1 ที่ไม่ซ้ำ</li><li>เวลาใช้เป็นข้อมูลประกอบ ไม่ใช้แทนตัวตนลูกค้า</li><li>ข้อมูลขาด ขัดกัน หรือหลายคู่คงไว้ให้ Audit ตรวจ</li></ul></div><div><h4>STM ธนาคารปกติ</h4><ul><li>ทุกบริษัทและทุกธนาคารแยกชีตฝาก D / ถอน W ต่อบัญชี</li><li>ไม่มีข้อยกเว้นให้รวม D-W ตามไฟล์ต้นทาง</li><li>เรียงเวลา STM จากน้อยไปมาก โดยวาง STM ซ้ายและ BO ขวา</li><li>BBL ไม่มีเวลา: ใช้บัญชี + วัน + ทิศทาง + ยอด</li><li>KTB และธนาคารที่มีเวลา: ใช้เวลา + ยอด</li></ul></div></div><p class="mc8-rule-note">สีเขียว = หลักฐานครบตามกฎ · สีเหลือง/แดง = ยังห้ามปิดอัตโนมัติ</p></details>`;
    return `<details class="mc8-requirements"><summary>เงื่อนไขกระทบยอดของกลุ่ม XB</summary><ul><li>จับคู่ภายในบริษัท/บัญชี/Provider/ทิศทางเดียวกัน</li><li>STM ธนาคารรวมรายการฝากและถอน D-W ไว้ชีตเดียวต่อบัญชี</li><li>PM ฝากยึด paymentTime ก่อน และใช้ expiredTime เมื่อไม่มี paymentTime</li><li>LOCALPAY ฝาก: เทียบ paymentTime ของ PM กับช่อง “เวลาทำรายการ” ของ BO; ช่อง “เวลา” เป็นเวลาสร้างรายการและไม่ใช้แทนเวลาจริง</li><li>PM ถอนยึด updateTime · ยอดฝากใช้ realAmount · ยอดถอนใช้ช่องเงินจริงของ Provider</li><li>PM เก็บ id ธุรกรรมแยกจาก _id ที่เก็บรหัส 6aa... ห้ามนำสองคอลัมน์นี้มาทับกัน</li><li>BO ถอน: แยกเฉพาะรหัส 6aa... หลัง Sapan:/Spean: เหมือน Text to Columns; ไม่รวมคำว่าโอนจริง สำเร็จ คืน หรือข้อความอื่นที่ตามหลัง</li><li>PM _id ต้องตรงกับรหัสที่แยกจาก BO และยอดจริงต้องตรงกันแบบคู่ 1:1 จึงปิดได้ แม้เวลา/ชื่อ Provider เดิมคลาดเคลื่อน</li><li>กฎ Sapan/_id ใช้กับ AT/AZ/CP/M/LP ที่มี _id เพื่อไม่ให้เคสหลุดเพราะเวลาไม่ตรง</li><li>ช่องหมายเหตุแสดงเฉพาะหมายเหตุ BO จริง; ชื่อวิธีจับคู่ เช่น legacy-rule แสดงในคอลัมน์เงื่อนไขเท่านั้น</li><li>คู่ที่ชัดเจนปิดได้ทันที; คู่ซ้ำ ข้ามวัน หรือหลักฐานไม่ครบจะแสดงไว้ให้ Audit ตรวจ</li></ul></details>`;
  }
  function summaries(rows,names=SHEETS){return Object.fromEntries(names.map(name=>[name,summarize(rows.filter(r=>sheetOf(r)===name))]));}
  function isStatement(row){
    if(isBorrowAccount(row?.account))return false;
    const account=String(row?.account||'').replace(/\D/g,'');
    if(!/^\d{6,}$/.test(account))return false;
    const meta=registryCatalog?.byAccount?.(account);
    if(meta?.bank||meta?.name)return true;
    if(providerOfRow(row)!=='OTHER')return false;
    const info=row?.pm||{};
    return !!(info.bank||info.name||info.user||info.account);
  }
  function shortHolder(name){
    const raw=String(name||'').trim();
    // คุณากร is the account holder's given name, not the honorific "คุณ".
    const normalized=/^คุณากร(?:\s|$)/.test(raw)?raw:raw.replace(/^(นาย|นางสาว|นาง|น\.ส\.|คุณ)\s*/,'');
    const words=normalized.split(/\s+/).filter(Boolean);
    return words[0]||'';
  }
  function statementGroups(rows,company=''){
    const registry=registryCatalog,byAccount=new Map();
    rows.filter(isStatement).forEach(row=>{
      const account=String(row.account),meta=registry?.byAccount?.(account)||{},info=row.pm||{};
      const bank=meta.bank||info.bank||row.bank||'STM',holder=shortHolder(meta.name||info.name||info.user),tmn=String(bank).toUpperCase()==='TMN',splitDirection=tmn||isSys123(company||row.company),direction=splitDirection?directionOf(row.direction):'',suffix=splitDirection?(direction==='deposit'?'D':direction==='withdraw'?'W':'ไม่ระบุ'):'D-W',groupId=splitDirection?`${account}:${direction}`:account,base=`STM ${bank}${holder?' '+holder:''} ${suffix}`;
      const group=byAccount.get(groupId)||{key:`statement:${groupId}`,account,direction,base,label:base,rows:[]};
      group.rows.push(row);byAccount.set(groupId,group);
    });
    const duplicates=new Map();byAccount.forEach(group=>duplicates.set(group.base,(duplicates.get(group.base)||0)+1));
    byAccount.forEach(group=>{if(duplicates.get(group.base)>1)group.label=`${group.base} ${group.account.slice(-4)}`;group.label=group.label.slice(0,31);});
    return [...byAccount.values()].sort((a,b)=>a.label.localeCompare(b.label,'th',{numeric:true}));
  }
  function filter(rows,pm,direction,status,sheet='all'){
    const statementParts=sheet.startsWith('statement:')?sheet.slice('statement:'.length).split(':'):[],statementAccount=statementParts[0]||'',statementDirection=statementParts[1]||'';
    return rows.filter(r=>(pm==='all'||r.account===pm)
      &&(direction==='all'||r.direction===direction)
      &&(status==='all'||r.kind===status)
      &&(sheet==='all'||sheet==='summary'||(statementAccount?(String(r.account)===statementAccount&&(!statementDirection||directionOf(r.direction)===statementDirection)):sheetOf(r)===sheet)));
  }
  function statusOf(s,complete){return s.waitingBoCount?'ยังไม่มี STM/PM · รอข้อมูล':!complete?'ข้อมูลยังไม่ครบ':s.diffAfterCents===0&&s.unmatchedPmCount===0&&s.unmatchedBoCount===0&&s.duplicateCount===0?'ยอดตรง':'ต้องตรวจ';}
  function summaryRow(name,s,complete,key=name){const warning=complete&&(s.diffAfterCents||s.unmatchedPmCount||s.unmatchedBoCount||s.duplicateCount);return `<tr class="${warning?'mc8-warning':''}"><th><button type="button" data-live-sheet="${esc(key)}">${esc(name)}</button></th><td>${s.pmCount} / ${moneyCents(s.pmCents)}</td><td>${s.boCount} / ${moneyCents(s.boCents)}</td><td>${s.matchedCount} / ${moneyCents(s.matchedPmCents)}</td><td>${s.unmatchedPmCount} / ${moneyCents(s.unmatchedPmCents)}</td><td>${s.unmatchedBoCount} / ${moneyCents(s.unmatchedBoCents)}</td><td>${s.crossDayCount} / ${moneyCents(s.crossDayBoCents)}</td><td>${s.duplicateCount} / ${moneyCents(s.duplicateCents)}</td><td>${moneyCents(s.diffBeforeCents)}</td><td>${moneyCents(s.diffAfterCents)}</td><td>${statusOf(s,complete)}</td></tr>`;}
  function summaryFooter(rows,complete,pageCount){const s=summarize(rows);return `<tfoot><tr><th>รวม ${pageCount} หน้า</th><td>${s.pmCount} / ${moneyCents(s.pmCents)}</td><td>${s.boCount} / ${moneyCents(s.boCents)}</td><td>${s.matchedCount} / ${moneyCents(s.matchedPmCents)}</td><td>${s.unmatchedPmCount} / ${moneyCents(s.unmatchedPmCents)}</td><td>${s.unmatchedBoCount} / ${moneyCents(s.unmatchedBoCents)}</td><td>${s.crossDayCount} / ${moneyCents(s.crossDayBoCents)}</td><td>${s.duplicateCount} / ${moneyCents(s.duplicateCents)}</td><td>${moneyCents(s.diffBeforeCents)}</td><td>${moneyCents(s.diffAfterCents)}</td><td>${statusOf(s,complete)}</td></tr></tfoot>`;}
  function totalsPanel(label,s,complete,amountLabel='ยอด STM / PM'){
    const pmLabel=amountLabel==='STM/PM · ยอด'||amountLabel==='ยอด Statement'?'STM / PM':`STM / PM · ${amountLabel}`;
    const rows=[[pmLabel,s.pmCount,s.pmCents,'ไม่รวมธุรกรรมซ้ำจากเคสเตือน'],['BO',s.boCount,s.boCents,'รวมรายการข้ามวัน'],['จับคู่แล้ว',s.matchedCount,s.matchedPmCents,'ยอด STM / PM ของคู่ที่บันทึกไว้'],['ยังไม่จับคู่ STM / PM',s.unmatchedPmCount,s.unmatchedPmCents,'อยู่ในเคสที่ต้องตรวจ'],['ยังไม่จับคู่ BO',s.unmatchedBoCount,s.unmatchedBoCents,'อยู่ในเคสที่ต้องตรวจ'],['BO ข้ามวัน',s.crossDayCount,s.crossDayBoCents,'แยกให้เห็นก่อนรวมเข้า BO'],['ซ้ำ / กำกวม',s.duplicateCount,s.duplicateCents,'ไม่นับซ้ำในยอดฝั่ง'],['ผลต่างก่อนรวมข้ามวัน','—',s.diffBeforeCents,'STM / PM − BO ในวัน'],['ผลต่างหลังรวมข้ามวัน','—',s.diffAfterCents,statusOf(s,complete)]];
    return `<section class="mc8-totals" aria-label="ยอดรวมท้ายตาราง"><h3>ยอดรวมท้ายตาราง · ${esc(label)}</h3><table><thead><tr><th>ฝั่ง / ผลตรวจ</th><th>จำนวน</th><th>ยอด (บาท)</th><th>หมายเหตุ</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td><td>${moneyCents(r[2])}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table><p>${complete?'คำนวณจากหลักฐานของรอบที่บันทึกไว้ โดยหักรายการอ้างอิงซ้ำก่อนรวมยอด':'หลักฐานรอบงานยังไม่ครบ ห้ามใช้ยอดนี้ยืนยันปิดงาน'}</p></section>`;
  }

  function thaiDirection(row){return row.direction==='deposit'?'ฝาก':row.direction==='withdraw'?'ถอน':'ไม่ระบุ';}
  function secondsBetween(row){
    if(row.pmSource?.noTime||row.boSource?.noTime||!/[ T]\d{2}:\d{2}/.test(row.pmTime||'')||!/[ T]\d{2}:\d{2}/.test(row.boTime||''))return '';
    const a=Date.parse(row.boTime||''),b=Date.parse(row.pmTime||'');
    if(!Number.isFinite(a)||!Number.isFinite(b))return '';
    const sec=Math.abs(Math.round((a-b)/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return `${h?'ต่าง '+h+' ชั่วโมง ':''}${m?'ต่าง '+m+' นาที ':''}${!h&&!m||s?s+' วินาที':''}`.trim();
  }
  function auditStatus(row,complete=true){
    if(row.waiting)return 'ยังไม่มี STM/PM · อ่าน BO แล้ว · ยังไม่กระทบยอด';
    const duplicateWarning=(row.relatedAlerts||[]).some(e=>e.status!=='closed')
      ||(row.kind!=='closed'&&(row.case?.customer_details?.reviewAlerts||[]).some(e=>e.type==='suspected_duplicate'));
    if(row.case?.status==='pair_pending')return 'จับคู่แล้ว รอหัวหน้าทีมอนุมัติ';
    if(row.kind==='closed')return 'ปิดเคสแล้ว';
    if(!complete)return 'ต้องตรวจเพิ่ม · ข้อมูลรอบไม่ครบ';
    const pm=cents(row.pmAmount),bo=cents(row.boAmount);
    const equalPair=hasSide(row,'pm')&&hasSide(row,'bo')&&pm!==null&&pm===bo;
    if(row.kind==='matched')return duplicateWarning?'ต้องตรวจเพิ่ม · สงสัยเติมซ้ำ':equalPair?'ปิดได้ทันที':'ต้องตรวจเพิ่ม · หลักฐานคู่ไม่สมบูรณ์';
    if(row.kind==='advisory')return 'แจ้งข้อมูล · ไม่ต้องยืนยัน';
    if(row.kind==='pending_next_day'||row.exType==='cross_day')return 'ค้างรอข้อมูลข้ามวัน · รอข้อมูลของวันถัดไป'+(duplicateWarning?' · สงสัยเติมซ้ำ':'');
    if(row.exType==='manual_review')return 'ยอดจับคู่แล้ว · รอตรวจหลักฐานเติมมือ';
    // Equal amounts alone do not resolve an open exception. Only the same
    // verified source-evidence gate used by production quick-close can allow it.
    return equalPair&&row.case?._quickSourceEvidence&&row.case.status==='open'?'ปิดได้ทันที':'ปิดไม่ได้/ต้องตรวจ';
  }
  function toneOf(status){return status==='จับคู่แล้ว รอหัวหน้าทีมอนุมัติ'?'neutral':status==='ปิดได้ทันที'||status==='ปิดเคสแล้ว'||status.startsWith('แจ้งข้อมูล')?'success':status.startsWith('ยังไม่มี STM/PM')||status.startsWith('ต้องตรวจเพิ่ม')||status.startsWith('ค้างรอข้อมูลข้ามวัน')||status.startsWith('ยอดจับคู่แล้ว')?'warning':'error';}
  function exportTones(rows,complete,statusIndex){
    const tones=rows.map(row=>toneOf(auditStatus(row,complete)));
    return {
      rowTones:tones.map(tone=>tone==='success'?'':tone),
      cellTones:tones.map(tone=>{const cells=[];cells[statusIndex]=tone;return cells;}),
    };
  }
  function amountDiff(row){if(row.waiting)return '';const pm=cents(row.pmAmount),bo=cents(row.boAmount);return pm===null&&bo===null?'':((pm||0)-(bo||0))/100;}
  function detail(row,side,key){return row?.[side]?.[key]??'';}
  function sourceColumns(row){
    const ant=providerOf(row.account)==='ANT';
    const time=row.pmSource?.noTime?'ไม่มีเวลาใน STM':row.pmSource?.timeColumn||(ant?'รอยืนยันช่องเวลา ANT':row.direction==='withdraw'?'updateTime':'paymentTime');
    const amount=row.pmSource?.amountColumn||(ant?'รอยืนยันช่องยอด ANT':row.direction==='deposit'?'realAmount':/^(AT|M)$/.test(providerOf(row.account))?'transferredAmount':'amount');
    return {time,amount};
  }
  function sourceCondition(row){if(row.waiting)return row.reason;const s=sourceColumns(row);return [row.reason||'',`เวลา PM: ${s.time}`,`ยอด PM: ${s.amount}`,row.pmSource?.noTime&&row.pmSource?.fileId?`STM ไฟล์ ${row.pmSource.fileId} · แถว ${row.pmSource.row??'ไม่ระบุ'}`:''].filter(Boolean).join(' · ');}
  function allExportRow(row,complete){
    const status=auditStatus(row,complete),bo=row.bo||{},pm=row.pm||{};
    const state=row.waiting?'รอ STM/PM':row.kind==='closed'?'ปิดเคสแล้ว':row.kind==='matched'?'คู่สำเร็จ':row.kind==='advisory'?'แจ้งข้อมูล':row.kind==='pending_next_day'?'ค้างรอข้อมูลข้ามวัน':'รอตรวจ';
    const sources=sourceColumns(row);
    const boNote=bo.providerReference||sapanProviderId(bo.note)||sapanProviderId(row.boRaw)||row.boRaw||bo.note||'';
    return [row.waiting?'BO รอ STM/PM':row.isPair?'จับคู่ได้':'Exception',state,row.code||row.key,row.account||'',thaiDirection(row),row.pmTime||'',numeric(row.pmAmount)??'',pm.account||'',pm.tail||'',pm.bank||'',pm.name||pm.user||'',pm.user||'',pm.reference||'',row.pmRaw||pm.note||'',row.boTime||'',numeric(row.boAmount)??'',bo.account||'',bo.tail||'',bo.bank||'',bo.name||bo.user||'',bo.user||'',bo.reference||'',boNote,secondsBetween(row),sourceCondition(row),row.case?.resolution_note||'',[`STM/PM ${row.pmSource?.row??''}`,`BO ${row.boSource?.row??''}`,row.waiting?'':`เวลา ${sources.time}`,row.waiting?'':`ยอด ${sources.amount}`].filter(v=>v&&!v.endsWith(' ')).join(' · '),amountDiff(row),status];
  }
  function leftExportValue(header,row){
    const pm=row.pm||{},provider=providerOf(row.account),code=(provider==='AT'?'autopeer':provider==='AZ'?'azpay':provider==='CP'?'corepay':provider==='LP'?'localpay':'mypays24');
    const source=sourceColumns(row),sourceTime=header=>header===source.time?row.pmTime||'':'';
    const amountValue=(...names)=>names.includes(source.amount)?(numeric(row.pmAmount)??''):'';
    const transactionRef=pm.transactionReference||pm.reference||'',providerRef=pm.providerReference||'';
    const values={id:pm.sourceId||transactionRef||row.code,amount:amountValue('amount'),provider:code,status:['matched','advisory','closed'].includes(row.kind)?'SUCCESSED':'REVIEW',requestTime:'',fee:'',reference:transactionRef||row.code,merchantRef:transactionRef||row.code,customerId:pm.user||'',systemRef:transactionRef||row.code,systemOrderNo:transactionRef||row.code,transactionId:(row.bo||{}).reference||row.code,bankCode:pm.bank||'',bankAccountNo:pm.account||'',bankAccountName:pm.name||'',updateTime:sourceTime('updateTime'),gatewayId:'',site:'',transferredAmount:amountValue('transferredAmount'),_id:providerRef,submitStatus:'',paymentMethods:'','gateway.name':code,'gateway.id':code,realAmount:amountValue('realAmount'),payee:pm.name||'',paymentTime:sourceTime('paymentTime'),expiredTime:sourceTime('expiredTime'),reason:sourceCondition(row),
      'วันที่':row.pmTime||'','วันที่ทำรายการ':row.pmTime||'','วันเวลาอัพเดต':row.pmTime||'','วัน/เวลา':row.pmTime||'','Ref':pm.reference||row.code,'Ref Id':pm.reference||row.code,'Payment Id':pm.paymentId||'',Username:pm.user||'','user ที่ฝาก':pm.user||'','ยูสเซอร์':pm.user||'','รหัสสมาชิก':pm.user||'','ธนาคาร':pm.bank||'','ธนาคารต้นทาง':pm.bank||'','เลขบัญชี':pm.account||'','เลขบัญชีที่โอน':pm.account||'','เลขบัญชีสมาชิก':pm.account||'','ชื่อ - นามสกุล ผู้รับ':pm.name||'','แจ้งถอน':numeric(row.pmAmount)??'','สร้างฝาก':numeric(row.pmAmount)??'','โอนจริง':amountValue('โอนจริง','realAmount'),'P2P จ่าย':amountValue('P2P จ่าย','p2pจ่าย','transferredAmount'),'จำนวนเงิน':amountValue('จำนวนเงิน','amount','transferredAmount'),'จำนวนเงินฝาก':numeric(row.pmAmount)??'','จำนวนเงินถอน':numeric(row.pmAmount)??'','จำนวนที่ได้รับ':amountValue('จำนวนที่ได้รับ'),'จำนวนที่ฝาก':numeric(row.pmAmount)??'','รวมหักเงิน':amountValue('รวมหักเงิน'),'ค่าธรรมเนียม':'','Progress':'','Status':['matched','advisory','closed'].includes(row.kind)?'SUCCESSED':'REVIEW','สถานะ':['matched','advisory','closed'].includes(row.kind)?'SUCCESSED':'REVIEW'};
    return values[header]??'';
  }
  function boStartOf(template){return Number.isInteger(template?.boStart)?template.boStart:(template?.headers||[]).indexOf('รหัส');}
  function providerExportRow(template,row,complete){
    const headers=template.headers||[],boStart=boStartOf(template),values=headers.map((header,index)=>index<boStart&&!row.waiting?leftExportValue(header,row):'');
    const bo=row.bo||{},boNote=bo.providerReference||sapanProviderId(bo.note)||sapanProviderId(row.boRaw)||bo.note||'',boValues=[bo.reference||row.code,row.boTime||'',thaiDirection(row),bo.origin||'ออโต้',bo.user||'',bo.bank||row.account||'',numeric(row.boAmount)??'',row.direction==='deposit'?(numeric(row.boAmount)??''):0,'',row.boTime||'',boNote,bo.performedBy||''];
    BO_HEADERS.forEach((header,index)=>{const target=headers.indexOf(header,boStart);if(target>=0)values[target]=boValues[index];});
    const compact={เวลา:row.boTime||'',ประเภท:thaiDirection(row),'ยูสเซอร์':bo.user||'','บัญชี':bo.account||bo.name||'','บัญชีบริษัท':row.account||'','ยอดเงิน':numeric(row.boAmount)??'',โบนัส:0,'โน้ต':boNote,'ผู้ดำเนินการ':bo.performedBy||'','แก้ไข':''};
    BO_COMPACT_HEADERS.forEach(header=>{const target=headers.indexOf(header,boStart);if(target>=0)values[target]=compact[header];});
    if(template.name===BORROW_SHEET){values[headers.indexOf('ประเภทดำเนินการ')]=bo.origin||'';values[headers.indexOf('BO ฝาก')]=row.direction==='deposit'?numeric(row.boAmount):'';values[headers.indexOf('BO ถอน')]=row.direction==='withdraw'?numeric(row.boAmount):'';values[headers.indexOf('ไฟล์ BO ต้นทาง')]=row.boSource?.fileName||row.boSource?.fileId||'';values[headers.indexOf('แถวต้นทาง')]=row.boSource?.row??'';}
    return [...values,sourceCondition(row),secondsBetween(row),amountDiff(row),auditStatus(row,complete)];
  }
  function statementExportRow(row,index,company,date,complete){return [index+1,company,date,row.account,thaiDirection(row),row.pmTime||'',numeric(row.pmAmount)??'',detail(row,'pm','account'),detail(row,'pm','tail'),detail(row,'pm','bank'),detail(row,'pm','name')||detail(row,'pm','user'),detail(row,'pm','reference'),row.boTime||'',numeric(row.boAmount)??'',detail(row,'bo','user'),detail(row,'bo','name')||detail(row,'bo','user'),detail(row,'bo','reference'),secondsBetween(row),sourceCondition(row),amountDiff(row),auditStatus(row,complete)];}
  function totalRow(headers,rows,amountHeader){
    const result=Array(headers.length).fill(''),pmIndex=headers.indexOf(amountHeader),boIndex=Math.max(headers.lastIndexOf('จำนวน'),headers.lastIndexOf('ยอดเงิน'),headers.lastIndexOf('ยอด BO'),headers.lastIndexOf('BO · ยอด')),diffIndex=headers.indexOf('ผลต่างยอด'),statusIndex=headers.indexOf('สถานะ Audit');
    result[0]='รวม';
    if(pmIndex>=0)result[pmIndex]=rows.reduce((sum,row)=>sum+(numeric(row[pmIndex])||0),0);
    if(boIndex>=0)result[boIndex]=rows.reduce((sum,row)=>sum+(numeric(row[boIndex])||0),0);
    for(const header of ['BO ฝาก','BO ถอน']){const index=headers.indexOf(header);if(index>=0)result[index]=rows.reduce((sum,row)=>sum+(numeric(row[index])||0),0);}
    const waiting=rows.some(row=>String(row[statusIndex]||'').startsWith('ยังไม่มี STM/PM'));
    if(diffIndex>=0)result[diffIndex]=waiting?'':(pmIndex>=0?result[pmIndex]:0)-(boIndex>=0?result[boIndex]:0);
    if(statusIndex>=0)result[statusIndex]=`รวม ${rows.length.toLocaleString('th-TH')} รายการ`;
    if(waiting&&statusIndex>=0)result[statusIndex]+=' · ยังรอ STM/PM · ยังไม่กระทบยอด';
    return result;
  }
  function pmAmountHeader(headers,sheet){
    if(sheet.startsWith('statement:'))return 'ยอด Statement';
    if(sheet==='all')return 'STM/PM · ยอด';
    const deposit=sheet.endsWith('ฝ');
    const candidates=deposit
      ? ['realAmount','โอนจริง','จำนวนที่ได้รับ','จำนวนเงินฝาก','จำนวนที่ฝาก','จำนวนเงิน','สร้างฝาก']
      : ['transferredAmount','P2P จ่าย','จำนวนเงินถอน','จำนวนเงิน','รวมหักเงิน','amount','แจ้งถอน'];
    return candidates.find(header=>headers.includes(header))||'';
  }
  function providerTemplates(schema,company,rows=[]){
    return [...standardProviderTemplates(schema,company,rows),{name:BORROW_SHEET,headers:[...BO_HEADERS,'BO ฝาก','BO ถอน','ไฟล์ BO ต้นทาง','แถวต้นทาง'],boStart:0}];
  }
  function standardProviderTemplates(schema,company,rows=[]){
    const base=(schema?.sheets||[]).filter(template=>BASE_SHEETS.includes(template.name));
    if(isSevenM(company))return SEVEN_M_SHEETS.map(name=>{const left=[...(SEVEN_M_LEFT[name]||[])],headers=[...left,null,...BO_COMPACT_HEADERS];return {name,headers,boStart:left.length+1};});
    if(isSys123(company))return SYS123_SHEETS.map(name=>{const left=[...(SYS123_LEFT[name]||[])],headers=[...left,null,...BO_COMPACT_HEADERS];return {name,headers,boStart:left.length+1};});
    const ant=XB_COMPANIES.includes(company)?ANT_SHEETS.map(name=>{
      const left=['วัน/เวลา','Ref Id','Username','เลขบัญชี','ชื่อ - นามสกุล ผู้รับ',name.endsWith('ฝ')?'จำนวนเงินฝาก':'จำนวนเงินถอน','สถานะ'];
      return {name,headers:[...left,null,...BO_COMPACT_HEADERS],boStart:left.length+1};
    }):[];
    if(!providerSheets(company,rows).includes('LP ถ'))return [...base,...ant];
    const withdrawal=base.find(template=>template.name==='AZ ถ'),deposit=base.find(template=>template.name==='AZ ฝ');
    return [...base,
      ...ant,
      withdrawal&&{...withdrawal,name:'LP ถ',headers:[...withdrawal.headers]},
      deposit&&{...deposit,name:'LP ฝ',headers:[...deposit.headers]},
    ].filter(Boolean);
  }
  function waitingStatements(coverage,company){
    const seen=new Set();
    return (coverage?.missing||[]).filter(item=>{
      const key=[item.company,item.identity,item.direction].join('|');
      if(item.kind!=='STM'||item.company!==company||seen.has(key))return false;
      seen.add(key);return true;
    }).map(item=>{
      const meta=registryCatalog?.byAccount?.(item.identity)||{};
      return {...item,label:[meta.bank||item.label||'STM',shortHolder(meta.name),item.identity].filter(Boolean).join(' ')};
    });
  }
  function waitingStatementPanel(waiting){
    if(!waiting.length)return '';
    return `<section class="mc8-summary mc8-warning" role="status"><h3>บัญชีที่ยังรอ STM · ยังไม่กระทบยอด</h3><p>มี BO ในรอบนี้ แต่ยังไม่มี STM ของบัญชีและประเภทนี้ ยอดด้านล่างไม่ใช่ยอดจับคู่ ไม่รวมในผลต่าง และห้ามใช้ยืนยันปิดงาน</p><div class="mc8-summary-scroll"><table><thead><tr><th>บัญชี</th><th>ประเภท</th><th>BO รายการ / ยอด</th><th>STM</th><th>สถานะ</th></tr></thead><tbody>${waiting.map(item=>`<tr><th>${esc(item.label)}</th><td>${item.direction==='deposit'?'ฝาก':item.direction==='withdraw'?'ถอน':'ไม่ระบุ'}</td><td>${esc(item.rows)} / ${moneyCents(Math.round(Number(item.amount)*100))}</td><td>ยังไม่มีข้อมูล</td><td>รอ STM · ยังไม่กระทบ</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function buildAuditExportSheets(rows,company,date,complete=true,schema=root.MC8SheetSchema,coverage=null){
    if(!schema?.sheets?.length)throw new Error('ไม่พบโครงหัวตาราง Audit');
    const orderedRows=chronologicalRows(rows),allRows=orderedRows.map(row=>allExportRow(row,complete)),allTones=exportTones(orderedRows,complete,ALL_HEADERS.length-1);
    const allTotal=Array(ALL_HEADERS.length).fill(''),allSummary=summarize(rows);allTotal[0]='รวม';allTotal[1]=`${rows.length.toLocaleString('th-TH')} รายการ`;allTotal[ALL_HEADERS.indexOf('BO · ยอด')]=allSummary.boCents/100;allTotal[ALL_HEADERS.indexOf('STM/PM · ยอด')]=allSummary.pmCents/100;allTotal[ALL_HEADERS.indexOf('ผลต่างยอด')]=allSummary.diffAfterCents/100;allTotal[ALL_HEADERS.length-1]='รวมทุกสถานะ';
    const providerNames=providerSheets(company,rows),templates=providerTemplates(schema,company,rows),supported=rows.filter(row=>providerNames.includes(sheetOf(row))),statement=rows.filter(isStatement),statementSets=statementGroups(statement,company);
    const bySheet=summaries(supported,providerNames);
    const summaryRows=providerNames.map(name=>{const s=bySheet[name],issues=rows.filter(r=>sheetOf(r)===name&&['review','pending_next_day'].includes(r.kind)).length;return [name,name===BORROW_SHEET?'BO ต้นทาง':providerOf(rows.find(r=>sheetOf(r)===name)?.account||name.split(' ')[0]),name===BORROW_SHEET?'ฝาก-ถอน':name.endsWith('ฝ')?'ฝาก':'ถอน',s.pmCount,s.pmCents/100,s.boCents/100,s.diffAfterCents/100,issues,statusOf(s,complete)];});
    statementSets.forEach(group=>{const s=summarize(group.rows),issues=group.rows.filter(r=>['review','pending_next_day'].includes(r.kind)).length;summaryRows.push([group.label,'STM',group.direction?(group.direction==='deposit'?'ฝาก':'ถอน'):'ฝาก-ถอน',s.pmCount,s.pmCents/100,s.boCents/100,s.diffAfterCents/100,issues,statusOf(s,complete)]);});
    const summaryTones=summaryRows.map(row=>row[6]!==0||row[7]>0?'warning':'');
    const sheets=[
      {name:'ข้อมูลทั้งหมด',headers:[...ALL_HEADERS],rows:allRows,...allTones,widths:[18,18,18,20,12,20,14,18,10,16,22,16,24,34,20,14,18,10,16,22,16,24,34,18,40,38,22,28],footerRows:[allTotal]},
      {name:'สรุป',headers:['ชีต','Provider','ประเภท','จำนวน STM/PM','รวมยอด STM/PM','รวมยอด BO','ผลต่าง','รายการต้องตรวจ','สถานะ'],rows:summaryRows,rowTones:summaryTones,widths:[12,16,12,16,20,20,18,18,20],footerRows:[['รวม','','',summaryRows.reduce((s,r)=>s+r[3],0),summaryRows.reduce((s,r)=>s+r[4],0),summaryRows.reduce((s,r)=>s+r[5],0),summaryRows.reduce((s,r)=>s+r[6],0),summaryRows.reduce((s,r)=>s+r[7],0),complete?'ครบตามรอบ':'ข้อมูลยังไม่ครบ']]},
    ];
    for(const group of statementSets){const headers=[...STATEMENT_HEADERS],scoped=chronologicalRows(group.rows),data=scoped.map((row,index)=>statementExportRow(row,index,company,date,complete));sheets.push({name:group.label,headers,rows:data,...exportTones(scoped,complete,headers.length-1),widths:[8,12,14,20,12,20,16,20,10,16,24,24,20,16,18,24,20,18,40,16,26],footerRows:[totalRow(headers,data,'ยอด Statement')]});}
    for(const template of templates){const scoped=chronologicalRows(rows.filter(row=>sheetOf(row)===template.name)),headers=[...template.headers,...AUDIT_HEADERS],data=scoped.map(row=>providerExportRow(template,row,complete)),amountHeader=pmAmountHeader(headers,template.name);sheets.push({name:template.name,headers,rows:data,...exportTones(scoped,complete,headers.length-1),widths:headers.map(header=>!header?3:/Time|เวลา/.test(header)?20:/id|Ref|reference|system|transaction|merchant|รหัส/i.test(header)?24:/หมายเหตุ|เงื่อนไข/.test(header)?32:/สถานะ Audit/.test(header)?26:14),footerRows:[totalRow(headers,data,amountHeader)]});}
    const waiting=waitingStatements(coverage,company);
    if(waiting.length){
      sheets.push({name:'รอ STM',headers:['บัญชี','ประเภท','จำนวน BO','ยอด BO','STM','สถานะ'],rows:waiting.map(item=>[item.label,item.direction==='deposit'?'ฝาก':'ถอน',item.rows,item.amount,'ยังไม่มีข้อมูล','รอ STM · ยังไม่กระทบ']),rowTones:waiting.map(()=> 'warning'),widths:[40,12,16,20,24,32]});
      sheets.find(sheet=>sheet.name==='สรุป').footerRows[0][8]='ยังรอ STM · ห้ามยืนยันปิดงาน';
    }
    sheets.forEach(sheet=>{sheet.headerStyle='template';});
    return sheets;
  }

  function tableView(rows,company,date,complete,sheet,schema=root.MC8SheetSchema){
    const ordered=chronologicalRows(rows);
    if(sheet.startsWith('statement:'))return {headers:[...STATEMENT_HEADERS],rows:ordered.map((row,index)=>statementExportRow(row,index,company,date,complete))};
    if(SHEETS.includes(sheet)){
      const template=providerTemplates(schema,company,rows).find(item=>item.name===sheet);
      if(!template)throw new Error(`ไม่พบหัวตาราง ${sheet}`);
      return {headers:[...template.headers,...AUDIT_HEADERS],rows:ordered.map(row=>providerExportRow(template,row,complete))};
    }
    return {headers:[...ALL_HEADERS],rows:ordered.map(row=>allExportRow(row,complete))};
  }
  function headerTone(header,index,headers,sheet){
    if(header===null||header===undefined||header==='')return 'gap';
    if(sheet.startsWith('statement:'))return /Statement/.test(header)?'pm':/\bBO\b/.test(header)?'bo':'';
    if(SHEETS.includes(sheet)){
      const boStart=headers.indexOf('รหัส')>=0?headers.indexOf('รหัส'):headers.indexOf('เวลา'),auditStart=headers.length-AUDIT_HEADERS.length;
      if(index<boStart)return 'pm';
      if(index<auditStart)return 'bo';
    }
    return '';
  }
  function renderCell(value,header=''){
    if(typeof value!=='number'||!Number.isFinite(value))return String(value??'');
    return /amount|ยอด|จำนวน|fee|realAmount|transferredAmount|ผลต่าง/i.test(String(header||''))?money(value):value.toLocaleString('en-US');
  }
  function letter(index){let label='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;return label;}
  function providerHeader(headers,sheet,visible=headers.map((_,index)=>index),columnFilters={},sort={index:-1,direction:''},filterOptions={}){
    const heading=(header,index)=>{
      const options=filterOptions[index]||[],rule=columnFilters[index],selected=new Set(Array.isArray(rule?.values)?rule.values.map(String):options.map(String)),active=!!rule;
      const values=options.map(value=>{const key=String(value??''),label=key===''?'(ว่าง)':renderCell(value,header);return `<label data-excel-value-label><input type="checkbox" data-live-filter-value value="${esc(key)}" ${selected.has(key)?'checked':''}> <span title="${esc(label)}">${esc(label)}</span></label>`;}).join('');
      return `<details class="mc8-excel-filter ${active?'active':''}" data-live-filter-menu="${index}"><summary>${esc(header)||' '}<span>${sort.index===index?(sort.direction==='desc'?'↓':'↑'):active?'●':'▼'}</span></summary><div class="mc8-excel-menu"><b>${letter(index)} · ${esc(header||'คอลัมน์ว่าง')}</b><button type="button" data-live-sort-dir="asc" data-column-index="${index}">เรียงน้อย → มาก</button><button type="button" data-live-sort-dir="desc" data-column-index="${index}">เรียงมาก → น้อย</button><input type="search" data-live-value-search placeholder="ค้นหาในคอลัมน์นี้" aria-label="ค้นหาค่าใน ${esc(header||letter(index))}"><div class="mc8-excel-select-actions"><button type="button" data-live-values-all>เลือกทั้งหมด</button><button type="button" data-live-values-none>ไม่เลือกทั้งหมด</button></div><div class="mc8-excel-values">${values||'<span>ไม่มีค่าในคอลัมน์นี้</span>'}</div><div class="mc8-excel-actions"><button type="button" data-live-filter-clear="${index}">ล้างตัวกรอง</button><button type="button" class="primary" data-live-filter-apply="${index}">ตกลง</button></div></div></details>`;
    };
    if(!SHEETS.includes(sheet))return `<tr>${visible.map(index=>`<th class="${headerTone(headers[index],index,headers,sheet)}">${heading(headers[index],index)}</th>`).join('')}</tr>`;
    const boStart=headers.indexOf('รหัส')>=0?headers.indexOf('รหัส'):headers.indexOf('เวลา'),auditStart=headers.length-AUDIT_HEADERS.length;
    const pmEnd=headers.slice(0,boStart).findLastIndex(value=>!!value),gap=Math.max(0,boStart-pmEnd-1);
    const groups=[['pm','STM / PM',index=>index<=pmEnd],['gap','',index=>index>pmEnd&&index<boStart],['bo','BO / ระบบ',index=>index>=boStart&&index<auditStart],['','ผลตรวจ / Audit',index=>index>=auditStart]];
    return `<tr><th class="mc8-rownum">ฝั่ง</th>${groups.map(([tone,label,test])=>{const count=visible.filter(test).length;return count?`<th class="${tone}" colspan="${count}">${label}</th>`:'';}).join('')}</tr>
      <tr><th class="mc8-rownum">คอลัมน์</th>${visible.map(index=>`<th class="${headerTone(headers[index],index,headers,sheet)}">${letter(index)}</th>`).join('')}</tr>
      <tr><th class="mc8-rownum">1</th>${visible.map(index=>`<th class="${headerTone(headers[index],index,headers,sheet)}">${heading(headers[index],index)}</th>`).join('')}</tr>`;
  }
  function providerFooter(headers,rows,sheet,visible=headers.map((_,index)=>index)){
    if(sheet==='summary')return '';
    const amountHeader=pmAmountHeader(headers,sheet),values=totalRow(headers,rows,amountHeader),rowNumber=SHEETS.includes(sheet)?'<th class="mc8-rownum">รวม</th>':'';
    return `<tfoot><tr>${rowNumber}${visible.map(index=>{const totalColumn=[amountHeader,'ยอด BO','BO · ยอด','จำนวน','ยอดเงิน','ผลต่างยอด'].includes(headers[index]);return `<td class="${headerTone(headers[index],index,headers,sheet)} ${totalColumn?'mc8-total-value':''}" title="${esc(headers[index]===amountHeader?`ผลรวม ${amountHeader}`:'')}">${esc(renderCell(values[index],headers[index]))}</td>`;}).join('')}</tr></tfoot>`;
  }

  function columnMatch(value,rule){
    if(rule&&typeof rule==='object')return !Array.isArray(rule.values)||rule.values.map(String).includes(String(value??''));
    const q=String(rule||'').trim().toLocaleLowerCase('th-TH');
    if(!q)return true;
    return String(value??'').toLocaleLowerCase('th-TH').includes(q);
  }
  function compareCells(a,b){
    const an=Number(String(a??'').replace(/,/g,'')),bn=Number(String(b??'').replace(/,/g,''));
    if(Number.isFinite(an)&&Number.isFinite(bn))return an-bn;
    return String(a??'').localeCompare(String(b??''),'th',{numeric:true,sensitivity:'base'});
  }
  function filterAndSortEntries(entries,columnFilters={},sort={index:-1,direction:''}){
    const filtered=entries.filter(entry=>Object.entries(columnFilters).every(([index,query])=>columnMatch(entry.values[Number(index)],query)));
    if(Number.isInteger(sort.index)&&sort.index>=0&&sort.direction){
      const direction=sort.direction==='desc'?-1:1;
      filtered.sort((a,b)=>direction*compareCells(a.values[sort.index],b.values[sort.index]));
    }
    return filtered;
  }

  function mount(container,opts){
    const token={};slots.set(container,token);const alive=()=>slots.get(container)===token&&(opts.isActive?.()??true);
    const companies=(opts.companies||COMPANIES).filter(c=>COMPANIES.includes(c));
    let company=companies.includes(opts.company)?opts.company:(companies.includes(remembered.company)?remembered.company:companies[0]||'MC8');
    let date=opts.date||remembered.date||'2026-09-16',pm='all',direction='all',status='all',sheet=root.MC8SheetSchema?.sheets?.length?'AT ถ':'all',page=0,data=null,files=[],loading=false,error='',fileError='',generation=0,fullscreen=false,wrapText=false;
    const columnFilters={},sortBySheet={};
    let hiddenBySheet={};
    try{hiddenBySheet=JSON.parse(root.localStorage?.getItem('audit-live-hidden-columns-v1')||'{}')||{};}catch(_){hiddenBySheet={};}
    const hiddenSet=()=>new Set(Array.isArray(hiddenBySheet[sheet])?hiddenBySheet[sheet]:[]);
    const saveHidden=()=>{try{root.localStorage?.setItem('audit-live-hidden-columns-v1',JSON.stringify(hiddenBySheet));}catch(_){/* private browsing or tests */}};
    const labels={matched:'ระบบจับคู่แล้ว',waiting_source:'อ่าน BO แล้ว · รอ STM/PM',advisory:'แจ้งข้อมูล · ไม่ต้องยืนยัน',pending_next_day:'ค้างรอข้อมูลข้ามวัน',review:'รอตรวจ / ชี้แจง',closed:'ปิดเคสแล้ว'};
    function isComplete(all){
      if(all.some(row=>row.waiting))return false;
      const evidence=Array.isArray(data?.run?.summary?.match_evidence)?data.run.summary.match_evidence.length:0;
      if(!data?.complete||!['completed','needs_review'].includes(data?.run?.jobStatus)||evidence<Number(data?.run?.matched||0))return false;
      return true;
    }
    function draw(){
      if(!alive())return;
      // Keep source identity, displayed values, tone and action in one order.
      const all=data?rowsOf(data,company):[],baseShown=chronologicalRows(filter(all,pm,direction,status,sheet)),providerNames=providerSheets(company,all),statementSets=statementGroups(all,company);
      const complete=!!data?.run&&isComplete(all),bySheet=summaries(all,providerNames),supported=all.filter(r=>providerNames.includes(sheetOf(r))||isStatement(r));
      const waiting=waitingStatements(data?.run?.summary?.bo_first,company);
      const evidence=Array.isArray(data?.run?.summary?.match_evidence)?data.run.summary.match_evidence.length:0,other=all.filter(r=>sheetOf(r)==='OTHER'&&!isStatement(r));
      const rawView=tableView(baseShown,company,date,complete,sheet,root.MC8SheetSchema),rules=columnFilters[sheet]||{},sort=sortBySheet[sheet]||{index:-1,direction:''};
      const entries=filterAndSortEntries(baseShown.map((source,index)=>({source,values:rawView.rows[index]})),rules,sort),shown=entries.map(entry=>entry.source);
      page=0;
      const pageEntries=entries,pageRows=shown,view={headers:rawView.headers,rows:entries.map(entry=>entry.values)},fullView=view;
      const hidden=hiddenSet(),visible=view.headers.map((_,index)=>index).filter(index=>!hidden.has(index));
      const filterOptions=Object.fromEntries(view.headers.map((_,index)=>[index,[...new Map(rawView.rows.map(row=>[String(row[index]??''),row[index]??''])).values()].sort(compareCells)]));
      const scope=summarize(shown);
      const viewTabs=[['all','ข้อมูลทั้งหมด'],['summary','สรุป'],...statementSets.map(group=>[group.key,group.label]),...providerNames.map(name=>[name,name])];
      const columnTools=sheet==='summary'?'':`<div class="mc8-table-tools"><button type="button" id="mc8-live-fullscreen">${fullscreen?'ออกจากเต็มจอ':'ดูตารางเต็มจอ'}</button><button type="button" id="mc8-live-wrap-text" aria-pressed="${wrapText}">${wrapText?'ย่อข้อความ':'แสดงข้อความทั้งหมด'}</button><details class="mc8-column-picker"><summary>เลือกคอลัมน์ (${visible.length}/${view.headers.length})</summary><div><p>ติ๊กเพื่อแสดงคอลัมน์ เหมือน Hide / Unhide ใน Excel</p><button type="button" id="mc8-live-show-columns">แสดงทั้งหมด</button>${view.headers.map((header,index)=>`<label><input type="checkbox" data-live-column="${index}" ${hidden.has(index)?'':'checked'} ${!hidden.has(index)&&visible.length===1?'disabled':''}> ${letter(index)} · ${esc(header||'คอลัมน์ว่าง')}</label>`).join('')}</div></details>${Object.values(rules).filter(Boolean).length?`<button type="button" id="mc8-live-clear-columns">ล้างฟิลเตอร์ทั้งหมด (${Object.values(rules).filter(Boolean).length})</button>`:''}<span>กดข้อความยาวเพื่อขยายเฉพาะช่อง · กด ▼ ที่หัวคอลัมน์เพื่อกรองและเรียง</span></div>`;
      container.innerHTML=`<section class="mc8-workbook ${fullscreen?'mc8-fullscreen':''} ${wrapText?'mc8-wrap-text':''}" tabindex="-1"><header class="mc8-intro"><div><h2>เอกสารกระทบยอด · ${esc(company)}</h2><p>หน้าจอและไฟล์ Excel ใช้หัวตารางเดียวกัน แยก PM ตาม Provider และแยก STM ธนาคารทีละบัญชี</p></div><span class="mc8-pending">${esc(date)}</span></header>
        <p class="mc8-note">อ่านผลรอบงานที่บันทึกไว้เท่านั้น · ไม่รันกติกาใหม่ ไม่ปิดเคส และไม่นำไฟล์ตัวอย่างมาแทนข้อมูลจริง</p>
        <div class="mc8-filters"><label>บริษัท<select id="mc8-live-company" ${loading?'disabled':''}>${companies.map(c=>`<option value="${c}" ${company===c?'selected':''}>${c}</option>`).join('')}</select></label><label>วันที่ตรวจ<input type="date" id="mc8-live-date" value="${esc(date)}" ${loading?'disabled':''}></label><button id="mc8-live-load" ${loading?'disabled':''}>${loading?'กำลังโหลด…':'โหลดข้อมูลจริง'}</button>${data?.run?'<button id="mc8-live-export">ออก Excel ตามแบบ Audit</button>':''}${company==='MC8'?'<button id="mc8-local-view">เทียบไฟล์ Excel ต้นแบบ MC8</button>':''}</div>
        ${error?`<p role="alert">${esc(error)}</p>`:''}
        ${waitingStatementPanel(waiting)}
        ${data?.run?`<p>วันที่ผลที่โหลด: <strong>${esc(date)}</strong> · Run: ${esc(data.run.id)} · สถานะงาน: ${esc(data.run.jobStatus)}</p><p>ระบบรายงานจับคู่ ${esc(data.run.matched??'ไม่ระบุ')} คู่ · มีหลักฐานคู่ ${evidence} คู่ · แสดง ${all.filter(row=>!row.isPair).length} เคสที่ต้องตรวจจริง</p>${!complete?'<p role="alert" class="mc8-warning">ผลหรือหลักฐานยังไม่ครบ หรือจำนวนที่สร้างใหม่ไม่ตรงกับรอบงาน ห้ามใช้ยอดนี้ยืนยันปิดงาน</p>':''}${other.length?`<p role="alert" class="mc8-warning">มี ${other.length} แถวที่จัดเข้า Provider หรือบัญชี STM ไม่ได้ จึงแสดงไว้เฉพาะหน้าข้อมูลทั้งหมด</p>`:''}
        <section class="mc8-summary" id="mc8-live-summary"><h3>สรุปยอดแยกทุกหน้า</h3><div class="mc8-summary-scroll"><table><thead><tr><th>หน้า</th><th>STM / PM<br>รายการ / ยอด</th><th>BO<br>รายการ / ยอด</th><th>จับคู่แล้ว</th><th>ไม่จับคู่ PM</th><th>ไม่จับคู่ BO</th><th>ข้ามวัน</th><th>ซ้ำ / กำกวม</th><th>ต่างก่อนข้ามวัน</th><th>ต่างหลังข้ามวัน</th><th>สถานะ</th></tr></thead><tbody>${providerNames.map(name=>summaryRow(name,bySheet[name],complete)).join('')}${statementSets.map(group=>summaryRow(group.label,summarize(group.rows),complete,group.key)).join('')}</tbody>${summaryFooter(supported,complete,providerNames.length+statementSets.length)}</table></div><p>จำนวนและยอดคั่นด้วย / · กดชื่อหน้าเพื่อเปิดรายละเอียด · แถวรวมอยู่ท้ายตารางเหมือน Excel</p></section>
        <div class="mc8-tabs" role="tablist" aria-label="หน้า Audit">${viewTabs.map(([value,label])=>`<button type="button" role="tab" aria-selected="${sheet===value}" data-live-sheet="${esc(value)}">${esc(label)}<small>${value==='all'?'ทุกสถานะ':value==='summary'?'ภาพรวม':value.startsWith('statement:')?'STM ธนาคาร ฝาก-ถอน':value.endsWith('ฝ')?'ฝาก':'ถอน'}</small></button>`).join('')}</div>
        <div class="mc8-filters"><label>PM<select id="mc8-live-pm"><option value="all">ทุก PM</option>${[...new Set(all.map(r=>r.account))].sort().map(a=>`<option ${pm===a?'selected':''} value="${esc(a)}">${esc(a)}</option>`).join('')}</select></label><label>ประเภท<select id="mc8-live-direction">${[['all','ฝากและถอน'],['deposit','ฝาก'],['withdraw','ถอน']].map(([v,t])=>`<option value="${v}" ${direction===v?'selected':''}>${t}</option>`).join('')}</select></label><label>ผลตรวจ<select id="mc8-live-status">${[['all','ทั้งหมด'],...Object.entries(labels)].map(([v,t])=>`<option value="${v}" ${status===v?'selected':''}>${t}</option>`).join('')}</select></label></div>${rulePanel(company)}${columnTools}
        ${sheet==='summary'?`<p class="mc8-summary-focus">หน้าสรุปแสดงจำนวนและยอดของ ${providerNames.length+statementSets.length} หน้ารายละเอียด พร้อมแถวรวมท้ายตารางด้านบน</p>`:`${SHEETS.includes(sheet)?'<p class="mc8-source-note"><b>ที่มาของข้อความ:</b> ช่อง “หมายเหตุ/โน้ต” อ่านจากช่องหมายเหตุในไฟล์ BO ต้นทาง ไม่ใช่ Note ที่ Audit พิมพ์เพิ่ม หากเป็น Sapan/Spean ระบบจะแสดงเฉพาะรหัส 6aa… ที่ใช้จับคู่ ส่วน “เงื่อนไขที่จับคู่” และ “หมายเหตุ Audit” เป็นข้อมูลที่ระบบ/Audit แยกเก็บคนละคอลัมน์</p>':''}<p role="status">แสดงครบ ${shown.length} จาก ${baseShown.length} แถวในหน้าเดียว · เลื่อนในตารางได้ทั้งแนวตั้งและแนวนอน · ยอดรวมท้ายตารางคำนวณตามตัวกรองปัจจุบัน</p><div class="mc8-scroll" tabindex="0" aria-label="ตาราง ${esc(sheet==='all'?'ข้อมูลทั้งหมด':sheet)}"><table class="mc8-grid"><thead>${providerHeader(view.headers,sheet,visible,rules,sort,filterOptions)}</thead><tbody>${view.rows.map((values,rowIndex)=>{const source=pageRows[rowIndex],rowStatus=auditStatus(source,complete),tone=toneOf(rowStatus),rowNumber=rowIndex+2;return `<tr class="mc8-${tone}">${SHEETS.includes(sheet)?`<th scope="row" class="mc8-rownum">${rowNumber}</th>`:''}${visible.map(index=>{const displayed=renderCell(values[index],view.headers[index]),longText=displayed.length>28;return `<td class="${headerTone(view.headers[index],index,view.headers,sheet)} ${longText?'mc8-long-text':''}" title="${esc(displayed)}" ${longText?'data-live-text-cell tabindex="0" role="button" aria-expanded="false"':''}>${esc(displayed)||'—'}${index===visible[visible.length-1]&&source.case?` <button data-live-case="${esc(source.key)}">เปิดเคสจริง</button>`:''}</td>`;}).join('')}</tr>`;}).join('')||`<tr><td colspan="${visible.length+(SHEETS.includes(sheet)?1:0)}">ไม่พบรายการตามตัวกรองคอลัมน์</td></tr>`}</tbody>${providerFooter(fullView.headers,fullView.rows,sheet,visible)}</table></div>${totalsPanel(sheet==='all'?'ข้อมูลทั้งหมด':sheet,scope,complete,pmAmountHeader(fullView.headers,sheet))}`}
        <details><summary>ไฟล์ต้นทางของผลรอบนี้ (${files.length})</summary>${fileError?`<p role="alert">${esc(fileError)}</p>`:''}<ul>${files.map(f=>`<li>${esc(f.file_name)} · ${esc(f.kind)} ${opts.onFile?`<button data-live-file="${esc(f.id)}">ดูไฟล์ต้นทาง</button>`:''}</li>`).join('')}</ul></details>`:!loading&&!error?`<p>ยังไม่มีผลกระทบยอดที่อ่านได้ของ ${esc(company)} ในวันที่เลือก</p>`:''}</section>`;
      container.querySelector('#mc8-live-company').onchange=e=>{company=e.target.value;remembered.company=company;opts.onCompany?.(company);sheet='all';pm='all';load();};
      container.querySelector('#mc8-live-load').onclick=()=>{const v=container.querySelector('#mc8-live-date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){error='กรุณาเลือกวันที่';draw();return;}date=v;remembered.date=v;opts.onDate?.(date);load();};
      const local=container.querySelector('#mc8-local-view');if(local)local.onclick=()=>{slots.delete(container);opts.onLocal?.();};
      if(!data?.run)return;
      const fullscreenButton=container.querySelector('#mc8-live-fullscreen');if(fullscreenButton)fullscreenButton.onclick=()=>{fullscreen=!fullscreen;draw();if(fullscreen)container.querySelector('.mc8-workbook')?.focus();};
      const wrapButton=container.querySelector('#mc8-live-wrap-text');if(wrapButton)wrapButton.onclick=()=>{wrapText=!wrapText;draw();};
      const showColumns=container.querySelector('#mc8-live-show-columns');if(showColumns)showColumns.onclick=()=>{hiddenBySheet[sheet]=[];saveHidden();draw();};
      const clearColumns=container.querySelector('#mc8-live-clear-columns');if(clearColumns)clearColumns.onclick=()=>{columnFilters[sheet]={};page=0;draw();};
      container.querySelectorAll('[data-live-column]').forEach(input=>input.onchange=()=>{const next=hiddenSet(),index=Number(input.dataset.liveColumn);input.checked?next.delete(index):next.add(index);hiddenBySheet[sheet]=[...next];saveHidden();draw();});
      container.querySelectorAll('[data-live-filter-menu]').forEach(menu=>menu.ontoggle=()=>{if(menu.open)container.querySelectorAll('[data-live-filter-menu][open]').forEach(other=>{if(other!==menu)other.open=false;});});
      container.querySelectorAll('[data-live-value-search]').forEach(input=>input.oninput=()=>{const q=input.value.trim().toLocaleLowerCase('th-TH'),menu=input.closest('.mc8-excel-menu');menu.querySelectorAll('[data-excel-value-label]').forEach(label=>label.hidden=q&&!label.textContent.toLocaleLowerCase('th-TH').includes(q));});
      container.querySelectorAll('[data-live-values-all],[data-live-values-none]').forEach(button=>button.onclick=()=>{const check=button.hasAttribute('data-live-values-all'),menu=button.closest('.mc8-excel-menu');menu.querySelectorAll('[data-excel-value-label]:not([hidden]) input').forEach(input=>input.checked=check);});
      container.querySelectorAll('[data-live-sort-dir]').forEach(button=>button.onclick=()=>{sortBySheet[sheet]={index:Number(button.dataset.columnIndex),direction:button.dataset.liveSortDir};page=0;draw();});
      container.querySelectorAll('[data-live-filter-apply]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.liveFilterApply),menu=button.closest('.mc8-excel-menu'),selected=[...menu.querySelectorAll('[data-live-filter-value]:checked')].map(input=>input.value),allValues=(filterOptions[index]||[]).map(value=>String(value??''));columnFilters[sheet]=columnFilters[sheet]||{};if(selected.length===allValues.length)delete columnFilters[sheet][index];else columnFilters[sheet][index]={values:selected};page=0;draw();});
      container.querySelectorAll('[data-live-filter-clear]').forEach(button=>button.onclick=()=>{columnFilters[sheet]=columnFilters[sheet]||{};delete columnFilters[sheet][button.dataset.liveFilterClear];page=0;draw();});
      container.querySelectorAll('[data-live-text-cell]').forEach(cell=>{const toggle=event=>{if(event?.target?.closest?.('button'))return;if(event?.type==='keydown'&&!['Enter',' '].includes(event.key))return;event?.preventDefault?.();const expanded=cell.classList.toggle('mc8-cell-expanded');cell.setAttribute('aria-expanded',String(expanded));};cell.onclick=toggle;cell.onkeydown=toggle;});
      container.onkeydown=event=>{if(event.key==='Escape'&&fullscreen){fullscreen=false;draw();}};
      const exportButton=container.querySelector('#mc8-live-export');if(exportButton)exportButton.onclick=()=>{
        try{
          const sheets=buildAuditExportSheets(all,company,date,complete,root.MC8SheetSchema,data?.run?.summary?.bo_first);
          const filename=`Audit_${company}_${date}_AllCases.xlsx`;
          const result=opts.exportWorkbook?.(sheets,filename,`บริษัท ${company} · วันที่ ${date} · ${waiting.length?'ยังรอ STM · ห้ามยืนยันปิดงาน':'ข้อมูลครบทุกสถานะ'}`);
          if(!result?.ok)throw new Error(result?.reason||'ตัวเขียน Excel ยังไม่พร้อม');
          opts.onExported?.({filename,company,date,rows:all.length,sheets:sheets.length,complete:complete&&!waiting.length});
        }catch(e){error=`ออก Excel ไม่สำเร็จ: ${e.message}`;draw();}
      };
      for(const key of ['pm','direction','status'])container.querySelector(`#mc8-live-${key}`).onchange=e=>{if(key==='pm')pm=e.target.value;else if(key==='direction')direction=e.target.value;else status=e.target.value;page=0;draw();};
      container.querySelectorAll('[data-live-sheet]').forEach(b=>b.onclick=()=>{sheet=b.dataset.liveSheet;page=0;draw();});
      const prev=container.querySelector('#mc8-live-prev'),next=container.querySelector('#mc8-live-next');if(prev)prev.onclick=()=>{page--;draw();};if(next)next.onclick=()=>{page++;draw();};
      const related=shown.flatMap(row=>(row.relatedAlerts||[]).map(alert=>({row,alert})));
      if(related.length)container.insertAdjacentHTML('beforeend',`<section class="mc8-source-note" aria-label="คำเตือนที่ผูกกับรายการเดิม"><b>คำเตือนสงสัยเติมซ้ำ — ไม่เพิ่มจำนวนหรือยอดธุรกรรม</b>${related.map(({row,alert})=>`<p>${esc(row.code)} · ${esc(alert.code||alert.id)} <button data-live-case="${esc(alert.id)}">ตรวจคำเตือน</button></p>`).join('')}</section>`);
      container.querySelectorAll('[data-live-case]').forEach(b=>b.onclick=async()=>{
        const row=all.find(r=>r.key===b.dataset.liveCase),liveCase=row?.case||all.flatMap(r=>r.relatedAlerts||[]).find(e=>e.id===b.dataset.liveCase);
        if(!liveCase?.id){opts.onCaseError?.(new Error('ไม่พบ UUID ของเคสจริง กรุณารีเฟรชข้อมูลแล้วลองใหม่'),null,company);return;}
        const original=b.textContent;b.disabled=true;b.textContent='กำลังเปิด…';
        try{
          if(typeof opts.onCase!=='function')throw new Error('หน้านี้ยังไม่ได้เชื่อมตัวเปิดเคสจริง');
          await opts.onCase(liveCase,company);
        }catch(error){opts.onCaseError?.(error,liveCase,company);}
        finally{if(document.body?.contains?.(b)){b.disabled=false;b.textContent=original;}}
      });
      container.querySelectorAll('[data-live-file]').forEach(b=>b.onclick=()=>opts.onFile?.(files.find(f=>f.id===b.dataset.liveFile),date,company));
    }
    async function load({preserveView=false}={}){
      const g=++generation;if(!preserveView){data=null;files=[];page=0;}error='';fileError='';loading=true;draw();
      try{if(!opts.signedIn())throw new Error('กรุณาเข้าสู่ระบบจริงก่อนอ่านข้อมูล Audit');const next=await opts.load(company,date);if(!alive()||g!==generation)return;if(!Array.isArray(next?.cases))throw new Error('รูปแบบผลกระทบยอดไม่ถูกต้อง');data=next;if(next.run?.id&&opts.loadFiles){try{files=await opts.loadFiles(next.run.id);if(!alive()||g!==generation)return;const operatorErrors=await hydrateBoOperators(next,files,opts.readBoRecords);if(operatorErrors?.length)fileError='อ่านชื่อผู้ดำเนินการไม่ครบ: '+operatorErrors.join(' · ');}catch(e){fileError=`โหลดทะเบียนไฟล์ไม่ได้: ${e.message}`;}}}catch(e){error=e.message;}finally{if(alive()&&g===generation){loading=false;draw();}}
    }
    container.auditRefreshInPlace=async()=>{
      if(!alive())return false;
      const table=container.querySelector('.mc8-scroll'),top=table?.scrollTop||0,left=table?.scrollLeft||0;
      const x=window.scrollX,y=window.scrollY;
      await load({preserveView:true});
      if(!alive())return false;
      const next=container.querySelector('.mc8-scroll');if(next){next.scrollTop=top;next.scrollLeft=left;}
      window.scrollTo(x,y);
      if(error)throw Error(error);
      return true;
    };
    load();
  }
  root.MC8LiveSheets={mount,hydrateBoOperators,rowsOf,filter,filterAndSortEntries,columnMatch,providerOf,sheetOf,summarize,summaries,auditStatus,buildAuditExportSheets,tableView,providerHeader,providerFooter,pmAmountHeader,COMPANIES,SHEETS,ALL_HEADERS,STATEMENT_HEADERS};
  if(typeof module!=='undefined')module.exports=root.MC8LiveSheets;
})(typeof window==='undefined'?globalThis:window);
