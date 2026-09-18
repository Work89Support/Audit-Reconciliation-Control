(function (root) {
  'use strict';
  let selected = -1;
  let provider = 'all', direction = 'all', balance = 'all';
  let loaded = null, filename = '', error = '', busy = false;
  const providers = {AT:'ATP / Autopeer', AZ:'AZPAY', CP:'COREPAY', M:'MYPAY'};
  function combinedSheet(sheets) {
    const pm = [], bo = [];
    sheets.forEach(sheet => {
      const split = sheet.headers.indexOf('รหัส');
      sheet.headers.forEach((header, index) => {
        const target = index < split ? pm : bo;
        if (header && !target.includes(header)) target.push(header);
      });
    });
    return {name:'รวมทั้งหมด', headers:['บริษัท','PM','ฝาก / ถอน','ชีตต้นทาง',...pm,null,...bo]};
  }
  function sourceSheets(sheets, pm, type, result='all') {
    return sheets.filter(s => (pm==='all'||s.name.split(' ')[0]===pm) && (type==='all'||s.name.endsWith(type)) && (result==='all' || (!s.missing && !s.errors?.length && Number.isFinite(s.pmTotal) && Number.isFinite(s.boTotal) && (result==='different' ? s.pmTotal!==s.boTotal : s.pmTotal===s.boTotal))));
  }
  function amountHeader(sheet) {
    if (sheet.name.endsWith('ฝ')) return 'realAmount';
    return /^(AT|M) ถ$/.test(sheet.name) ? 'transferredAmount' : 'amount';
  }
  const money = cents => (cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  function totalsPanel(sheet, isAll, type, scope) {
    const types = isAll ? (type==='all'?['ฝาก','ถอน']:[type==='ฝ'?'ฝาก':'ถอน']) : [sheet.name.endsWith('ฝ')?'ฝาก':'ถอน'];
    return `<section class="mc8-totals" aria-label="ยอดรวม STM และ BO"><h3>ยอดรวมท้ายชีต</h3><table><thead><tr><th scope="col">ประเภท</th><th scope="col">รวม STM / PM (บาท)</th><th scope="col">รวม BO (บาท)</th><th scope="col">ผลต่าง STM − BO (บาท)</th><th scope="col">ผลเทียบยอดรวม</th></tr></thead><tbody>${types.map(label=>{
      const subset=scope.filter(s=>s.name.endsWith(label==='ฝาก'?'ฝ':'ถ'));
      if(loaded && !subset.length) return '';
      if(!loaded) return `<tr><th scope="row">${label}</th><td>—</td><td>—</td><td>—</td><td>รอข้อมูลทั้งสองฝั่ง</td></tr>`;
      if(!subset.length || subset.some(s=>s.missing || s.errors.length)) return `<tr><th scope="row">${label}</th><td>—</td><td>—</td><td>—</td><td>ข้อมูลไม่ครบ / ต้องตรวจไฟล์</td></tr>`;
      const pm=subset.reduce((sum,s)=>sum+s.pmTotal,0), bo=subset.reduce((sum,s)=>sum+s.boTotal,0);
      return `<tr><th scope="row">${label}</th><td>${money(pm)}</td><td>${money(bo)}</td><td>${pm!==bo?`<button type="button" class="mc8-diff-link" data-diff-type="${label==='ฝาก'?'ฝ':'ถ'}" aria-label="ดูชีต${label}ที่ยอดรวมต่าง ${money(pm-bo)} บาท">${money(pm-bo)} · ดูผลต่าง</button>`:money(pm-bo)}</td><td>${pm===bo?'ยอดรวมตรง':'ยอดรวมต่าง'}</td></tr>`;
    }).join('')}</tbody></table><p>${isAll?'รวมเฉพาะขอบเขตตัวกรอง และแยกฝาก/ถอน ไม่หักกลบกัน':`STM / PM ใช้ ${escape(amountHeader(sheet))} · BO ใช้ จำนวน`} · ยอดรวมตรงกันไม่ได้ยืนยันว่าจับคู่รายรายการครบ</p></section>`;
  }
  function summary(scope) {
    if(!loaded) return '';
    return `<section class="mc8-summary"><h3>สรุปยอดทุกธุรกรรมในไฟล์</h3><div class="mc8-summary-scroll"><table><thead><tr><th>ชีต</th><th>PM / BO (รายการ)</th><th>STM / PM</th><th>BO ทั้งหมด</th><th>STM − BO</th><th>ผลต่างในช่วงยอดรวมออดิท</th></tr></thead><tbody>${scope.map(s=>{
      const invalid=s.missing||s.errors.length;
      return `<tr class="${!invalid&&s.pmTotal!==s.boTotal?'mc8-warning':''}"><th><button type="button" data-open-sheet="${root.MC8SheetSchema.sheets.findIndex(t=>t.name===s.name)}">${escape(s.name)}</button></th><td>${s.pm.filter(p=>p.accepted).length} / ${s.bo.length}</td><td>${invalid?'—':money(s.pmTotal)}</td><td>${invalid?'—':money(s.boTotal)}</td><td>${invalid?'ตรวจไฟล์':money(s.pmTotal-s.boTotal)}</td><td>${invalid?'—':s.totalRow?money(s.manualPm-s.manualBo):'ไม่มีสูตรรวม'}</td></tr>`;
    }).join('')}</tbody></table></div><p>คำนวณใหม่จากรายการ ไม่ใช้ยอดรวมสำเร็จรูปใน Excel และไม่รวมแถวสูตรซ้ำ</p></section>`;
  }
  function issues(scope) {
    if(!loaded) return '';
    const warnings=scope.flatMap(s=>s.errors.map(e=>`<li>${escape(s.name)}: ${escape(e)}</li>`));
    const cards=scope.flatMap(s=>s.issues.map(i=>`<article class="mc8-issue"><h4>${escape(s.name)} · BO ${escape(i.id)} · ${i.value===null?'ยอดอ่านไม่ได้':money(i.value)+' บาท'}</h4><p>${i.flags.map(escape).join(' · ')} · แถวต้นฉบับ ${i.row}</p><p>ยูสเซอร์ ${escape(i.user)}</p><p class="mc8-issue-note">${escape(i.note || 'ต้องตรวจคู่รายการและหลักฐานข้ามวันเพิ่มเติม')}</p><small>เป็นหมายเหตุจากไฟล์ ไม่ใช่การยืนยันคู่หรือยอดเสียหาย</small></article>`));
    return `<section class="mc8-issues"><h3>รายการแยกติดตามจากไฟล์ (${cards.length})</h3>${warnings.length?`<div role="alert"><strong>ยังสรุปยอดไม่ได้ครบ</strong><ul>${warnings.join('')}</ul></div>`:''}${cards.join('')||'<p>ไม่พบหมายเหตุชี้แจงหรือรายการแยกใต้ยอดรวมในขอบเขตนี้</p>'}</section>`;
  }
  function displayRows(scope, sheet, isAll) {
    if(!loaded) return [2,3,4,5,6].map(row=>({row,values:[],flags:[]}));
    if(!isAll) return sheet.rows;
    const split=sheet.headers.indexOf('รหัส');
    return scope.flatMap(s=>s.rows.map(r=>{
      const sourceSplit=s.headers.indexOf('รหัส');
      const values=sheet.headers.map((h,i)=>{
        if(i<4) return ['MC8',providers[s.name.split(' ')[0]],s.name.endsWith('ฝ')?'ฝาก':'ถอน',`${s.name} · แถว ${r.row}`][i];
        if(!h) return '';
        const index=s.headers.findIndex((v,j)=>v===h && (i<split?j<sourceSplit:j>=sourceSplit));
        return index<0?'':r.values[index];
      });
      return {...r,values};
    }));
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function letter(index) {
    let label = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
    return label;
  }
  function render(container) {
    const schema = root.MC8SheetSchema;
    const sheets = loaded || schema.sheets;
    const isAll = selected === -1;
    const sheet = isAll ? combinedSheet(sheets) : sheets[selected];
    const included = sourceSheets(sheets, provider, direction, loaded?balance:'all');
    const invalidCount = loaded ? sourceSheets(sheets,provider,direction).filter(s=>s.missing||s.errors.length).length : 0;
    const scope=isAll?included:[sheet];
    const boStart = sheet.headers.indexOf('รหัส');
    const pmEnd = sheet.headers.slice(0, boStart).findLastIndex(v => !!v);
    const side = index => index <= pmEnd ? 'pm' : index >= boStart ? 'bo' : 'gap';
    container.innerHTML = `<section class="mc8-workbook">
      <header class="mc8-intro"><div><h2>MC8 · ชีตตรวจ PM / BO</h2><p>${loaded?'ไฟล์ที่เปิด':'ต้นแบบ'}: ${escape(filename || schema.source)} · ${schema.sheets.length} ชีต</p></div><span class="mc8-pending">${loaded?'ตรวจยอดจากไฟล์จริง':'รอเลือกไฟล์'}</span></header>
      <div class="mc8-import"><label>เลือกไฟล์กระทบมือ MC8 (.xlsx)<input id="mc8-file" type="file" accept=".xlsx" ${busy?'disabled':''}></label>${loaded?'<button type="button" id="mc8-clear">ล้างไฟล์จากหน้าจอ</button>':''}<span role="status">${busy?'กำลังอ่านไฟล์…':'อ่านในเบราว์เซอร์เท่านั้น ไม่อัปโหลดและไม่บันทึกลงฐานข้อมูล'}</span></div>
      ${error?`<p role="alert" class="mc8-warning">${escape(error)}</p>`:''}
      <p class="mc8-note">${loaded?'แสดงข้อมูลต้นฉบับและคำนวณยอดใหม่แล้ว':'ยังไม่ได้โหลดธุรกรรม'} · ไม่เปลี่ยนผลกระทบยอดหรือสถานะเคส · PM และ BO ที่อยู่แถวเดียวกันในไฟล์ ไม่ได้หมายความว่าเป็นคู่กัน</p>
      <div class="mc8-tabs" role="tablist" aria-label="ชีต MC8"><button type="button" role="tab" id="mc8-tab--1" aria-controls="mc8-sheet-panel" aria-selected="${isAll}" tabindex="${isAll?0:-1}" data-sheet="-1">รวมทั้งหมด<small>ทุก PM · ฝาก / ถอน</small></button>${schema.sheets.map((s,i)=>`<button type="button" role="tab" id="mc8-tab-${i}" aria-controls="mc8-sheet-panel" aria-selected="${selected===i}" tabindex="${selected===i?0:-1}" data-sheet="${i}">${escape(s.name)}<small>${s.name.endsWith('ถ')?'ถอน':'ฝาก'}</small></button>`).join('')}</div>
      <section id="mc8-sheet-panel" role="tabpanel" aria-labelledby="mc8-tab-${selected}">
        ${isAll ? `<div class="mc8-filters"><label>PM<select id="mc8-provider"><option value="all">ทุก PM</option>${Object.entries(providers).map(([value,label])=>`<option value="${value}" ${provider===value?'selected':''}>${label}</option>`).join('')}</select></label><label>ประเภท<select id="mc8-direction"><option value="all">ฝากและถอนทั้งหมด</option><option value="ฝ" ${direction==='ฝ'?'selected':''}>ฝาก</option><option value="ถ" ${direction==='ถ'?'selected':''}>ถอน</option></select></label><button type="button" id="mc8-reset">ล้างตัวกรอง</button></div><p role="status" class="mc8-source-scope">ขอบเขต ${included.length} ชีต: ${included.map(s=>escape(s.name)).join(', ')}</p>` : ''}
        ${isAll?`<div class="mc8-filters"><label>ผลเทียบยอดรวม<select id="mc8-balance" ${!loaded?'disabled':''}><option value="all" ${balance==='all'?'selected':''}>ทุกชีต</option><option value="different" ${balance==='different'?'selected':''}>เฉพาะชีตที่ยอดรวมต่าง</option><option value="equal" ${balance==='equal'?'selected':''}>เฉพาะชีตที่ยอดรวมตรง</option></select></label></div>${loaded&&balance!=='all'?'<p class="mc8-note">กรองระดับชีต: ตารางด้านล่างแสดงทุกรายการในชีตที่เลือก ไม่ใช่รายการที่จับคู่ไม่สำเร็จรายบรรทัด</p>':''}${invalidCount&&balance!=='all'?`<p role="alert">มี ${invalidCount} ชีตที่ข้อมูลไม่ครบ จึงยังจัดเป็นยอดตรงหรือต่างไม่ได้ กรุณาเลือก “ทุกชีต” เพื่อตรวจ</p>`:''}${loaded&&!included.length?'<p role="status" class="mc8-note">ไม่พบชีตตามตัวกรองนี้</p>':''}`:''}
        ${summary(scope)}${issues(scope)}
        <div class="mc8-toolbar"><strong>${escape(sheet.name)}</strong><span>PM: A–${letter(pmEnd)} · BO: ${letter(boStart)}–${letter(sheet.headers.length-1)}</span><div><button type="button" data-side="pm">ดูฝั่ง PM</button><button type="button" data-side="bo">ดูฝั่ง BO</button></div></div>
        <div class="mc8-scroll" tabindex="0" role="region" aria-label="ตาราง ${escape(sheet.name)} เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"><table class="mc8-grid"><caption>${escape(sheet.name)} ${isAll?'รวมจากชีตตามตัวกรอง (ตำแหน่งคอลัมน์ใหม่เฉพาะหน้ารวม)':'ตามต้นฉบับ'} · PM / BO แสดงแยกฝั่ง ยังไม่ยืนยันคู่</caption><thead>
          <tr><th class="mc8-rownum">ฝั่ง</th><th class="pm" colspan="${pmEnd+1}">STM / PM</th>${boStart-pmEnd-1?`<th class="gap" colspan="${boStart-pmEnd-1}"></th>`:''}<th class="bo" colspan="${sheet.headers.length-boStart}">BO</th></tr>
          <tr><th class="mc8-rownum">คอลัมน์</th>${sheet.headers.map((v,i)=>`<th class="${side(i)}">${letter(i)}</th>`).join('')}</tr>
          <tr><th class="mc8-rownum">1</th>${sheet.headers.map((v,i)=>`<th scope="col" data-column="${i}" class="${side(i)}">${escape(v)}</th>`).join('')}</tr>
        </thead><tbody>${displayRows(scope,sheet,isAll).map(r=>`<tr class="${r.flags.length?'mc8-warning':''}"><th scope="row" class="mc8-rownum" title="${escape(r.flags.join(' · '))}">${r.row}${r.flags.length?' *':''}</th>${sheet.headers.map((v,i)=>`<td class="${side(i)==='gap'?'gap':''}" title="${escape(r.values[i])}">${escape(r.values[i])}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><th scope="row" class="mc8-rownum">รวม</th>${sheet.headers.map((v,i)=>`<td class="${side(i)}">${!isAll && ((i<boStart && v===amountHeader(sheet)) || (i>=boStart && v==='จำนวน'))?(loaded?(sheet.missing||sheet.errors.length?'— ตรวจไฟล์':money(i<boStart?sheet.pmTotal:sheet.boTotal)):'— รอข้อมูล'):''}</td>`).join('')}</tr></tfoot></table></div>
        ${totalsPanel(sheet,isAll,direction,scope)}
        <p class="mc8-empty">${loaded?'* พื้นเหลือง = มีหมายเหตุหรือรายการที่ต้องตรวจเพิ่มเติม ไม่ใช่ยอดเสียหาย':'เตรียมหัวตารางแล้ว · ยังไม่มีข้อมูลธุรกรรมในหน้านี้'}</p>
      </section>
      <details class="mc8-requirements"><summary>กติกาที่ใช้คำนวณยอดในหน้านี้</summary><ul><li>ฝาก: SUCCESS / SUCCESSED ใช้ realAmount</li><li>ถอน: SUCCESS / SUCCESSED / PARTIAL ใช้ transferredAmount สำหรับ AT / M และ amount สำหรับ AZ / CP</li><li>BO ใช้ จำนวน รวมรายการข้ามวันและรายการชี้แจงไว้ด้วย ไม่ลบทิ้งจากยอด</li><li>ยอดที่อ่านไม่ได้จะแสดงให้ตรวจ ไม่แทนด้วยศูนย์</li><li>หน้านี้ตรวจยอดรวม ไม่ได้สั่งจับคู่หรือปิดเคสอัตโนมัติ</li></ul></details>
    </section>`;
    const choose = index => { selected = index; render(container); container.querySelector(`#mc8-tab-${selected}`).focus({preventScroll:true}); };
    container.querySelectorAll('[data-open-sheet]').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.openSheet))));
    container.querySelector('#mc8-clear')?.addEventListener('click',()=>{loaded=null;filename='';error='';balance='all';render(container);});
    container.querySelectorAll('[data-diff-type]').forEach(b=>b.addEventListener('click',()=>{
      if(!isAll) provider=sheet.name.split(' ')[0];
      direction=b.dataset.diffType;balance='different';selected=-1;render(container);
      container.querySelector('#mc8-balance').focus();
    }));
    container.querySelector('#mc8-file').addEventListener('change',async event=>{
      const file=event.target.files?.[0]; if(!file) return;
      if(!/\.xlsx$/i.test(file.name) || file.size>25*1024*1024) {error='เลือกไฟล์ .xlsx ขนาดไม่เกิน 25 MB';render(container);return;}
      busy=true;error='';render(container);
      try {
        const wb=await root.XlsxReader.readWorkbook(await file.arrayBuffer(),{includeMetadata:true});
        const next=root.MC8SheetData.analyze(wb,schema);
        if(next.every(s=>s.missing)) throw new Error('ไม่พบชื่อชีต MC8 ที่รองรับในไฟล์นี้');
        loaded=next;filename=file.name;
      } catch(e) {error=`อ่านไฟล์ใหม่ไม่สำเร็จ${loaded?' · ยังคงแสดงไฟล์เดิม':''}: ${e.message}`;}
      finally {busy=false;render(container);}
    });
    container.querySelectorAll('[data-sheet]').forEach(button => {
      button.addEventListener('click', () => choose(Number(button.dataset.sheet)));
      button.addEventListener('keydown', event => {
        const next = event.key==='ArrowRight' ? (selected+2)%(schema.sheets.length+1)-1 : event.key==='ArrowLeft' ? (selected+schema.sheets.length+1)%(schema.sheets.length+1)-1 : event.key==='Home' ? -1 : event.key==='End' ? schema.sheets.length-1 : null;
        if(next!==null){event.preventDefault();choose(next);}
      });
    });
    if (isAll) {
      ['provider','direction','balance'].forEach(key => container.querySelector(`#mc8-${key}`).addEventListener('change', event => {
        if (key==='provider') provider=event.target.value; else if(key==='direction') direction=event.target.value; else balance=event.target.value;
        render(container); container.querySelector(`#mc8-${key}`).focus({preventScroll:true});
      }));
      container.querySelector('#mc8-reset').addEventListener('click', () => {provider='all';direction='all';balance='all';render(container);container.querySelector('#mc8-reset').focus({preventScroll:true});});
    }
    container.querySelectorAll('[data-side]').forEach(button => button.addEventListener('click', () => {
      const scroll = container.querySelector('.mc8-scroll');
      const target = container.querySelector(`[data-column="${button.dataset.side==='bo'?boStart:0}"]`);
      scroll.scrollTo({left:button.dataset.side==='bo'?target.offsetLeft-80:0,behavior:'smooth'});
    }));
  }
  root.MC8Sheets = {render, combinedSheet, sourceSheets, amountHeader};
})(window);
