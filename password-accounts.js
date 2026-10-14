(function(root){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function parse(text,users,resetExisting){
  const seen=new Set();return String(text).trim().split(/\n/).filter(s=>s.trim()).map(line=>{
   const [raw,...parts]=line.split('\t'),email=raw.trim().toLowerCase(),name=parts.join(' ').trim();
   if(!/^\S+@\S+\.\S+$/.test(email)||email.endsWith('@users.audit.invalid')||!name||name.length>120)throw Error('แต่ละบรรทัดต้องเป็นอีเมล ตามด้วย Tab และชื่อพร้อมตำแหน่ง');
   if(seen.has(email))throw Error('อีเมลซ้ำในรายการ: '+email);seen.add(email);
   const old=users.find(u=>u.email.toLowerCase()===email);
   if(old&&old.role!=='shift_lead')throw Error('ไม่เปลี่ยนบัญชีที่ไม่ใช่ผู้ชี้แจง: '+email);
   return {email,full_name:old?old.full_name:name,action:old?(resetExisting?'reset':'skip'):'create',request_key:crypto.randomUUID(),state:'ready'};
  });
 }
 function mount(host,{users,companies,actor,role,call}){
  const owner=actor();let plan=[];let busy=false;
  host.innerHTML=`<section class="panel"><p class="eyebrow">ไม่ใช้ SMTP · เฉพาะ Admin</p><h2>อีเมล + รหัสผ่านเริ่มต้น</h2><p>สร้างเฉพาะผู้ชี้แจง · บัญชีใหม่ต้องเปลี่ยนรหัสก่อนอ่านข้อมูล · บัญชีเดิมไม่สร้างซ้ำ การรีเซ็ตไม่เปลี่ยนชื่อ ตำแหน่ง บริษัท หรือสิทธิ์เดิม</p><label>รายการอีเมลและชื่อพร้อมตำแหน่ง (คั่นด้วย Tab)<textarea data-roster rows="6" placeholder="name@example.com&#9;หัวหน้าผู้ชี้แจง · X1 · ชื่อ" autocomplete="off"></textarea></label><p>บัญชีใหม่เข้าถึง: ${companies.map(esc).join(', ')} · สิทธิ์ผู้ชี้แจงเท่านั้น</p><label><input type="checkbox" data-reset>รีเซ็ตบัญชีผู้ชี้แจงที่มีอยู่ด้วย (ไม่เปลี่ยนสิทธิ์เดิม)</label><button data-preview>ตรวจบัญชี / ทบทวนรายการ</button><div data-plan></div><label>รหัสผ่านเริ่มต้น — ผู้ดูแลกรอกเอง<input type="password" data-password autocomplete="new-password" minlength="9" maxlength="128"></label><p>ไม่เก็บรหัสในประวัติหรือไฟล์ · ผู้ดูแลส่งรหัสให้แต่ละคนผ่านช่องทางที่ปลอดภัย</p><label>เหตุผล<textarea data-reason rows="2" minlength="10" maxlength="2000"></textarea></label><label><input type="checkbox" data-review>ฉันตรวจอีเมล ตำแหน่ง บริษัท และการรีเซ็ตบัญชีเดิมแล้ว และรับรองตัวตนแทนการยืนยันทางอีเมล</label><button data-submit class="primary-button">สร้าง / รีเซ็ตรหัสตามรายการที่ทบทวน</button><p role="alert" data-error></p><p role="status" data-status></p></section>`;
  const q=s=>host.querySelector(s),alive=()=>host.isConnected&&actor()===owner&&role()==='admin';
  function drawPlan(){q('[data-plan]').innerHTML='<table><thead><tr><th>ชื่อ / ตำแหน่ง</th><th>อีเมล</th><th>การดำเนินการ</th><th>ผล</th></tr></thead><tbody>'+plan.map(p=>`<tr><td>${esc(p.full_name)}</td><td>${esc(p.email)}</td><td>${esc({create:'สร้างใหม่',reset:'รีเซ็ตบัญชีเดิม',skip:'ข้ามบัญชีเดิม'}[p.action])}</td><td>${esc(p.state)}</td></tr>`).join('')+'</tbody></table>';}
  const invalidate=()=>{if(!busy){plan=[];q('[data-review]').checked=false;q('[data-plan]').innerHTML='';}};
  q('[data-roster]').oninput=invalidate;q('[data-reset]').onchange=invalidate;
  q('[data-preview]').onclick=()=>{try{if(!alive()||busy)return;plan=parse(q('[data-roster]').value,users,q('[data-reset]').checked);if(!plan.length||plan.length>30)throw Error('เลือก 1–30 บัญชี');q('[data-error]').textContent='';drawPlan();}catch(e){q('[data-error]').textContent=e.message;}};
  q('[data-submit]').onclick=async()=>{
   if(!alive()||busy)return;let password=q('[data-password]').value;const reason=q('[data-reason]').value.trim();
   if(!plan.length||!q('[data-review]').checked||reason.length<10||reason.length>2000||password.length<9||password.length>128||!/[a-z]/i.test(password)||!/[0-9]/.test(password)){q('[data-error]').textContent='ทบทวนรายการ ยืนยันข้อมูล ระบุเหตุผลและรหัสผ่าน 9–128 ตัวที่มีตัวอักษรและตัวเลขก่อน';return;}
   busy=true;q('[data-error]').textContent='';host.querySelectorAll('input,textarea,button').forEach(e=>e.disabled=true);
   try{
    for(const p of plan){if(!alive())throw Error('ผู้ใช้หรือสิทธิ์เปลี่ยน หยุดรายการที่เหลือ');if(p.action==='skip'||p.state!=='ready')continue;
     p.state='กำลังดำเนินการ';drawPlan();
     try{const result=await call({...p,password,companies,reason,reviewed:true});if(!result?.ok)throw Error('ยังยืนยันผลไม่ได้');p.state=result.replayed?'สำเร็จจากคำขอเดิม ไม่ทำซ้ำ':'สำเร็จ · รอเปลี่ยนรหัสครั้งแรก';}
     catch(e){p.state='ต้องตรวจคำขอ '+p.request_key+' ก่อนทำซ้ำ';throw e;}finally{drawPlan();}
    }
    q('[data-status]').textContent='เสร็จแล้ว ไม่ส่งอีเมล ไม่เปลี่ยนยอดหรือเคส';
   }catch(e){q('[data-error]').textContent=e.message+' · หยุดรายการถัดไป ไม่ส่งซ้ำอัตโนมัติ';}
   finally{password='';q('[data-password]').value='';q('[data-review]').checked=false;busy=false;host.querySelectorAll('input,textarea,button').forEach(e=>e.disabled=false);}
  };
 }
 root.PasswordAccounts={parse,mount};if(typeof module!=='undefined')module.exports=root.PasswordAccounts;
})(typeof window==='undefined'?globalThis:window);
