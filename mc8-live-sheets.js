/* Read-only Audit workbook view of persisted reconciliation evidence. */
(function(root){
  'use strict';
  const COMPANIES=Object.freeze(['3XB','MC8','MR9','PS8','UR9']);
  const SHEETS=Object.freeze(['AT ถ','AT ฝ','AZ ถ','AZ ฝ','CP ถ','CP ฝ','M ถ','M ฝ']);
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
      ...pairs.map((p,index)=>({key:`pair-${index}`,isPair:true,kind:p.manualReview?'review':'matched',company:p.company||fallbackCompany,account:p.account||'ไม่ระบุ PM',direction:directionOf(p.direction),bo:p.customer?.bo||{},pm:p.customer?.stm||{},boAmount:p.boAmount??p.amount,pmAmount:p.stmAmount??p.amount,boTime:stamp(p.bo),pmTime:stamp(p.stm),boDate:p.bo?.date||'',pmDate:p.stm?.date||'',crossDay:!!p.crossDay||!!(p.bo?.date&&p.stm?.date&&p.bo.date!==p.stm.date),reason:p.manualReview?'ระบบเดิมระบุให้ตรวจเพิ่มเติม':p.method||'ผลจับคู่ที่บันทึกไว้',boSource:p.bo,pmSource:p.stm,code:`คู่ ${index+1}`,exType:''})),
      ...cases.map(e=>({key:e.id,isPair:false,kind:e.status==='closed'?'closed':'review',company:e.company||fallbackCompany,account:e.account||'ไม่ระบุ PM',direction:directionOf(e.direction),bo:e.customer_details?.bo||{},pm:e.customer_details?.stm||{},boAmount:e.system_amount,pmAmount:e.bank_amount,boTime:[e.bo_date,e.bo_time].filter(Boolean).join(' '),pmTime:[e.stm_date,e.stm_time].filter(Boolean).join(' '),boDate:e.bo_date||'',pmDate:e.stm_date||'',crossDay:e.ex_type==='cross_day'||!!(e.bo_date&&e.stm_date&&e.bo_date!==e.stm_date),reason:e.resolution_note||e.detail||e.type_name||e.ex_type||'',boRaw:e.bo_raw||'',pmRaw:e.stm_raw||'',code:e.code||e.id,exType:e.ex_type||'',case:e}))
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
  function filter(rows,pm,direction,status,sheet='all'){return rows.filter(r=>(pm==='all'||r.account===pm)&&(direction==='all'||r.direction===direction)&&(status==='all'||r.kind===status)&&(sheet==='all'||sheetOf(r)===sheet));}
  function statusOf(s,complete){return !complete?'ข้อมูลยังไม่ครบ':s.diffAfterCents===0&&s.unmatchedPmCount===0&&s.unmatchedBoCount===0&&s.duplicateCount===0?'ยอดตรง':'ต้องตรวจ';}
  function summaryRow(name,s,complete){const warning=complete&&(s.diffAfterCents||s.unmatchedPmCount||s.unmatchedBoCount||s.duplicateCount);return `<tr class="${warning?'mc8-warning':''}"><th><button type="button" data-live-sheet="${esc(name)}">${esc(name)}</button></th><td>${s.pmCount} / ${moneyCents(s.pmCents)}</td><td>${s.boCount} / ${moneyCents(s.boCents)}</td><td>${s.matchedCount} / ${moneyCents(s.matchedPmCents)}</td><td>${s.unmatchedPmCount} / ${moneyCents(s.unmatchedPmCents)}</td><td>${s.unmatchedBoCount} / ${moneyCents(s.unmatchedBoCents)}</td><td>${s.crossDayCount} / ${moneyCents(s.crossDayBoCents)}</td><td>${s.duplicateCount} / ${moneyCents(s.duplicateCents)}</td><td>${moneyCents(s.diffBeforeCents)}</td><td>${moneyCents(s.diffAfterCents)}</td><td>${statusOf(s,complete)}</td></tr>`;}
  function totalsPanel(label,s,complete){
    const rows=[['STM / PM',s.pmCount,s.pmCents,'ไม่รวมธุรกรรมซ้ำจากเคสเตือน'],['BO',s.boCount,s.boCents,'รวมรายการข้ามวัน'],['จับคู่แล้ว',s.matchedCount,s.matchedPmCents,'ยอด STM / PM ของคู่ที่บันทึกไว้'],['ยังไม่จับคู่ STM / PM',s.unmatchedPmCount,s.unmatchedPmCents,'อยู่ในเคสที่ต้องตรวจ'],['ยังไม่จับคู่ BO',s.unmatchedBoCount,s.unmatchedBoCents,'อยู่ในเคสที่ต้องตรวจ'],['BO ข้ามวัน',s.crossDayCount,s.crossDayBoCents,'แยกให้เห็นก่อนรวมเข้า BO'],['ซ้ำ / กำกวม',s.duplicateCount,s.duplicateCents,'ไม่นับซ้ำในยอดฝั่ง'],['ผลต่างก่อนรวมข้ามวัน','—',s.diffBeforeCents,'STM / PM − BO ในวัน'],['ผลต่างหลังรวมข้ามวัน','—',s.diffAfterCents,statusOf(s,complete)]];
    return `<section class="mc8-totals" aria-label="ยอดรวมท้ายตาราง"><h3>ยอดรวมท้ายตาราง · ${esc(label)}</h3><table><thead><tr><th>ฝั่ง / ผลตรวจ</th><th>จำนวน</th><th>ยอด (บาท)</th><th>หมายเหตุ</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td><td>${moneyCents(r[2])}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table><p>${complete?'คำนวณจากหลักฐานของรอบที่บันทึกไว้ โดยหักรายการอ้างอิงซ้ำก่อนรวมยอด':'หลักฐานรอบงานยังไม่ครบ ห้ามใช้ยอดนี้ยืนยันปิดงาน'}</p></section>`;
  }

  function mount(container,opts){
    const token={};slots.set(container,token);const alive=()=>slots.get(container)===token&&(opts.isActive?.()??true);
    const companies=(opts.companies||COMPANIES).filter(c=>COMPANIES.includes(c));
    let company=companies.includes(opts.company)?opts.company:(companies.includes(remembered.company)?remembered.company:companies[0]||'MC8');
    let date=remembered.date||opts.date||'2026-09-16',pm='all',direction='all',status='all',sheet='all',page=0,data=null,files=[],loading=false,error='',fileError='',generation=0;
    const labels={matched:'ระบบจับคู่แล้ว',review:'รอตรวจ / ชี้แจง',closed:'ปิดเคสแล้ว'};
    function isComplete(all){
      const evidence=Array.isArray(data?.run?.summary?.match_evidence)?data.run.summary.match_evidence.length:0,s=summarize(all);
      if(!data?.complete||data?.run?.jobStatus!=='completed'||evidence<Number(data?.run?.matched||0))return false;
      if(Number.isFinite(Number(data.run.stm_count))&&s.pmCount!==Number(data.run.stm_count))return false;
      if(Number.isFinite(Number(data.run.bo_count))&&s.boCount!==Number(data.run.bo_count))return false;
      return true;
    }
    function draw(){
      if(!alive())return;
      const all=data?rowsOf(data,company):[],shown=filter(all,pm,direction,status,sheet),pages=Math.max(1,Math.ceil(shown.length/50));page=Math.min(page,pages-1);
      const complete=!!data?.run&&isComplete(all),bySheet=summaries(all),supported=all.filter(r=>SHEETS.includes(sheetOf(r))),scope=summarize(sheet==='all'?supported:supported.filter(r=>sheetOf(r)===sheet));
      const evidence=Array.isArray(data?.run?.summary?.match_evidence)?data.run.summary.match_evidence.length:0,other=all.filter(r=>sheetOf(r)==='OTHER');
      container.innerHTML=`<section class="mc8-workbook"><header class="mc8-intro"><div><h2>ชีต Audit · 5 บริษัท</h2><p>ผลกระทบยอด STM / PM กับ BO แยก 8 หน้าตามเทมเพลต Audit</p></div><span class="mc8-pending">${esc(company)}</span></header>
        <p class="mc8-note">อ่านผลรอบงานที่บันทึกไว้เท่านั้น · ไม่รันกติกาใหม่ ไม่ปิดเคส และไม่นำไฟล์ตัวอย่างมาแทนข้อมูลจริง</p>
        <div class="mc8-filters"><label>บริษัท<select id="mc8-live-company" ${loading?'disabled':''}>${companies.map(c=>`<option value="${c}" ${company===c?'selected':''}>${c}</option>`).join('')}</select></label><label>วันที่ตรวจ<input type="date" id="mc8-live-date" value="${esc(date)}" ${loading?'disabled':''}></label><button id="mc8-live-load" ${loading?'disabled':''}>${loading?'กำลังโหลด…':'โหลดข้อมูลจริง'}</button>${company==='MC8'?'<button id="mc8-local-view">เทียบไฟล์ Excel ต้นแบบ MC8</button>':''}</div>
        ${error?`<p role="alert">${esc(error)}</p>`:''}
        ${data?.run?`<p>วันที่ผลที่โหลด: <strong>${esc(date)}</strong> · Run: ${esc(data.run.id)} · สถานะงาน: ${esc(data.run.jobStatus)}</p><p>ระบบรายงานจับคู่ ${esc(data.run.matched??'ไม่ระบุ')} คู่ · มีหลักฐานคู่ ${evidence} คู่ · โหลด ${data.cases.length} เคส</p>${!complete?'<p role="alert" class="mc8-warning">ผลหรือหลักฐานยังไม่ครบ หรือจำนวนที่สร้างใหม่ไม่ตรงกับรอบงาน ห้ามใช้ยอดนี้ยืนยันปิดงาน</p>':''}${other.length?`<p role="alert" class="mc8-warning">มี ${other.length} แถวที่จัดเข้า AT / AZ / CP / M ไม่ได้ จึงไม่ปนในยอดรวม 8 หน้า</p>`:''}
        <section class="mc8-summary"><h3>สรุปยอดแยกทุกหน้า</h3><div class="mc8-summary-scroll"><table><thead><tr><th>หน้า</th><th>STM / PM<br>รายการ / ยอด</th><th>BO<br>รายการ / ยอด</th><th>จับคู่แล้ว</th><th>ไม่จับคู่ PM</th><th>ไม่จับคู่ BO</th><th>ข้ามวัน</th><th>ซ้ำ / กำกวม</th><th>ต่างก่อนข้ามวัน</th><th>ต่างหลังข้ามวัน</th><th>สถานะ</th></tr></thead><tbody>${SHEETS.map(name=>summaryRow(name,bySheet[name],complete)).join('')}</tbody></table></div><p>จำนวนและยอดคั่นด้วย / · กดชื่อหน้าเพื่อเปิดรายละเอียด</p></section>
        <div class="mc8-tabs" role="tablist" aria-label="หน้า Audit"><button type="button" role="tab" aria-selected="${sheet==='all'}" data-live-sheet="all">รวมทั้งหมด<small>8 หน้า</small></button>${SHEETS.map(name=>`<button type="button" role="tab" aria-selected="${sheet===name}" data-live-sheet="${esc(name)}">${esc(name)}<small>${name.endsWith('ฝ')?'ฝาก':'ถอน'}</small></button>`).join('')}</div>
        <div class="mc8-filters"><label>PM<select id="mc8-live-pm"><option value="all">ทุก PM</option>${[...new Set(all.map(r=>r.account))].sort().map(a=>`<option ${pm===a?'selected':''} value="${esc(a)}">${esc(a)}</option>`).join('')}</select></label><label>ประเภท<select id="mc8-live-direction">${[['all','ฝากและถอน'],['deposit','ฝาก'],['withdraw','ถอน']].map(([v,t])=>`<option value="${v}" ${direction===v?'selected':''}>${t}</option>`).join('')}</select></label><label>ผลตรวจ<select id="mc8-live-status">${[['all','ทั้งหมด'],...Object.entries(labels)].map(([v,t])=>`<option value="${v}" ${status===v?'selected':''}>${t}</option>`).join('')}</select></label></div>
        <p role="status">แสดง ${shown.length} แถว · หน้า ${page+1}/${pages}</p><div class="mc8-scroll"><table class="mc8-grid"><thead><tr>${['สถานะ','หน้า','PM','ฝาก / ถอน','เลขเคส / คู่','BO เวลา','BO User','BO อ้างอิง','BO ยอด','PM เวลา','PM User','PM อ้างอิง','PM ยอด','เหตุผล / หมายเหตุ','หลักฐาน'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${shown.slice(page*50,page*50+50).map(r=>`<tr class="${r.kind==='review'?'mc8-warning':''}">${[labels[r.kind],sheetOf(r),r.account,r.direction==='deposit'?'ฝาก':r.direction==='withdraw'?'ถอน':'ไม่ระบุ',r.code,r.boTime,r.bo.user,r.bo.reference,money(r.boAmount),r.pmTime,r.pm.user,r.pm.reference,money(r.pmAmount),r.reason].map(v=>`<td title="${esc(v)}">${esc(v)||'—'}</td>`).join('')}<td>${r.case?`<button data-live-case="${esc(r.key)}">เปิดเคสจริง</button>`:`BO แถว ${esc(r.boSource?.row??'—')} · PM แถว ${esc(r.pmSource?.row??'—')}`}</td></tr>`).join('')||'<tr><td colspan="15">ไม่พบรายการตามตัวกรอง</td></tr>'}</tbody></table></div><div class="mc8-filters"><button id="mc8-live-prev" ${page===0?'disabled':''}>ก่อนหน้า</button><button id="mc8-live-next" ${page+1>=pages?'disabled':''}>ถัดไป</button></div>
        ${totalsPanel(sheet==='all'?'รวม 8 หน้า':sheet,scope,complete)}
        <details><summary>ไฟล์ต้นทางของผลรอบนี้ (${files.length})</summary>${fileError?`<p role="alert">${esc(fileError)}</p>`:''}<ul>${files.map(f=>`<li>${esc(f.file_name)} · ${esc(f.kind)} ${opts.onFile?`<button data-live-file="${esc(f.id)}">ดูไฟล์ต้นทาง</button>`:''}</li>`).join('')}</ul></details>`:!loading&&!error?`<p>ยังไม่มีผลกระทบยอดที่อ่านได้ของ ${esc(company)} ในวันที่เลือก</p>`:''}</section>`;
      container.querySelector('#mc8-live-company').onchange=e=>{company=e.target.value;remembered.company=company;opts.onCompany?.(company);sheet='all';pm='all';load();};
      container.querySelector('#mc8-live-load').onclick=()=>{const v=container.querySelector('#mc8-live-date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){error='กรุณาเลือกวันที่';draw();return;}date=v;remembered.date=v;opts.onDate?.(date);load();};
      const local=container.querySelector('#mc8-local-view');if(local)local.onclick=()=>{slots.delete(container);opts.onLocal?.();};
      if(!data?.run)return;
      for(const key of ['pm','direction','status'])container.querySelector(`#mc8-live-${key}`).onchange=e=>{if(key==='pm')pm=e.target.value;else if(key==='direction')direction=e.target.value;else status=e.target.value;page=0;draw();};
      container.querySelectorAll('[data-live-sheet]').forEach(b=>b.onclick=()=>{sheet=b.dataset.liveSheet;page=0;draw();});
      container.querySelector('#mc8-live-prev').onclick=()=>{page--;draw();};container.querySelector('#mc8-live-next').onclick=()=>{page++;draw();};
      container.querySelectorAll('[data-live-case]').forEach(b=>b.onclick=()=>opts.onCase?.(all.find(r=>r.key===b.dataset.liveCase)?.case,company));
      container.querySelectorAll('[data-live-file]').forEach(b=>b.onclick=()=>opts.onFile?.(files.find(f=>f.id===b.dataset.liveFile),date,company));
    }
    async function load(){
      const g=++generation;data=null;files=[];error='';fileError='';loading=true;page=0;draw();
      try{if(!opts.signedIn())throw new Error('กรุณาเข้าสู่ระบบจริงก่อนอ่านข้อมูล Audit');const next=await opts.load(company,date);if(!alive()||g!==generation)return;if(!Array.isArray(next?.cases))throw new Error('รูปแบบผลกระทบยอดไม่ถูกต้อง');data=next;if(next.run?.id&&opts.loadFiles){try{files=await opts.loadFiles(next.run.id);}catch(e){fileError=`โหลดทะเบียนไฟล์ไม่ได้: ${e.message}`;}}}catch(e){error=e.message;}finally{if(alive()&&g===generation){loading=false;draw();}}
    }
    load();
  }
  root.MC8LiveSheets={mount,rowsOf,filter,providerOf,sheetOf,summarize,summaries,COMPANIES,SHEETS};
  if(typeof module!=='undefined')module.exports=root.MC8LiveSheets;
})(typeof window==='undefined'?globalThis:window);
