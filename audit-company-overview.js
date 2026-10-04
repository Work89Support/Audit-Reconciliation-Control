/* Read-only report model: membership comes from the active company catalogue. */
const AuditCompanyOverview = (() => {
  const codeOf = company => String(typeof company === 'string' ? company : company.code || '').toUpperCase();
  const totalOf = rows => rows.reduce((total, row) => {
    for (const key of ['rows','stm','bo','matched','cases','remaining','completed','review']) total[key] += row[key];
    return total;
  }, {rows:0,stm:0,bo:0,matched:0,cases:0,remaining:0,completed:0,review:0});
  function build({groups, companies, quality, available}) {
    const catalogue = [...new Set(companies.map(codeOf).filter(Boolean))];
    const membership = new Map(groups.flatMap(group => group.companies.map(code => [codeOf(code),group.id])));
    const result = groups.map(group => ({id:group.id,name:group.name,companies:[]}));
    for (const company of catalogue) {
      let group = result.find(item => item.id === membership.get(company));
      if (!group) {
        group = result.find(item => item.id === 'OTHER');
        if (!group) {group={id:'OTHER',name:'ยังไม่ระบุเครือ',companies:[]};result.push(group);}
      }
      const rows = available ? quality.filter(row => codeOf(row.company) === company) : [];
      const sum = key => rows.reduce((value,row) => value + Number(row[key] || 0),0);
      const item = {company,rows:rows.length,stm:sum('stm_count'),bo:sum('bo_count'),matched:sum('matched'),cases:sum('exception_count'),completed:rows.filter(row=>row.status==='completed').length,review:rows.filter(row=>row.status!=='completed').length,latestDate:rows.reduce((date,row)=>row.business_date>date?row.business_date:date,'')};
      item.remaining = Math.max(0,item.stm-item.matched);
      item.rate = item.stm>0 ? item.matched/item.stm*100 : null;
      group.companies.push(item);
    }
    const active = result.filter(group=>group.companies.length);
    active.forEach(group=>{group.total=totalOf(group.companies);group.rate=group.total.stm>0?group.total.matched/group.total.stm*100:null;});
    return {groups:active,companyCount:catalogue.length,withResults:active.flatMap(group=>group.companies).filter(row=>row.rows>0).length,total:totalOf(active.flatMap(group=>group.companies)),available};
  }
  function markup(model,{h,num}) {
    const metric=(row,key)=>model.available&&row.rows>0?num(row[key]):'—';
    const rate=row=>model.available&&row.rows>0&&row.rate!=null?row.rate.toFixed(2)+'%':'—';
    const badge=row=>!model.available?'<span class="badge amber">โหลดไม่สำเร็จ</span>':!row.rows?'<span class="badge amber">ยังไม่มีผลรัน</span>':`<span class="badge ${row.review?'amber':'green'}">${row.review?'ต้องติดตาม '+num(row.review)+' รอบ':'รันสำเร็จ '+num(row.completed)+' รอบ'}</span>`;
    const cells=row=>`<td class="right tnum">${metric(row,'stm')}</td><td class="right tnum">${metric(row,'bo')}</td><td class="right tnum ok-text">${metric(row,'matched')}</td><td class="right tnum">${metric(row,'remaining')}</td><td class="right tnum">${metric(row,'cases')}</td><td class="right tnum">${rate(row)}</td>`;
    return `<section class="panel audit-all-overview"><div class="panel-heading"><div><p class="eyebrow">ภาพรวมทุกบริษัท</p><h2>${num(model.groups.length)} เครือ · ${num(model.companyCount)} บริษัท</h2><small class="head-sub">ตามบริษัทที่มีสิทธิ์และช่วงวันที่ที่เลือก · ตัวเลขเป็นจำนวนรายการ</small></div><span class="badge ${model.available&&model.withResults===model.companyCount?'green':'amber'}">${model.available?'มีผลรัน '+num(model.withResults)+' / '+num(model.companyCount)+' บริษัท':'รอข้อมูลจริง'}</span></div>
      <div class="audit-network-grid">${model.groups.map(group=>`<article class="audit-network"><header><div><h3>${h(group.name)}</h3><small>${num(group.companies.length)} บริษัท</small></div><div class="audit-network-rate"><strong>${rate({...group.total,rate:group.rate})}</strong><small>จับคู่จาก STM/PM</small></div></header><div class="audit-network-meter" aria-hidden="true"><i style="width:${group.rate==null?0:Math.max(0,Math.min(100,group.rate))}%"></i></div><dl class="audit-network-metrics"><div><dt>STM/PM</dt><dd>${metric(group.total,'stm')}</dd></div><div><dt>BO</dt><dd>${metric(group.total,'bo')}</dd></div><div><dt>จับคู่แล้ว</dt><dd>${metric(group.total,'matched')}</dd></div><div><dt>เคสจากผลรัน</dt><dd>${metric(group.total,'cases')}</dd></div></dl><div class="audit-network-companies">${group.companies.map(row=>`<button type="button" data-recon-company="${h(row.company)}" data-recon-date="${h(row.latestDate)}" ${row.rows?'':'disabled'}><b>${h(row.company)}</b><span>${rate(row)}</span>${badge(row)}</button>`).join('')}</div></article>`).join('')}</div>
      <details class="audit-all-table" open><summary>รายละเอียดทุกบริษัท · ${num(model.companyCount)} บริษัท</summary><div class="table-wrap"><table><thead><tr><th>เครือ / บริษัท</th><th class="right">STM/PM</th><th class="right">BO</th><th class="right">จับคู่แล้ว</th><th class="right">STM/PM ยังไม่จับคู่</th><th class="right">เคสจากผลรัน</th><th class="right">อัตราจับคู่</th><th>สถานะการรัน</th></tr></thead><tbody>${model.groups.map(group=>`<tr class="audit-network-divider"><th colspan="8">${h(group.name)} · ${num(group.companies.length)} บริษัท</th></tr>${group.companies.map(row=>`<tr ${row.rows?`class="action-row" data-recon-company="${h(row.company)}" data-recon-date="${h(row.latestDate)}" role="link" tabindex="0"`:''}><td><b>${h(row.company)}</b></td>${cells(row)}<td>${badge(row)}</td></tr>`).join('')}`).join('')}</tbody><tfoot><tr><th>รวมทุกเครือ</th>${cells({...model.total,rate:model.total.stm>0?model.total.matched/model.total.stm*100:null})}<th>${model.available?num(model.total.completed)+' รอบสำเร็จ':'—'}</th></tr></tfoot></table></div></details><p class="hint">“รันสำเร็จ” ไม่ได้หมายถึงปิดเคสครบหรือมีไฟล์ครบทุกบัญชี · อัตราจับคู่ใช้ STM/PM เป็นฐาน ไม่ใช่อัตราความครบของ BO · เคสจากผลรันไม่ใช่จำนวนเคสเปิดปัจจุบัน · ไม่มีผลรันจะแสดง — ไม่ใช่ศูนย์</p></section>`;
  }
  return {build,markup};
})();
