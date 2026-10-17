(function(root){
 'use strict';
 const label='พักตรวจ — บัญชีถูกระงับ / รอ STM';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let scopes=[];
 function set(rows){scopes=Array.isArray(rows)?rows:[];}
 function match(e){const time=String(e.boTime||e.bo_time||e.time||e.occurred_at||'').slice(0,8),date=e.date||e.business_date,account=String(e.account||'').replace(/\D/g,'');return scopes.find(h=>h.company===e.company&&h.account===account&&(h.business_date===date||h.continuous===true&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=h.business_date)&&(h.time_from==='00:00:00'&&h.time_to==='23:59:59'||time>=h.time_from&&time<=h.time_to))||null;}
 function banner(h){return h?`<section class="panel" role="status" data-review-hold><h3>${label}</h3>${h.continuous===true?`<p><strong>พักตรวจต่อเนื่องตั้งแต่ ${esc(h.business_date)} — ไม่มีกำหนดสิ้นสุด</strong></p><p>มี STM แล้วไม่ปลดพักอัตโนมัติ ต้องหัวหน้า/Admin ตรวจหลักฐานและยืนยันยกเลิกพัก</p>`:''}<p>${esc(h.reason)}</p><p>ยังประเมินไม่ได้ — ขาด STM · ไม่ใช่ความเสียหายจริง และไม่ใช่ยอดเสียหายศูนย์</p><p>คงเคส/ยอด/ประวัติเดิม ไม่ปิดเคสจนมีหลักฐานเพียงพอและหัวหน้า/Admin ทบทวน</p><p>ผู้ติดตาม: ${esc(h.responsible_role)} · วันที่บันทึก ${esc(h.created_at?.slice(0,10))}</p></section>`:'';}
 const headers=['บริษัท','วันที่','บัญชี','ประเภททะเบียน','เลขเคส / แถวต้นทาง','เวลา','ฝาก/ถอน','ยอด BO อ้างอิง (ไม่ใช่เสียหาย)','สถานะพักตรวจ','ผลประเมินความเสียหาย','ผู้ติดตาม','UUID เคส / แถวต้นทาง'];
 const values=r=>[r.company,r.date,r.account,r.item_kind==='case'?'เคสเดิม':'BO รอ STM — ยังไม่สร้างเคส',r.code,r.occurred_at,r.direction,r.bo_amount,label,'ยังประเมินไม่ได้ — ขาด STM',r.responsible_role,r.exception_id||r.source_ref];
 function csv(rows){const cell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';return '\ufeff'+[headers,...rows.map(values)].map(r=>r.map(cell).join(',')).join('\r\n');}
 function emptyStatus(rows,scopes=[]){return !rows.length&&scopes.some(h=>h.continuous===true)?'ยังพักตรวจอยู่—ยังไม่มีเคสในช่วงวันที่นี้':null;}
 function view(rows,page=1,options={}){const size=20,pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(Math.max(1,page),pages);const shown=rows.slice((page-1)*size,page*size),cases=rows.filter(r=>r.item_kind==='case').length,waiting=rows.length-cases,empty=emptyStatus(rows,options.scopes);
 if(empty)return {page,pages,html:`<section class="panel"><h2>${label}</h2><p role="status" data-hold-empty><strong>${empty}</strong></p><p>ขอบเขตพักตรวจยังมีผล ไม่ใช่การยกเลิกพัก · ยังไม่ประเมินความเสียหาย และไม่ใช่ยอดเสียหายศูนย์</p><p>มี STM แล้วไม่ปลดพักอัตโนมัติ ต้องหัวหน้า/Admin ตรวจหลักฐานและยืนยันยกเลิกพัก</p><button class="ghost-button" data-hold-csv disabled>ยังไม่มีรายการเคสให้ส่งออก</button><button class="ghost-button" data-fin-prev disabled>ก่อนหน้า</button><button class="ghost-button" data-fin-next disabled>ถัดไป</button></section>`,lines:[label,empty,'ขอบเขตพักตรวจยังมีผล · ยังไม่ประเมินความเสียหาย · ไม่ปลดพักอัตโนมัติ']};
 return {page,pages,html:`<section class="panel"><h2>${label}</h2><p>เคสเดิม ${cases} เคส · BO รอ STM ${waiting} รายการ (ยังไม่สร้างเคส)</p><p>แยกรายงานจากความเสียหายจริง · ยังประเมินไม่ได้ ไม่ใช่ยอดเสียหายศูนย์ · ไม่รวมยอด BO เป็นความเสียหาย</p><button class="ghost-button" data-hold-csv>ส่งออกทะเบียนพักตรวจครบทุกแถว (CSV)</button><p>หน้า ${page}/${pages} · ${rows.length} รายการ</p><button class="ghost-button" data-fin-prev ${page===1?'disabled':''}>ก่อนหน้า</button><button class="ghost-button" data-fin-next ${page===pages?'disabled':''}>ถัดไป</button><div class="table-wrap"><table><thead><tr><th>บริษัท / วันที่ / บัญชี</th><th>อ้างอิง / ประเภท</th><th>เวลา / ฝากถอน</th><th>ยอด BO อ้างอิง</th><th>ผลประเมิน</th><th>ผู้ติดตาม / เหตุผล</th></tr></thead><tbody>${shown.map(r=>`<tr><td>${esc(r.company)} · ${esc(r.date)}<small class="sub">SCB จิตติพัฒน์ · ${esc(r.account)}</small></td><td>${esc(r.code)}<small class="sub">${r.item_kind==='case'?'เคสเดิม — ไม่ปิดเคส':'BO รอ STM — ยังไม่สร้างเคส'}</small></td><td>${esc(r.occurred_at)} · ${esc(r.direction)}</td><td>${r.bo_amount==null?'ไม่ทราบ':Number(r.bo_amount).toLocaleString('th-TH',{minimumFractionDigits:2})}<small class="sub">ไม่ใช่ยอดเสียหาย</small></td><td>ยังประเมินไม่ได้ — ขาด STM</td><td>${esc(r.responsible_role)}<small class="sub">${esc(r.reason)}</small></td></tr>`).join('')||'<tr><td colspan="6">ไม่มีทะเบียนพักตรวจในบริษัท/ช่วงวันที่นี้</td></tr>'}</tbody></table></div></section>`,lines:[label,`เคสเดิม ${cases} เคส · BO รอ STM ${waiting} รายการ · ยังไม่ประเมินความเสียหาย`,...shown.map(r=>`${r.company} ${r.date} ${r.code} ${r.occurred_at} · ${r.item_kind==='case'?'เคสเดิม':'ยังไม่สร้างเคส'} · รอ STM`)]};}
 async function mountReadOnly(host,ctx){
  const actor=ctx.actor(),role=ctx.role();let generation=0,companies=[],rows=[],reportScopes=[],page=1;
  const active=()=>host.isConnected&&ctx.actor()===actor&&ctx.role()===role;
  host.innerHTML='<p role="status">กำลังตรวจสิทธิ์และโหลดทะเบียนเดิม — ยังไม่สรุปว่าไม่มีรายการ</p>';
  try{
   const [allowed,scopes]=await Promise.all([ctx.companies(),ctx.scopes()]);if(!active())return;
   if(!Array.isArray(allowed)||!Array.isArray(scopes))throw Error('รูปแบบสิทธิ์หรือทะเบียนไม่ครบ');
   companies=[...new Set(allowed)];
   if(companies.some(c=>typeof c!=='string'))throw Error('รูปแบบบริษัทไม่ถูกต้อง');
   const dates=scopes.filter(s=>companies.includes(s.company)).map(s=>s.business_date).filter(Boolean).sort();
   const from=dates.length&&dates[0]<ctx.from?dates[0]:ctx.from,to=dates.length&&dates.at(-1)>ctx.to?dates.at(-1):ctx.to;
   host.innerHTML=`<p>ทะเบียนเดิมตามสิทธิ์บริษัท · รวมทะเบียนพักตรวจเดิมก่อนช่วงข้อมูลจริงหากมี · ไม่พัก/เปิดบัญชี ไม่เปลี่ยนเคส ไม่บันทึกความเสียหาย</p><label>บริษัท<select data-hold-company><option value="ALL">ทุกบริษัทตามสิทธิ์</option>${companies.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label>ตั้งแต่<input data-hold-from type="date" value="${esc(from)}"></label><label>ถึง<input data-hold-to type="date" value="${esc(to)}"></label><button class="ghost-button" data-hold-load>โหลดทะเบียน</button><p data-hold-state role="status"></p><div data-hold-body></div>`;
   const body=host.querySelector('[data-hold-body]'),status=host.querySelector('[data-hold-state]'),load=host.querySelector('[data-hold-load]');
   let shownScope=null;
   function draw(){const rendered=ctx.view(rows,page,{scopes:reportScopes});page=rendered.page;body.innerHTML=reportScopes.filter(h=>h.continuous===true).map(h=>`<p data-continuous-hold><strong>${esc(h.company)} · พักตรวจต่อเนื่องตั้งแต่ ${esc(h.business_date)} — ไม่มีกำหนดสิ้นสุด</strong><br>รอ STM และหัวหน้า/Admin ยืนยันยกเลิกพัก · ไม่ปลดพักอัตโนมัติ · ไม่ใช่ความเสียหายจริง</p>`).join('')+rendered.html;
    body.querySelector('[data-fin-prev]').onclick=()=>{page--;draw();};body.querySelector('[data-fin-next]').onclick=()=>{page++;draw();};
    body.querySelector('[data-hold-csv]').onclick=()=>{if(active()&&shownScope)ctx.saveBlob(new Blob([ctx.csv(rows)],{type:'text/csv;charset=utf-8'}),'account-review-holds-'+shownScope.from+'-'+shownScope.to+'.csv');};
   }
   async function read(){const token=++generation;const company=host.querySelector('[data-hold-company]').value,from=host.querySelector('[data-hold-from]').value,to=host.querySelector('[data-hold-to]').value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to){status.textContent='เลือกช่วงวันที่ให้ถูกต้อง — ยังไม่โหลดทะเบียน';return;}
    load.disabled=true;status.textContent='กำลังโหลดทะเบียน — ยังไม่สรุปว่าไม่มีรายการ';body.innerHTML='';shownScope=null;
    try{
     const selected=company==='ALL'?companies:companies.filter(c=>c===company);
     const reports=await Promise.all(selected.map(c=>ctx.report(c,from,to)));if(!active()||token!==generation)return;
     const items=[];reports.forEach((r,i)=>{if(!r||r.company!==selected[i]||!Array.isArray(r.items))throw Error('อ่านทะเบียนไม่ครบหรือบริษัทไม่ตรง');for(const row of r.items){if(row.company!==selected[i]||row.date<from||row.date>to)throw Error('ขอบเขตทะเบียนไม่ตรงสิทธิ์/วันที่');items.push(row);}});
     reportScopes=reports.flatMap(r=>(r.scopes||[]).filter(h=>selected.includes(h.company)));rows=items;page=1;shownScope={from,to};draw();status.textContent=emptyStatus(rows,reportScopes)?`${emptyStatus(rows,reportScopes)} · อ่านอย่างเดียว`:`ทะเบียน ${rows.length} รายการ · อ่านอย่างเดียว · ไม่ใช่จำนวนเคสค้างหรือยอดเสียหาย`;
    }catch(error){if(active()&&token===generation){body.innerHTML='';status.textContent='ยังอ่านทะเบียนไม่สำเร็จ ไม่ถือว่าไม่มีรายการ: '+error.message;}}
    finally{if(active()&&token===generation)load.disabled=false;}
   }
   load.onclick=read;await read();
  }catch(error){if(active())host.innerHTML=`<p role="alert">ยังเปิดทะเบียนไม่ได้: ${esc(error.message)} · ปิดแล้วเปิดใหม่เพื่อตรวจสิทธิ์ ไม่เปลี่ยนทะเบียนเดิม</p>`;}
 }
 root.AccountReviewHolds={label,set,match,banner,csv,view,headers,values,mountReadOnly};if(typeof module!=='undefined')module.exports=root.AccountReviewHolds;
})(typeof window==='undefined'?globalThis:window);
