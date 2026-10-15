(function(root){
 'use strict';
 const VERSION='finance-bo-source-v1',esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function normalize(file,raw,parse,date){
  const physicalRows=raw.rowNumbers;raw=raw.rows||raw;
  const result=parse(file.file_name,raw,null);
  if(!result||!['bo_main','bo_compact','bo_transaction_export'].includes(result.code))throw Error('ไม่รองรับรูปแบบ BO: '+file.file_name);
  if(result.company&&result.company!==file.company)throw Error('บริษัทในชื่อไฟล์ไม่ตรงขอบเขต');
  const footer=raw.slice(result.headerIdx+1).filter(r=>/^(รวม(?:ทั้งหมด)?|grand total|total)$/i.test(String((r||[]).find(c=>String(c??'').trim())??'').trim())).length;
  const blocked=Object.entries(result.dropped||{}).filter(([reason,n])=>n>0&&!/^(ยอดเงินเป็นศูนย์|แถวคั่นระบบ KEEP -)/.test(reason)&&!(reason==='ไม่มีเวลาที่อ่านได้'&&n===footer));
  if(blocked.length)throw Error(file.file_name+' อ่านไม่ครบ: '+blocked.map(([r,n])=>r+' '+n+' แถว').join(', '));
  const rows=[],other=[];
  for(const r of result.records){
   const d=r.boDate||r.date,sec=r.boSec??r.sec;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isInteger(r.rowNo)||!Number.isFinite(r.amount)||r.amount<0||!['deposit','withdraw'].includes(r.direction))throw Error('แถว BO ไม่สมบูรณ์: '+file.file_name);
   if(d!==date){other.push(r.rowNo);continue;}
   rows.push({file_id:file.id,row:physicalRows?.[r.rowNo-1]||r.rowNo,date:d,sec:Number.isFinite(sec)?sec:null,amount:r.amount.toFixed(2),direction:r.direction,account:String(r.channel||r.account||'ไม่ระบุช่องทาง').slice(0,200),customer_user:String(r.memberCode||'').trim().slice(0,200),ref:String(r.ref||'').trim().slice(0,200)});
  }
  const categories={};for(const r of result.aux||[]){const key=r.infoCategory||r.kind||'ข้อมูลประกอบ';categories[key]=(categories[key]||0)+1;}
  return {rows,meta:{id:file.id,format:result.code,rows:rows.length,other_date_rows:other.length,aux_rows:(result.aux||[]).length,aux_categories:categories,dropped:result.dropped||{},footer_rows:footer},warnings:result.warnings||[]};
 }
 function totals(rows){let deposit=0,withdraw=0,deposits=0,withdrawals=0;for(const r of rows){const n=Math.round(Number(r.amount)*100);if(!Number.isSafeInteger(n))throw Error('ยอดเกินขอบเขต');if(r.direction==='deposit'){deposit+=n;deposits++;}else{withdraw+=n;withdrawals++;}}if(!Number.isSafeInteger(deposit)||!Number.isSafeInteger(withdraw))throw Error('ผลรวมเกินขอบเขต');return {deposit:deposit/100,withdraw:withdraw/100,deposits,withdrawals,count:rows.length};}
 async function mount(host,ctx){
  const actor=ctx.actor(),company=ctx.company,date=ctx.date;let disposed=false,pending=false,preview=null,request=null;
  const active=()=>!disposed&&host.isConnected&&ctx.active()&&actor===ctx.actor();
  host.financeBoSourceHasDraft=()=>pending||!!host.querySelector('[data-source-reason]')?.value.trim();
  const tell=s=>{if(active())host.querySelector('[data-source-status]').textContent=s;};
  host.innerHTML='<section class="panel"><h2>ทบทวนข้อมูล BO สำหรับรายงานเท่านั้น</h2><p>'+esc(company+' · '+date)+'</p><p>อ่านยอดจาก BO โดยใช้วัน/เวลาที่ BO บันทึก ไม่ใช้การจับคู่ STM/PM และไม่เปลี่ยนผลกระทบยอด</p><p class="hint">BO เป็น XLSX จึงไม่ต้องรอ OCR ของ STM · เก็บรายงานเดิมเป็นประวัติ ผลใหม่ยังไม่ใช้จนกว่าหัวหน้า/Admin ยืนยัน</p><button class="primary-button" data-source-read>อ่านไฟล์ BO ล่าสุด / เตรียมรายงาน</button><button class="ghost-button" data-source-close>กลับรายงาน</button><p role="status" data-source-status></p><div data-source-preview></div></section>';
  host.querySelector('[data-source-close]').onclick=()=>{if(!pending){disposed=true;ctx.close();}};
  host.querySelector('[data-source-read]').onclick=async()=>{
   if(pending||!active())return;pending=true;preview=null;request=null;host.querySelector('[data-source-read]').disabled=true;host.querySelector('[data-source-preview]').innerHTML='';
   try{
    const manifest=await ctx.manifest(company,date);if(!active())return;
    if(!manifest.can_confirm)throw Error('เฉพาะหัวหน้า/Admin ที่มีสิทธิ์บริษัท');
    if(!manifest.files.length)throw Error('ยังไม่มีไฟล์ BO ในขอบเขตนี้ ไม่เติมยอดศูนย์');
    const rows=[],files=[],hashes=new Map();
    for(const f of manifest.files){if(!active())return;tell('อ่าน BO '+(files.length+1)+'/'+manifest.files.length+' · '+f.file_name);
     if(!/\.xlsx$/i.test(f.file_name))throw Error('BO ที่ไม่รองรับ: '+f.file_name);
     const bytes=await ctx.download(f);if(!active())return;const sha=await ctx.sha256(bytes);let parsed;
     if(hashes.has(sha)){parsed={meta:{id:f.id,rows:0,duplicate_of:hashes.get(sha),sha256:sha},rows:[]};}
     else{parsed=normalize(f,await ctx.readXlsx(bytes),ctx.parse,date);hashes.set(sha,f.id);parsed.meta.sha256=sha;}
     files.push({...parsed.meta,file_name:f.file_name});rows.push(...parsed.rows);
    }
    const fresh=await ctx.manifest(company,date);if(!active())return;if(fresh.stamp!==manifest.stamp)throw Error('BO เปลี่ยนระหว่างอ่าน กรุณาอ่านใหม่');
    const refs=new Map();for(const r of rows){if(!r.ref||r.ref==='-'||r.ref==='—')continue;const k=JSON.stringify([r.ref,r.date,r.direction,r.amount,r.account,r.customer_user]);if(refs.has(k)&&refs.get(k)!==r.file_id)throw Error('พบแถวอ้างอิงซ้อนระหว่างไฟล์ BO ต้องทบทวนชุดไฟล์ก่อน ไม่บวกซ้ำหรือยืนยันอัตโนมัติ');refs.set(k,r.file_id);}
    const total=totals(rows);preview={manifest,rows,files,total};request=crypto.randomUUID();
    const money=n=>n==null?'—':Number(n).toLocaleString('th-TH',{minimumFractionDigits:2});
    const box=host.querySelector('[data-source-preview]');
    const old=manifest.previous||ctx.previous;
    box.innerHTML='<h3>ตัวอย่างผลรายงานใหม่ — ยังไม่ใช้จริง</h3><p>ฝาก '+money(total.deposit)+' · ถอน '+money(total.withdraw)+' · '+total.count+' รายการ</p><p>รายงานเดิม: '+(old?esc('ฝาก '+money(old.deposit)+' · ถอน '+money(old.withdraw)+' · '+(old.count??'—')+' รายการ'+(old.accepted_at?' · ยืนยัน '+old.accepted_at:' · ข้อมูลอ้างอิงเดิม ไม่ใช่ยอดที่แก้')):'ยังไม่มีรายงาน BO ต้นทางที่ยืนยันแยก')+'</p><div class="table-wrap"><table><thead><tr><th>ไฟล์ที่อ่านจริง</th><th>แถวในวัน</th><th>วันอื่น / ข้อมูลประกอบ</th><th>ไฟล์ซ้ำ</th></tr></thead><tbody>'+files.map(f=>'<tr><td>'+esc(f.file_name)+'</td><td>'+f.rows+'</td><td>'+(f.other_date_rows||0)+' / '+(f.aux_rows||0)+'</td><td>'+esc(f.duplicate_of?'ไม่บวกซ้ำ (เนื้อหา SHA-256 ตรงกัน)':'—')+'</td></tr>').join('')+'</tbody></table></div><p class="hint">วันอื่นไม่นับในวันนี้; โบนัส/เครดิตข้อมูลประกอบและแถวคั่นไม่ใช่เงินฝากถอน · ไม่แสดงรหัสลูกค้า · การอ่านตัวอย่างไม่บันทึกผล</p><details><summary>แถวที่ไม่นับในยอดรายงาน</summary>'+files.map(f=>'<p>'+esc(f.file_name)+' · '+esc(JSON.stringify(f.dropped||{}))+' · footer '+(f.footer_rows||0)+' แถว</p>').join('')+'</details><label>เหตุผลยืนยันรายงาน<textarea data-source-reason maxlength="1000" placeholder="เช่น ตรวจ BO ต้นฉบับ ครอบคลุมฝาก/ถอนของวันแล้ว"></textarea></label><label><input type="checkbox" data-source-ack> ฉันตรวจชุด BO ของบริษัท/วันครบแล้ว และยืนยันเฉพาะรายงาน ไม่ใช่ผลกระทบยอด</label><button class="primary-button" data-source-confirm disabled>ยืนยันใช้ชุดข้อมูลนี้ในรายงานเท่านั้น</button>';
    const refsView=document.createElement('details');refsView.innerHTML='<summary>ตรวจแถวอ้างอิง BO ทุกแถว (ไม่แสดงรหัสลูกค้า)</summary><p>'+files.map(f=>esc(f.file_name)+' · ข้อมูลประกอบ '+esc(JSON.stringify(f.aux_categories||{}))).join('<br>')+'</p><div data-source-rows></div>';box.querySelector('label').before(refsView);
    let rowPage=0;const drawRows=()=>{const start=rowPage*50,slice=rows.slice(start,start+50),names=new Map(files.map(f=>[f.id,f.file_name]));refsView.querySelector('[data-source-rows]').innerHTML='<p>'+(rows.length?start+1:0)+'–'+(start+slice.length)+' / '+rows.length+' แถว</p><button data-rows-prev '+(rowPage===0?'disabled':'')+'>ก่อนหน้า</button><button data-rows-next '+(start+50>=rows.length?'disabled':'')+'>ถัดไป</button><div class="table-wrap"><table><thead><tr><th>ไฟล์ / แถว Excel จริง</th><th>วัน/เวลา BO</th><th>ฝาก/ถอน</th><th>ยอดต้นทาง</th><th>ช่องทาง</th></tr></thead><tbody>'+slice.map(r=>'<tr><td>'+esc(names.get(r.file_id))+' · '+r.row+'</td><td>'+esc(r.date)+' '+(r.sec===null?'—':String(Math.floor(r.sec/3600)).padStart(2,'0')+':'+String(Math.floor(r.sec%3600/60)).padStart(2,'0')+':'+String(r.sec%60).padStart(2,'0'))+'</td><td>'+(r.direction==='deposit'?'ฝาก':'ถอน')+'</td><td>'+esc(r.amount)+'</td><td>'+esc(r.account)+'</td></tr>').join('')+'</tbody></table></div>';refsView.querySelector('[data-rows-prev]').onclick=()=>{rowPage--;drawRows();};refsView.querySelector('[data-rows-next]').onclick=()=>{rowPage++;drawRows();};};drawRows();
    const ready=()=>box.querySelector('[data-source-confirm]').disabled=!box.querySelector('[data-source-ack]').checked||box.querySelector('[data-source-reason]').value.trim().length<10;
    box.querySelector('[data-source-ack]').onchange=ready;box.querySelector('[data-source-reason]').oninput=ready;
    box.querySelector('[data-source-confirm]').onclick=async()=>{if(pending||!active())return;pending=true;box.querySelector('[data-source-confirm]').disabled=true;
     try{const check=await ctx.manifest(company,date);if(!active())return;if(check.stamp!==preview.manifest.stamp)throw Error('BO เปลี่ยน กรุณาอ่านใหม่ก่อนยืนยัน');
      await ctx.accept({p_request:request,p_company:company,p_date:date,p_stamp:preview.manifest.stamp,p_parser:VERSION,p_files:preview.files,p_rows:preview.rows,p_reason:box.querySelector('[data-source-reason]').value.trim(),p_ack:true});
      if(active()){preview=null;box.innerHTML='<p role="status">ยืนยันรายงานสำเร็จ เก็บเวอร์ชันเดิมครบ ไม่เปลี่ยนยอดต้นทาง/ผลกระทบยอด/เคส</p>';tell('โหลดรายงานใหม่เพื่อดูเวอร์ชันที่ยืนยัน');}
     }catch(e){tell(e.message);}finally{pending=false;if(active()&&preview)ready();}
    };tell('อ่านครบแล้ว ยังไม่ได้บันทึกหรือยืนยันรายงาน');
   }catch(e){tell(e.message);}finally{pending=false;if(active())host.querySelector('[data-source-read]').disabled=false;}
  };
  return ()=>{disposed=true;preview=null;request=null;host.innerHTML='';};
 }
 const api={VERSION,normalize,totals,mount};if(typeof module==='object')module.exports=api;else root.FinanceBoSource=api;
})(typeof window==='undefined'?globalThis:window);
