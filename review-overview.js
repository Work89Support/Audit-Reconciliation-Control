/* One read-only work sheet: matching evidence and review cases are different units.
   No automatic closure, inferred customer identity, or fabricated successful rows. */
const ReviewOverview = (() => {
  const instances = new WeakMap();
  const workspaces = new Map();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = { all:'ทั้งหมด', matched:'จับคู่สำเร็จ', review:'รอ Audit ตรวจ', clarification:'รอชี้แจง / ตรวจคำตอบ', closed:'ปิดเคสแล้ว' };
  const splitHeaders=['อ้างอิง PM','Provider','บัญชีจ่ายยอดซอย','ยอดขอถอน','PM จ่ายจริง','BO ยอดซอย','ธนาคารจ่ายจริง','PM + ธนาคาร','ต่างจากคำขอ','สถานะ / สิ่งที่ต้องตรวจ'];
  function splitRows(data,values={}) {
    const summary=data?.run?.summary||{},pairs=summary.match_evidence||[];
    if(values.direction==='deposit'||(values.status&&!['all','review'].includes(values.status)))return [];
    const money=n=>Number.isSafeInteger(n)?n/100:null;
    return (summary.split_payout_evidence||[]).filter(e=>e.direction==='withdraw')
      .filter(e=>!values.account||[e.provider,e.boSplit?.account].includes(values.account))
      .filter(e=>!values.query||JSON.stringify(e).toLowerCase().includes(values.query.trim().toLowerCase()))
      .map(e=>{
        // Only display actual bank money from an unambiguous stored pair.
        // Never substitute the BO split amount for an absent bank payment.
        const bankPairs=e.bank?.fileId ? pairs.filter(p=>p.direction==='withdraw'&&p.company===e.company
          &&p.stm?.fileId===e.bank.fileId&&p.stm?.row===e.bank.row
          &&p.bo?.fileId===e.boSplit?.fileId&&p.bo?.row===e.boSplit?.row) : [];
        const raw=bankPairs.length===1?bankPairs[0].stmAmount:null;
        const cents=typeof raw==='number'&&Number.isFinite(raw)&&Math.abs(raw*100-Math.round(raw*100))<1e-7?Math.round(raw*100):null;
        const total=cents!==null&&Number.isSafeInteger(e.paidCents)?cents+e.paidCents:null;
        const issues=(e.issues||[]).map(i=>({BANK_PAYMENT_NOT_MATCHED:'ยังไม่พบคู่ธนาคาร',AMOUNT_DIFFERENCE:'BO ยอดซอยต่างจากยอดคงเหลือ PM',SOURCE_PROVENANCE_MISSING:'อ้างอิงไฟล์ไม่ครบ'})[i]||i);
        if(cents===null&&!issues.includes('ยังไม่พบคู่ธนาคาร'))issues.push('ยังยืนยันยอดธนาคารไม่ได้');
        return [e.reference,e.provider,e.boSplit?.account,money(e.requestedCents),money(e.paidCents),money(e.splitCents),money(cents),money(total),total!==null&&Number.isSafeInteger(e.requestedCents)?money(e.requestedCents-total):null,
          'รอ Audit ตรวจ'+(issues.length?' · '+issues.join(' / '):' · ยอดเชื่อมครบ ยังไม่ใช่การปิดเคส')];
      });
  }
  function splitHtml(data,values={}) {
    const rows=splitRows(data,values);
    if(!rows.length)return '';
    const cell=(v,i)=>v==null?'—':i>=3&&i<=8?Number(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}):escape(v);
    return `<section class="panel"><details open><summary>ตรวจยอดถอนซอย · ${rows.length} รายการ</summary><p>หลักฐานประกอบ ไม่รวมเพิ่มในจำนวนคู่หรือยอดรวมด้านบน · ช่องว่างคือยังไม่มีหลักฐาน · ส่วนต่างยังไม่ใช่ความเสียหาย</p><div style="overflow:auto"><table><thead><tr>${splitHeaders.map(h=>`<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((v,i)=>`<td>${cell(v,i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></section>`;
  }
  function caseState(e) {
    if (e.status === 'closed') return 'closed';
    if (['clarifying','answered'].includes(e.status)) return 'clarification';
    return 'review';
  }
  function model(data) {
    const preliminary = typeof PreliminaryReview !== 'undefined' ? PreliminaryReview.manualCandidates(data) : new Set();
    const evidence = Array.isArray(data.run?.summary?.match_evidence) ? data.run.summary.match_evidence : [];
    const confirmed=new Map((data.confirmations||[]).map(c=>[c.pair_index,c]));
    const pairs = evidence.map((e,i) => ({ id:`pair-${i}`, pairIndex:i,confirmation:confirmed.get(i),category:e.manualReview ? 'review' : 'matched', pair:e, direction:e.direction, account:e.account || '', search:JSON.stringify(e) }));
    const cases = data.cases.map(e => ({ id:e.id, preliminary:preliminary.has(e.id), category:caseState(e), case:e, direction:e.direction === 'ฝาก' ? 'deposit' : e.direction === 'ถอน' ? 'withdraw' : e.direction, account:e.account || '', search:JSON.stringify(e) }));
    return { rows:[...pairs,...cases], evidenceCount:evidence.length, reportedMatched:Number(data.run?.matched || 0), counts:Object.fromEntries(Object.keys(labels).map(k => [k, k === 'all' ? pairs.length + cases.length : [...pairs,...cases].filter(r => r.category === k).length])) };
  }
  function filter(rows, values) {
    const q = values.query.trim().toLowerCase();
    return rows.filter(r => (values.status === 'all' || r.category === values.status) && (values.direction === 'all' || r.direction === values.direction) && (!values.account || r.account === values.account) && (!q || r.search.toLowerCase().includes(q)));
  }
  const detailHeaders=['วัน / เวลา','ยอด','บัญชีลูกค้า','ท้าย 4','ธนาคารลูกค้า','ชื่อ / User','User','อ้างอิง','รายละเอียดต้นฉบับ'];
  function auditLabel(row) {
    if (!row.case) return row.confirmation?'Audit ยืนยันแล้ว':'ยังไม่ยืนยันโดย Audit';
    return ({open:'รอตรวจ',pending:'รอตรวจ',clarifying:'รอชี้แจง',answered:'รอตรวจคำตอบ',closed:'ยืนยันแล้ว ปิดเคส',approved:'อนุมัติแล้ว',damage:'ความเสียหาย'})[row.case.status] || row.case.status;
  }
  function xbPayoutNote(row) {
    if(row.direction!=='withdraw'||!['AUTOPEER','MYPAY'].includes(row.account))return '';
    const note=row.pair?.customer?.bo?.note||row.case?.customer_details?.bo?.note||'';
    // This is a BO claim, not a linked PM payment or proof of a refund.
    const amount='((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)';
    const matches=[...String(note).matchAll(new RegExp('(?:^|\\|)\\s*โอนจริง\\s+'+amount+'\\s+สำเร็จ\\s+'+amount+'\\s+คืน\\s+'+amount+'(?=\\s*(?:$|\\|))','g'))];
    if(matches.length!==1)return '';
    const cents=s=>{
      const [whole,frac='']=s.replace(/,/g,'').split('.');
      const n=Number(whole)*100+Number(frac.padEnd(2,'0'));
      return Number.isSafeInteger(n)?n:null;
    };
    const [requested,paid,returned]=matches[0].slice(1).map(cents);
    if([requested,paid,returned].includes(null))return '';
    const money=n=>(n/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
    return `BO ระบุ: โอนจริง ${money(requested)} / สำเร็จ ${money(paid)} / คืน ${money(returned)} · ${requested===paid+returned?'ยอดตามหมายเหตุสมดุล':'ยอดตามหมายเหตุไม่สมดุล'} · ยังไม่ยืนยัน PM จ่ายจริง ยอดคืน หรือรายการถอนต่อ`;
  }
  function sheetRow(row) {
    const p=row.pair,e=row.case;
    const side=(which)=>{
      const c=p?.customer?.[which] || e?.customer_details?.[which] || {};
      const t=p?.[which];
      const time=p ? (t?.date ? `${t.date} ${Number.isFinite(t.sec)?new Date(t.sec*1000).toISOString().slice(11,19):'ไม่ระบุเวลา'}`:'ไม่ระบุเวลา') : `${e?.[which+'_date']||'ไม่พบรายการ'} ${e?.[which+'_time']||''}`.trim();
      const sourceText=[...new Set([c.description,c.note].filter(Boolean))].join(' | ');
      return [time,p ? (which==='bo'?p.boAmount??p.amount:p.stmAmount) : (which==='bo'?e.system_amount:e.bank_amount),c.account||'',c.last4||'',c.bank||'',c.name||(c.user?'User: '+c.user:''),c.user||'',c.reference||'',sourceText];
    };
    const seconds=p?p.timeDifferenceSeconds:e?.bo_date&&e?.stm_date?e.time_diff_sec:null;
    const payout=p?.pmPayout?.partial ? ` · PM ${p.pmPayout.status}: คำขอ ${p.pmPayout.requested??'ไม่ระบุ'} / จ่ายจริง ${p.pmPayout.paid??'ไม่ระบุ'} / คงเหลือ ${p.pmPayout.unpaid??'ไม่ระบุ'} (ยังไม่ยืนยันยอดคืนหรือรายการต่อ)` : '';
    const noteReview=xbPayoutNote(row);
    const withinHour=!p&&e?.ex_type==='time_diff'&&/^\d{4}-\d{2}-\d{2}$/.test(e.bo_date||'')&&e.bo_date===e.stm_date
      &&typeof seconds==='number'&&Number.isFinite(seconds)&&Math.abs(seconds)<=3600;
    const reason=e?.status==='closed'?'Audit ยืนยันปิดแล้ว — ดูเหตุผลและหลักฐานการปิดเคส':withinHour?'เวลาอยู่ใน 60 นาที แต่ระบบยังไม่ยืนยันคู่ — ตรวจข้อมูลลูกค้า เลขอ้างอิง และคู่ซ้ำ':(p?.manualReview?'เติมมือ: ต้องตรวจเอกสาร':p?.method||e?.detail||'');
    return [p?'จับคู่ได้':withinHour?(e?.status==='closed'?'ใน 60 นาที — Audit ปิดแล้ว':'ใน 60 นาที — รอยืนยันคู่รายการ'):e.type_name||e.ex_type||'ต้องตรวจ',auditLabel(row),e?.code||'คู่รายการ',row.account,row.direction==='deposit'?'ฝาก':row.direction==='withdraw'?'ถอน':'ไม่ระบุประเภท',...side('bo'),...side('stm'),seconds==null?'':`${Math.floor(Math.abs(seconds)/60)} นาที ${Math.abs(seconds)%60} วินาที`,reason+payout+(noteReview?' · '+noteReview:''),e?.resolution_note||''];
  }
  const sheetHeaders=['ผลตรวจระบบ','สถานะ Audit','เลขเคส','บัญชีบริษัท / Provider','ประเภท',...detailHeaders.map(h=>'BO · '+h),...detailHeaders.map(h=>'STM/PM · '+h),'ต่างเวลา','เหตุผลระบบ','หมายเหตุ Audit'];
  const allHeaders=[...sheetHeaders,'เอกสารอ้างอิง'];
  function columnValue(row,i) {
    if(i===26)return row.case?'เปิดหลักฐาน / เมล':'คู่สำเร็จ ยังไม่ยืนยัน Audit';
    if(i===23)return row.pair?.timeDifferenceSeconds ?? (row.case?.bo_date&&row.case?.stm_date?row.case.time_diff_sec:null);
    return sheetRow(row)[i];
  }
  function filterColumns(rows,rules={},sort={column:5,direction:'asc'}) {
    const cell=(r,i)=>columnValue(r,Number(i));
    const filtered=rows.filter(r=>Object.entries(rules).every(([i,f])=>{
      const raw=cell(r,i),s=String(raw??'').toLowerCase(),v=String(f.value??'').trim().toLowerCase();
      if(f.op==='blank')return raw==null||raw==='';
      if(f.op==='filled')return raw!=null&&raw!=='';
      if(f.op==='equals')return s===v;
      if(f.op==='gte'||f.op==='lte'){
        if(raw==null||raw===''||v==='')return false;
        const numeric=[6,15,23].includes(Number(i));
        const a=numeric?Number(raw):s,b=numeric?Number(v.replace(/,/g,'')):v;
        return f.op==='gte'?a>=b:a<=b;
      }
      return s.includes(v);
    }));
    const key=r=>{
      const i=Number(sort.column),v=cell(r,i);
      if(i===5||i===14){
        const valid=x=>/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(String(x));
        return valid(v)?v:(i===5&&valid(cell(r,14))?cell(r,14):null);
      }
      return v;
    };
    return filtered.sort((a,b)=>{
      const x=key(a),y=key(b),empty=v=>v==null||v==='';
      if(empty(x)||empty(y))return Number(empty(x))-Number(empty(y));
      const n=[6,15,23].includes(Number(sort.column))?Number(x)-Number(y):String(x).localeCompare(String(y),'th',{numeric:true});
      return sort.direction==='desc'?-n:n;
    });
  }
  const columnKey='audit-sheet-columns-v1';
  const compactHidden=[2,9,11,12,13,18,20,21,22,25];
  function normalizeHidden(value) {
    return Array.isArray(value) ? [...new Set(value.filter(i=>Number.isInteger(i)&&i>=2&&i<=26))] : [];
  }
  async function mount(root, {company,date,minDate='',load,loadRecommendations,onRecommendation,onCase,onCompany,onExport,onConfirm,onBulkClose,onDateChange,onBatchStatus,isActive=()=>true}) {
    const scopedDate = value => minDate && (!value || value < minDate) ? minDate : value;
    date = scopedDate(date);
    const instance = {}; instances.set(root,instance);
    let data, view, page = 0, generation = 0;
    let columnRules={},columnSort={column:5,direction:'asc'};
    let preliminaryOnly=false;
    const selected=new Set();
    let pendingActions=new Map(), statusSelected=new Set();
    const dateKey='audit-review-date-v1:'+company;
    try { const saved=sessionStorage.getItem(dateKey); if(/^\d{4}-\d{2}-\d{2}$/.test(saved||'')) date=scopedDate(saved); } catch(_) {}
    onDateChange?.(date);
    let hidden=[];
    try { hidden=normalizeHidden(JSON.parse(localStorage.getItem(columnKey))); } catch (_) {}
    const values = {status:'all', direction:'all', account:'', query:''};
    const savedView=workspaces.get(company+'|'+date);
    if(savedView){Object.assign(values,savedView.values);columnRules=savedView.columnRules;columnSort=savedView.columnSort;page=savedView.page;preliminaryOnly=savedView.preliminaryOnly;pendingActions=savedView.pendingActions;statusSelected=savedView.statusSelected;}
    const amount = n => n == null ? '—' : Number(n).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
    const timestamp = side => !side?.date ? 'ไม่ระบุ' : `${side.date} ${Number.isFinite(side.sec) ? new Date(side.sec*1000).toISOString().slice(11,19) : 'ไม่ระบุเวลา'}`;
    const customer = p => `<small>บัญชีลูกค้า: ${escape(p?.account || (p?.last4 ? 'ปิดบังเลขบัญชี · ท้าย '+p.last4 : 'ไม่ระบุ'))}<br>ธนาคารลูกค้า: ${escape(p?.bank || 'ไม่ระบุ')}<br>ชื่อ: ${escape(p?.name || 'ไม่ระบุ')}<br>User: ${escape(p?.user || 'ไม่ระบุ')}<br>อ้างอิง: ${escape(p?.reference || 'ไม่ระบุ')}${p?.description ? '<br>รายละเอียดต้นฉบับ: '+escape(p.description) : ''}</small>`;
    function legacyRowHtml(row) {
      const p=row.pair, e=row.case;
      const b=p ? timestamp(p.bo) : e.bo_date ? `${e.bo_date} ${e.bo_time || 'ไม่ระบุเวลา'}` : 'ไม่พบ BO';
      const s=p ? timestamp(p.stm) : e.stm_date ? `${e.stm_date} ${e.stm_time || 'ไม่ระบุเวลา'}` : 'ไม่พบ STM/PM';
      const why=p ? (p.method==='customer-account-amount-same-day-60m' ? 'บัญชีลูกค้า + ยอด + วันเดียวกัน ภายใน 60 นาที' : 'จับคู่ตามกฎเดิม — ตรวจหลักฐานประกอบ') : e.type_name || e.ex_type;
      return `<tr><td><span class="badge ${row.category==='matched' || row.category==='closed' ? 'green':'orange'}">${escape(labels[row.category])}</span><small>${p?'คู่รายการ':escape(e.code)}</small></td><td>${escape(row.account)}<small>${row.direction==='deposit'?'ฝาก':row.direction==='withdraw'?'ถอน':'ไม่ระบุประเภท'}</small></td><td>${escape(b)}${customer(p?.customer?.bo || e?.customer_details?.bo)}</td><td class="right">${amount(p ? p.boAmount ?? p.amount : e.system_amount)}</td><td>${escape(s)}${customer(p?.customer?.stm || e?.customer_details?.stm)}</td><td class="right">${amount(p ? p.stmAmount : e.bank_amount)}</td><td>${p || (e.bo_date && e.stm_date) ? escape(p ? p.timeDifferenceSeconds : e.time_diff_sec)+' วินาที' : '—'}</td><td>${escape(why)}${p?.manualReview?'<p>เติมมือ: ยังต้องตรวจเอกสาร</p>':''}${p?`<details><summary>ที่มารายคู่</summary><p>BO แถว ${escape(p.bo?.row ?? 'ไม่ระบุ')} · ไฟล์ ${escape(p.bo?.fileId || 'ไม่ได้เก็บรหัสไฟล์')}</p><p>STM/PM แถว ${escape(p.stm?.row ?? 'ไม่ระบุ')} · ไฟล์ ${escape(p.stm?.fileId || 'ไม่ได้เก็บรหัสไฟล์')}</p></details>`:`<button class="ghost-button sm" data-overview-case="${escape(e.id)}">เปิดตรวจเคส</button>`}</td></tr>`;
    }
    function rowHtml(row) {
      const cells=sheetRow(row);
      return `<tr>${cells.map((v,i)=>`<td class="sheet-col-${i} ${[6,15].includes(i)?'sheet-money':''}">${i===1&&row.case?`<select aria-label="สถานะ Audit ${escape(row.case.code)}" data-audit-action="${escape(row.id)}"><option value="">${escape(v)}</option><option value="review">ตรวจรายละเอียด</option><option value="files">เลือกหลักฐาน / Preview</option><option value="close">ยืนยันปิดเคส…</option><option value="clarify">รอชี้แจง…</option><option value="answer">ตรวจคำตอบ…</option></select>`:i===0?`<span class="sheet-result ${row.pair?'is-match':'is-review'}">${escape(v)}</span>`:[6,15].includes(i)?amount(v):escape(v??'—')||'—'}</td>`).join('')}<td>${row.case?`<button class="ghost-button sm" data-overview-case="${escape(row.id)}">📎 หลักฐาน / เมล</button>`:'คู่สำเร็จยังไม่ใช่การอนุมัติปิดเคส'}</td></tr>`;
    }
    function draw(error='') {
      if (!root.isConnected || instances.get(root)!==instance || !isActive()) return;
      const rows=view ? filterColumns(filter(view.rows,values),columnRules,columnSort).filter(r=>!preliminaryOnly||r.preliminary) : [];
      // Selection is scoped to the visible filter, not hidden cases from a previous view.
      if(view)for(const id of selected) if(!rows.some(r=>r.id===id&&r.preliminary)) selected.delete(id);
      const pages=Math.max(1,Math.ceil(rows.length/50)); if(view)page=Math.min(page,pages-1);
      workspaces.set(company+'|'+date,{values:{...values},columnRules,columnSort,page,preliminaryOnly,pendingActions,statusSelected});
      const accounts=view ? [...new Set(view.rows.map(r=>r.account))].sort() : [];
      root.innerHTML=`<section class="panel"><div class="panel-heading"><div><h2>${escape(company)} · ภาพรวมผลตรวจ</h2><p>คู่สำเร็จและเคสที่ยังต้องตรวจ อยู่ในหน้าเดียวกัน</p></div><button id="overviewCompany" class="ghost-button">เปลี่ยนบริษัท</button></div><div class="review-overview-controls"><label>วันที่ตรวจ<input id="overviewDate" type="date" value="${escape(date)}"></label><label>ประเภท<select id="overviewDirection"><option value="all">ฝากและถอน</option value="deposit" ${values.direction==='deposit'?'selected':''}>ฝาก</option><option value="withdraw" ${values.direction==='withdraw'?'selected':''}>ถอน</option></select></label><label>บัญชี / Provider<select id="overviewAccount"><option value="">ทั้งหมด</option>${accounts.map(a=>`<option ${a===values.account?'selected':''} value="${escape(a)}">${escape(a)}</option>`).join('')}</select></label><label>ค้นหาบัญชี ชื่อ User หรืออ้างอิง<input id="overviewQuery" value="${escape(values.query)}"></label><button id="overviewRefresh" class="ghost-button">รีเฟรช</button></div><div class="review-overview-states" aria-label="กรองสถานะ">${Object.entries(labels).map(([key,label])=>`<button data-overview-status="${key}" aria-pressed="${values.status===key}" class="${values.status===key?'primary-button':'ghost-button'}">${label} <b>${view?view.counts[key].toLocaleString():'—'}</b></button>`).join('')}</div>${error?`<p role="alert">โหลดผลไม่ได้: ${escape(error)} <button id="overviewRetry">ลองอีกครั้ง</button></p>`:!data?'<p role="status">กำลังอ่านผลล่าสุด…</p>':!data.run?'<p>ยังไม่มีผลประมวลผลของบริษัทและวันที่นี้</p>':`<p>สถานะงาน: ${escape(data.run.jobStatus)} · ระบบรายงานจับคู่ ${view.reportedMatched.toLocaleString()} คู่ · มีรายละเอียดเปิดดู ${view.evidenceCount.toLocaleString()} คู่</p>${view.evidenceCount<view.reportedMatched?'<div class="alert"><strong>รายละเอียดคู่สำเร็จยังเก็บไม่ครบ</strong><span>ยอดรวมมีแล้ว แต่ยังไม่สามารถแสดงคู่ที่ไม่ได้บันทึกหลักฐาน ต้องใช้ Worker ที่เก็บรายละเอียดและประมวลผลใหม่ ไม่ได้หมายความว่าจับคู่ไม่ได้</span></div>':''}${data.run.jobStatus!=='completed'?'<p role="alert">งานยังไม่เสร็จสมบูรณ์ รายละเอียดนี้อาจเป็นผลรอบก่อน</p>':''}${!data.complete?'<p role="alert">โหลดเคสยังไม่ครบ จำนวนด้านล่างเป็นเฉพาะที่โหลดแล้ว</p>':''}<p>ตัวกรองสถานะนับจากรายละเอียดที่โหลดได้ คู่สำเร็จไม่ใช่การอนุมัติปิดเคส คู่หนึ่งอาจมีเคสเตือนเพิ่มเติม จึงไม่ใช่จำนวนธุรกรรมที่ไม่ซ้ำ</p>`}</section><section class="panel"><p>แสดง ${rows.length.toLocaleString()} แถวตามตัวกรอง · หน้า ${page+1}/${pages}</p><div class="table-wrap"><table class="rows review-overview-table"><thead><tr><th>สถานะ</th><th>บัญชี / ประเภท</th><th>BO · เวลาและลูกค้า</th><th>ยอด BO</th><th>STM/PM · เวลาและลูกค้า</th><th>ยอด STM/PM</th><th>ต่างเวลา</th><th>เหตุผล / ตรวจต่อ</th></tr></thead><tbody>${rows.slice(page*50,page*50+50).map(rowHtml).join('') || '<tr><td colspan="8">ยังไม่มีรายละเอียดในตัวกรองนี้</td></tr>'}</tbody></table></div><div class="pager"><button id="overviewPrev" ${page===0?'disabled':''}>ก่อนหน้า</button><button id="overviewNext" ${page+1>=pages?'disabled':''}>ถัดไป</button></div></section>`;
      const directionTabs=document.createElement('div');
      directionTabs.className='review-overview-states';
      directionTabs.setAttribute('role','group');
      directionTabs.setAttribute('aria-label','ชีตทั้งหมด ฝาก ถอน');
      directionTabs.innerHTML=Object.entries({all:'ทั้งหมด',deposit:'ฝาก',withdraw:'ถอน'}).map(([key,label])=>`<button type="button" data-sheet-direction="${key}" aria-pressed="${values.direction===key}" class="${values.direction===key?'primary-button':'ghost-button'}">${label}</button>`).join('');
      root.querySelector('.review-overview-states').before(directionTabs);
      root.querySelector('#overviewDirection').closest('label').hidden=true;
      directionTabs.querySelectorAll('button').forEach(button=>button.onclick=()=>{
        values.direction=button.dataset.sheetDirection;
        selected.clear();page=0;draw();
      });
      const table=root.querySelector('.review-overview-table');
      table.classList.add('audit-sheet');
      if(typeof EvidenceRecommendations!=='undefined' && onRecommendation) EvidenceRecommendations.decorateRows(table,rows.slice(page*50,page*50+50),data?.recommendationLinks,data?.run?.id,onRecommendation);
      table.querySelector('thead').innerHTML=`<tr><th colspan="5">ผลตรวจระบบ / Audit</th><th colspan="9" class="bo-group">BO / ระบบ</th><th colspan="9" class="stm-group">STM / PM</th><th colspan="4">ผลเทียบ / หลักฐาน</th></tr><tr>${[...sheetHeaders,'เอกสารอ้างอิง'].map(x=>`<th>${escape(x)}</th>`).join('')}</tr>`;
      const toolbar=document.createElement('div'); toolbar.className='audit-sheet-tools';
      toolbar.innerHTML=`<span>เลือกสถานะเพื่อเปิดตรวจและยืนยัน • ไม่ส่งข้อความอัตโนมัติ</span><button class="ghost-button" id="overviewExport" ${!onExport||!data?.complete?'disabled':''}>Export Excel ตามตัวกรอง (${rows.length})</button>`;
      table.parentElement.before(toolbar);
      if(onBatchStatus){
        const batch=document.createElement('section');batch.className='audit-sheet-tools';
        batch.innerHTML=`<label>ทำกับรายการที่ติ๊ก <select id="auditBatchAction"><option value="clarify">ส่งขอชี้แจง</option><option value="close">ยืนยันปิดเคสที่ผ่านเกณฑ์</option></select></label><button id="auditStageSelected" class="ghost-button">เตรียมสถานะที่เลือก (${statusSelected.size})</button><button id="auditSaveStatuses" class="primary-button" ${pendingActions.size?'':'disabled'}>บันทึกสถานะ (${pendingActions.size})</button><button id="auditDiscardStatuses" class="ghost-button">ล้างที่เตรียมไว้</button><span role="status">ยังไม่บันทึกจนกดบันทึกสถานะและยืนยัน</span>`;
        toolbar.before(batch);
        const selectAll=document.createElement('button');selectAll.type='button';selectAll.className='ghost-button';selectAll.textContent='เลือกเคสตามตัวกรอง (ทุกหน้า)';selectAll.onclick=()=>{for(const r of rows)if(r.case&&['open','answered'].includes(r.case.status))statusSelected.add(r.case.id);draw();};batch.prepend(selectAll);
        batch.querySelector('#auditStageSelected').onclick=()=>{const action=batch.querySelector('select').value;for(const id of statusSelected)pendingActions.set(id,action);draw();};
        batch.querySelector('#auditDiscardStatuses').onclick=()=>{pendingActions.clear();statusSelected.clear();draw();};
        batch.querySelector('#auditSaveStatuses').onclick=()=>onBatchStatus([...pendingActions].map(([id,action])=>({row:data.cases.find(e=>e.id===id),action})),{company,date,onComplete:async()=>{pendingActions.clear();statusSelected.clear();await refreshInPlace();}});
      }
      const runStatus=document.createElement('p');runStatus.className='sheet-active-filters';
      runStatus.textContent=`การประมวลผล: ${({completed:'เสร็จแล้ว',queued:'รอประมวลผลใหม่ — ข้อมูลที่เห็นเป็นผลรอบก่อน',ready:'พร้อมประมวลผล — ยังไม่ยืนยันผลใหม่',processing:'กำลังประมวลผล',needs_review:'ต้องตรวจข้อมูลก่อน'})[data?.run?.jobStatus]||data?.run?.jobStatus||'ยังไม่มีผล'} • Audit ยืนยัน ${data?.confirmations?.length||0} คู่ (แยกจากการปิดเคส)`;
      if(data?.confirmationError)runStatus.textContent=runStatus.textContent.replace('Audit ยืนยัน 0 คู่','Audit ยืนยัน — คู่')+' • ยังโหลดประวัติ Audit ไม่ได้ จึงปิดปุ่มยืนยันไว้';
      toolbar.before(runStatus);
      if(loadRecommendations){const hint=document.createElement('p');hint.className='sheet-active-filters';hint.textContent=data?.recommendationError?'โหลดคู่แนะนำไม่ได้: '+data.recommendationError:'🟡 พื้นเหลือง = มีหลักฐานแนะนำที่เชื่อมกับเคสนี้ · ยังไม่ยืนยันและไม่ปิดเคส';toolbar.before(hint);}
      const splitPanel=document.createElement('div');splitPanel.innerHTML=splitHtml(data,values);root.append(splitPanel);
      toolbar.querySelector('button').onclick=()=>onExport?.(`ผลตรวจ_${company}_${date}`,[{name:values.direction==='all'?'ทั้งหมด':'ตามตัวกรอง',headers:sheetHeaders,rows:rows.map(sheetRow)},...['deposit','withdraw'].map(d=>({name:d==='deposit'?'ฝาก':'ถอน',headers:sheetHeaders,rows:rows.filter(r=>r.direction===d).map(sheetRow)})),{name:'ยอดซอย-หลักฐาน',headers:splitHeaders,rows:splitRows(data,values)}],{date,company});
      if(typeof PreliminaryReview!=='undefined') {
        const eligible=(view?.rows||[]).filter(r=>r.preliminary);
        const picked=PreliminaryReview.selectedRows(rows,selected);
        const bar=document.createElement('div');bar.className='audit-sheet-tools';
        bar.innerHTML=`<button id="preliminaryFilter" aria-pressed="${preliminaryOnly}" class="${preliminaryOnly?'primary-button':'ghost-button'}">ผ่านเกณฑ์เบื้องต้น — รอยืนยัน (${eligible.length}) · ${amount(PreliminaryReview.total(eligible))} บาท</button><span>เฉพาะ ${escape(company)} / ${escape(date)} · ไม่ใช่การอนุมัติปิดเคส</span><button id="preliminaryAll" ${!rows.some(r=>r.preliminary)?'disabled':''}>เลือกทั้งหมดตามตัวกรอง (ทุกหน้า)</button><button id="preliminaryClear" ${!picked.length?'disabled':''}>ล้างที่เลือก</button><strong>เลือก ${picked.length} เคส · ${amount(PreliminaryReview.total(picked))} บาท</strong><button id="preliminaryExport" ${!picked.length||!onExport?'disabled':''}>Export เคสที่เลือก</button><button id="preliminaryOpen" ${!picked.length?'disabled':''}>เปิดตรวจเคสที่เลือกทีละเคส</button>`;
        toolbar.before(bar);
        if(onBulkClose){
          const approve=document.createElement('button');
          approve.id='preliminaryApprove';approve.className='primary-button';
          approve.textContent=`อนุมัติและปิดเคสที่เลือก (${picked.length})`;
          approve.disabled=!picked.length;
          approve.onclick=()=>onBulkClose(picked.map(r=>r.case),{company,date,onComplete:refresh});
          bar.append(approve);
        }
        bar.querySelector('#preliminaryFilter').onclick=()=>{preliminaryOnly=!preliminaryOnly;values.status='all';page=0;draw();};
        bar.querySelector('#preliminaryAll').onclick=()=>{rows.filter(r=>r.preliminary).forEach(r=>selected.add(r.id));draw();};
        bar.querySelector('#preliminaryClear').onclick=()=>{selected.clear();draw();};
        bar.querySelector('#preliminaryExport').onclick=()=>onExport?.(`รอยืนยัน_${company}_${date}`,[{name:'รอยืนยัน-ที่เลือก',headers:sheetHeaders,rows:picked.map(sheetRow)}],{date,company});
        bar.querySelector('#preliminaryOpen').onclick=()=>{const first=picked[0];if(first){selected.delete(first.id);draw();onCase(first.case,{action:'review'});}};
        table.querySelectorAll('tbody tr').forEach((tr,i)=>{
          const row=rows[page*50+i];if(!row?.preliminary)return;
          const label=document.createElement('label');
          label.style.cssText='display:flex;gap:8px;align-items:center;background:#fff4cc;padding:8px;border-radius:6px;white-space:normal';
          label.innerHTML=`<input type="checkbox" aria-label="เลือกเคส ${escape(row.case.code)}" ${selected.has(row.id)?'checked':''}>ผ่านเกณฑ์เบื้องต้น · รอยืนยัน`;
          label.title='คู่ BO/PM ยอดและตัวตนตรง · ไม่พบคู่ซ้ำในผลรอบนี้ · Audit ยืนยันปิดได้แม้เวลาต่างหรือข้ามวัน';
          label.querySelector('input').onchange=e=>{e.target.checked?selected.add(row.id):selected.delete(row.id);draw();};
          tr.firstElementChild.prepend(label);
        });
      }
      const chooser=document.createElement('details');chooser.className='audit-column-picker';
      chooser.innerHTML=`<summary>เลือกคอลัมน์ <span data-column-count></span></summary><div class="audit-column-options"><p>ซ่อนเฉพาะหน้าจอ • Export ยังคงข้อมูลครบทุกช่อง<br>ผลตรวจระบบและสถานะ Audit แสดงเสมอ</p><div><button type="button" class="ghost-button sm" data-columns="compact">มุมมองกระชับ</button> <button type="button" class="ghost-button sm" data-columns="all">แสดงทุกช่อง</button></div>${[...sheetHeaders,'เอกสารอ้างอิง'].map((name,i)=>`<label><input type="checkbox" data-column="${i}" ${hidden.includes(i)?'':'checked'} ${i<2?'disabled':''}>${escape(name)}</label>`).join('')}</div>`;
      toolbar.append(chooser);
      const applyColumns=()=>{
        const invisible=new Set(hidden);
        table.querySelectorAll('thead tr:last-child th').forEach((th,i)=>th.hidden=invisible.has(i));
        table.querySelectorAll('tbody tr').forEach(tr=>{
          if(tr.children.length===1){tr.firstElementChild.colSpan=27-hidden.length;return;}
          [...tr.children].forEach((td,i)=>td.hidden=invisible.has(i));
        });
        [[0,5],[5,14],[14,23],[23,27]].forEach(([start,end],g)=>{
          const count=Array.from({length:end-start},(_,i)=>i+start).filter(i=>!invisible.has(i)).length;
          const th=table.querySelector('thead tr').children[g];th.hidden=count===0;th.colSpan=Math.max(1,count);
        });
        chooser.querySelector('[data-column-count]').textContent=`(${27-hidden.length}/27)`;
        chooser.querySelectorAll('[data-column]').forEach(el=>el.checked=!invisible.has(Number(el.dataset.column)));
      };
      const saveColumns=()=>{hidden=normalizeHidden(hidden);try{localStorage.setItem(columnKey,JSON.stringify(hidden));}catch(_){}applyColumns();};
      chooser.querySelectorAll('[data-column]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.column);hidden=el.checked?hidden.filter(n=>n!==i):[...hidden,i];saveColumns();});
      chooser.querySelectorAll('[data-columns]').forEach(el=>el.onclick=()=>{hidden=el.dataset.columns==='compact'?[...compactHidden]:[];saveColumns();});
      applyColumns();
      rows.slice(page*50,page*50+50).forEach((row,index)=>{
        if(!row.pair)return;
        const td=table.querySelectorAll('tbody tr')[index]?.children[1];if(!td)return;
        if(row.confirmation){
          td.innerHTML=`<b>Audit ยืนยันแล้ว</b><small>${escape(row.confirmation.confirmed_at)}<br>ผู้ตรวจ: ${escape(row.confirmation.confirmed_by)}<br>${escape(row.confirmation.note)}</small>`;return;
        }
        const b=document.createElement('button');b.className='ghost-button sm';b.textContent='Audit ยืนยันถูกต้อง';
        b.disabled=!onConfirm||!!data.confirmationError||!data.complete||data.run.jobStatus!=='completed'||!!row.pair.manualReview;
        b.onclick=async()=>{
          const note=window.prompt('ยืนยันว่าตรวจยอด บัญชี และหลักฐานคู่นี้แล้ว ระบุหมายเหตุ (ไม่ปิดเคสเตือนที่เกี่ยวข้อง)');
          if(!note?.trim())return;
          b.disabled=true;
          try{await onConfirm(data.run.id,[row.pairIndex],note.trim());await refresh();}
          catch(error){window.alert('ยืนยันไม่สำเร็จ: '+error.message);b.disabled=false;}
        };td.append(document.createElement('br'),b);
      });
      table.querySelectorAll('thead tr:last-child th').forEach((th,i)=>{
        th.innerHTML=`<button type="button" class="sheet-filter-button ${columnRules[i]?'active':''}" aria-label="กรอง ${escape(allHeaders[i])}">${escape(allHeaders[i])} ${Number(columnSort.column)===i?(columnSort.direction==='asc'?'↑':'↓'):''} ${columnRules[i]?'●':'▾'}</button>`;
        th.querySelector('button').onclick=()=>{
          const dialog=document.createElement('dialog');dialog.className='sheet-filter-dialog';
          const rule=columnRules[i]||{op:'contains',value:''};
          dialog.innerHTML=`<form method="dialog"><h3>กรอง ${escape(allHeaders[i])}</h3><p>กรองร่วมกับช่องอื่น ทุกหน้าของบริษัทและวันที่เลือก${i===23?' • ต่างเวลาใช้หน่วยวินาที':''}</p><label>เงื่อนไข<select name="op"><option value="contains">มีข้อความ</option><option value="equals">ตรงกับ</option><option value="gte">มากกว่าหรือเท่ากับ / ตั้งแต่</option><option value="lte">น้อยกว่าหรือเท่ากับ / ถึง</option><option value="blank">ช่องว่าง</option><option value="filled">ไม่ใช่ช่องว่าง</option></select></label><label>ค่า<input name="value" value="${escape(rule.value||'')}" placeholder="พิมพ์ข้อความ ยอด หรือ YYYY-MM-DD HH:mm"></label><div class="sheet-filter-actions"><button value="apply">ใช้ตัวกรอง</button><button value="clear">ล้างช่องนี้</button><button value="asc">เรียงน้อย→มาก / เก่า→ใหม่</button><button value="desc">เรียงมาก→น้อย / ใหม่→เก่า</button><button value="cancel">ยกเลิก</button></div></form>`;
          root.append(dialog);
          const op=dialog.querySelector('[name=op]'),input=dialog.querySelector('[name=value]');op.value=rule.op;
          op.onchange=()=>{input.disabled=['blank','filled'].includes(op.value);};op.onchange();
          dialog.addEventListener('close',()=>{
            const action=dialog.returnValue;
            if(action==='apply'){
              if(input.value.trim()||['blank','filled'].includes(op.value))columnRules[i]={op:op.value,value:input.value};else delete columnRules[i];
            }else if(action==='clear')delete columnRules[i];
            else if(action==='asc'||action==='desc')columnSort={column:i,direction:action};
            dialog.remove();if(action&&action!=='cancel'){page=0;draw();}
          },{once:true});
          dialog.showModal();
        };
      });
      const active=document.createElement('div');active.className='sheet-active-filters';
      active.innerHTML=`<span>เรียง: ${escape(allHeaders[columnSort.column])} ${columnSort.direction==='asc'?'↑':'↓'}${columnSort.column===5?' (ไม่มี BO ใช้เวลา STM/PM · ไม่มีเวลาอยู่ท้าย)':''}</span>${Object.entries(columnRules).map(([i,f])=>`<button type="button" data-clear-column="${i}">${escape(allHeaders[i])}: ${escape(({contains:'มี',equals:'=',gte:'≥',lte:'≤',blank:'ว่าง',filled:'ไม่ว่าง'})[f.op])} ${escape(f.value||'')} ×</button>`).join('')}<button type="button" data-clear-all>ล้างตัวกรองทุกช่อง</button>`;
      toolbar.after(active);
      active.querySelectorAll('[data-clear-column]').forEach(b=>b.onclick=()=>{delete columnRules[b.dataset.clearColumn];page=0;draw();});
      active.querySelector('[data-clear-all]').onclick=()=>{columnRules={};page=0;draw();};
      const act=(row,action)=>{if(onBatchStatus&&['close','clarify'].includes(action)){pendingActions.set(row.id,action);draw();}else onCase(row,{action,onComplete:refreshInPlace});};
      root.querySelectorAll('[data-audit-action]').forEach(el=>el.onchange=()=>{const action=el.value;el.value='';if(action)act(data.cases.find(e=>e.id===el.dataset.auditAction),action);});
      root.querySelectorAll('[data-audit-action]').forEach(el=>{
        const row=data.cases.find(e=>e.id===el.dataset.auditAction);
        if(onBatchStatus){
          const label=document.createElement('label'), check=document.createElement('input');check.type='checkbox';check.checked=statusSelected.has(row.id);check.disabled=!['open','answered'].includes(row.status);check.setAttribute('aria-label','เลือกเปลี่ยนสถานะ '+row.code);
          check.onchange=()=>{if(check.checked)statusSelected.add(row.id);else statusSelected.delete(row.id);draw();};label.append(check,document.createTextNode(' เลือก'));el.before(label);
          if(pendingActions.has(row.id)){const hint=document.createElement('small');hint.textContent='เตรียม'+(pendingActions.get(row.id)==='close'?'ปิดเคส':'ส่งชี้แจง')+' · ยังไม่บันทึก';el.after(hint);}
        }
        const clarify=el.querySelector('option[value="clarify"]');
        clarify.textContent='ส่งขอชี้แจง…';
        clarify.disabled=!['open','answered'].includes(row.status);
        el.querySelector('option[value="close"]').disabled=row.status!=='open';
        const actions=document.createElement('div');actions.className='case-actions';
        for(const [action,label] of [['close','ยืนยันปิดเคส'],['clarify','ส่งขอชี้แจง']]){
          const button=document.createElement('button');button.type='button';button.className='ghost-button xs';button.textContent=label;
          button.disabled=el.querySelector(`option[value="${action}"]`).disabled;
          button.onclick=event=>{event.stopPropagation();act(row,action);};
          actions.append(button);
        }
        el.after(actions);
      });
      root.querySelector('#overviewCompany').onclick=onCompany;
      root.querySelector('#overviewDate').min=minDate;
      root.querySelector('#overviewDate').onchange=e=>{if(pendingActions.size){e.target.value=date;window.alert('มีสถานะที่ยังไม่บันทึก กรุณาบันทึกหรือล้างก่อนเปลี่ยนวัน');return;}date=scopedDate(e.target.value); e.target.value=date;try{sessionStorage.setItem(dateKey,date);}catch(_){}onDateChange?.(date);pendingActions=new Map();statusSelected=new Set();page=0;if(date) refresh();};
      root.querySelector('#overviewRefresh').onclick=()=>{if(pendingActions.size){window.alert('มีสถานะที่ยังไม่บันทึก กรุณาบันทึกหรือล้างก่อนรีเฟรช');return;}refreshInPlace();};
      root.querySelector('#overviewRetry')?.addEventListener('click',refresh);
      root.querySelectorAll('[data-overview-status]').forEach(b=>b.onclick=()=>{values.status=b.dataset.overviewStatus;page=0;draw();});
      for(const [id,key] of [['overviewDirection','direction'],['overviewAccount','account']]) root.querySelector('#'+id).onchange=e=>{values[key]=e.target.value;page=0;draw();};
      root.querySelector('#overviewQuery').onchange=e=>{values.query=e.target.value;page=0;draw();};
      root.querySelector('#overviewPrev').onclick=()=>{page--;draw();};
      root.querySelector('#overviewNext').onclick=()=>{page++;draw();};
      root.querySelectorAll('[data-overview-case]').forEach(b=>b.onclick=()=>onCase(data.cases.find(e=>e.id===b.dataset.overviewCase)));
    }
    async function refreshInPlace(){
      const g=++generation, x=window.scrollX, y=window.scrollY;
      try {
        const next=await load(company,date);
        if(g!==generation||!isActive()||instances.get(root)!==instance)return;
        if(next.run?.id&&loadRecommendations){try{next.recommendationLinks=await loadRecommendations({runId:next.run.id});}catch(e){next.recommendationError=e.message;}}
        if(g!==generation||!isActive()||instances.get(root)!==instance)return;
        data=next;view=model(data);selected.clear();draw();window.scrollTo(x,y);
      } catch(e){if(g===generation&&isActive())draw('บันทึกแล้ว แต่โหลดผลล่าสุดไม่ได้ กรุณารีเฟรช: '+e.message);}
    }
    async function refresh(){const g=++generation;selected.clear();data=null;view=null;draw();try{const next=await load(company,date);if(g!==generation)return;if(next.run?.id&&loadRecommendations){try{next.recommendationLinks=await loadRecommendations({runId:next.run.id});}catch(e){next.recommendationError=e.message;}if(g!==generation)return;}data=next;view=model(data);draw();}catch(e){if(g===generation)draw(e.message);}}
    await refresh();
    return ()=>{generation++;};
  }
  return {model,filter,caseState,mount,sheetRow,sheetHeaders,auditLabel,normalizeHidden,filterColumns,columnValue,splitRows,splitHtml,splitHeaders};
})();
if (typeof module !== 'undefined') module.exports = ReviewOverview;
