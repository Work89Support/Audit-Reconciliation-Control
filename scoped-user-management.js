(function(root){
 'use strict';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const roles={monitor:'เจ้าหน้าที่ Audit',audit_assistant:'ผู้ช่วย Audit',shift_lead:'ผู้ชี้แจงบริษัท'};
 function validate(form,scope){
  if(!Object.hasOwn(roles,form.role))throw Error('หัวหน้าสร้าง Admin/หัวหน้า/ผู้บริหารไม่ได้');
  if(!form.companies.length||form.companies.some(c=>!scope.includes(c)||c==='*'))throw Error('เลือกบริษัทภายในขอบเขตหัวหน้าเท่านั้น');
  if(!form.name.trim()||form.name.trim().length>120||form.reason.trim().length<10||form.reason.trim().length>2000)throw Error('ระบุชื่อและเหตุผลอย่างน้อย 10 ตัวอักษร');
  if(!form.target){if(form.mode==='username'){if(!/^[a-z][a-z0-9_.-]{2,31}$/.test(form.identity)||form.password.length<9||form.password.length>128||!/[a-z]/i.test(form.password)||!/[0-9]/.test(form.password))throw Error('ชื่อผู้ใช้/รหัสผ่านไม่ถูกต้อง');}else if(!/^\S+@\S+\.\S+$/.test(form.identity))throw Error('ระบุอีเมลให้ถูกต้อง');}
  return form;
 }
 function mount(host,opts){
  const actor=opts.actor();let ctx=null,error='',notice='',busy=false,editing=null,reviewed=false,requestKey=null;
  const blank=()=>({mode:'email',identity:'',password:'',name:'',role:'monitor',active:true,companies:[],reason:''});let form=blank();
  const alive=()=>host.isConnected&&opts.actor()===actor&&opts.role()==='lead';
  function draw(){
   if(!alive()){host.innerHTML='<p role="alert">ผู้ใช้หรือสิทธิ์เปลี่ยน กรุณาเปิดหน้าจัดการผู้ใช้ใหม่</p>';return;}
   host.innerHTML=`<section class="panel feature-intro"><p class="eyebrow">Scoped user management</p><h2>หัวหน้าจัดการผู้ใช้ในบริษัทของตน</h2><p>เพิ่ม/ระงับผู้ใช้ และกำหนดบริษัทได้เฉพาะขอบเขตที่ Admin กำหนดให้ ห้ามแก้ตัวเอง ห้ามสร้าง Admin/หัวหน้า/ผู้บริหาร และห้ามแก้ผู้ใช้ที่มีบริษัทอื่นร่วมอยู่</p><p><b>บริษัทที่จัดการได้:</b> ${ctx?.companies?.map(esc).join(', ')||'ยังไม่มีบริษัทที่ Admin กำหนดโดยตรง'}</p><p role="alert">${esc(error)}</p><p role="status">${esc(notice)}</p><button data-refresh ${busy?'disabled':''}>โหลดสิทธิ์ล่าสุด</button></section>
    ${!ctx?'<section class="panel">กำลังโหลดสิทธิ์จากเซิร์ฟเวอร์…</section>':!ctx.companies.length?'<section class="alert warn"><h3>ยังจัดการผู้ใช้ไม่ได้</h3><p>ให้ Admin กำหนดบริษัทให้หัวหน้ารายนี้ก่อน สิทธิ์ดูงานทุกบริษัทหรือ * ไม่ใช่สิทธิ์จัดการผู้ใช้</p></section>':`<section class="panel"><div class="panel-heading"><h3>${editing?'แก้ไข/ระงับผู้ใช้':'เพิ่มผู้ใช้ใหม่'}</h3><button data-new ${busy?'disabled':''}>+ เพิ่มผู้ใช้</button></div><form data-form class="access-user-form"><label>วิธีสร้างบัญชี <select data-mode ${editing||busy?'disabled':''}><option value="email" ${form.mode==='email'?'selected':''}>อีเมล / ส่งคำเชิญ</option><option value="username" ${form.mode==='username'?'selected':''}>ชื่อผู้ใช้ / ไม่ใช้อีเมล</option></select></label><label>${form.mode==='username'?'ชื่อผู้ใช้':'อีเมล'} <input data-identity value="${esc(form.identity)}" ${editing||busy?'disabled':''} autocomplete="off" required></label>
    ${!editing&&form.mode==='username'?'<label>รหัสผ่านบัญชีใหม่ <input type="password" data-password autocomplete="new-password" minlength="9" maxlength="128" required><small>อย่างน้อย 9 ตัว มีตัวอักษรและตัวเลข · ไม่เก็บรหัสผ่านในประวัติ</small></label>':''}
    <label>ชื่อที่แสดง <input data-name value="${esc(form.name)}" maxlength="120" ${busy?'disabled':''} required></label><label>บทบาท <select data-role ${busy?'disabled':''}>${Object.entries(roles).map(([k,v])=>`<option value="${k}" ${form.role===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label class="manual-check"><input type="checkbox" data-active ${form.active?'checked':''} ${busy?'disabled':''}>เปิดใช้งาน (เอาติ๊กออกเพื่อระงับ)</label><fieldset><legend>บริษัทที่เข้าถึงได้</legend><div class="company-access-grid">${ctx.companies.map(c=>`<label><input type="checkbox" data-company="${esc(c)}" ${form.companies.includes(c)?'checked':''} ${busy?'disabled':''}>${esc(c)}</label>`).join('')}</div></fieldset><label>เหตุผล (10–2,000 ตัวอักษร)<textarea data-reason rows="3" minlength="10" maxlength="2000" ${busy?'disabled':''} required>${esc(form.reason)}</textarea></label><label class="manual-check"><input type="checkbox" data-reviewed ${reviewed?'checked':''} ${busy?'disabled':''}>ฉันตรวจชื่อ บทบาท สถานะ และบริษัทแล้ว</label><button type="submit" class="primary-button" ${busy?'disabled':''}>${editing?'บันทึกการแก้ไขสิทธิ์':'สร้างผู้ใช้ / ส่งคำเชิญ'}</button><p>เซิร์ฟเวอร์ตรวจสิทธิ์และข้อมูลล่าสุดก่อนบันทึก เก็บประวัติทุกครั้ง</p></form></section>
    <section class="panel"><h3>ผู้ใช้ที่หัวหน้าจัดการได้ (${ctx.users.length})</h3><p>ไม่แสดงตัวเอง Admin/หัวหน้า/ผู้บริหาร หรือผู้ใช้ที่มีบริษัทนอกขอบเขต · ผู้ใช้กลุ่มนั้นให้ Admin จัดการ</p><div class="table-wrap"><table><thead><tr><th>ชื่อ / อีเมล</th><th>บทบาท</th><th>บริษัท</th><th>สถานะ</th><th></th></tr></thead><tbody>${ctx.users.map(u=>`<tr><td>${esc(u.full_name)}<small class="sub">${esc(u.email)}</small></td><td>${esc(roles[u.role])}</td><td>${esc(u.companies.join(', '))}</td><td>${u.active?'ใช้งาน':'ระงับ'}</td><td><button data-edit="${esc(u.user_id)}" ${busy?'disabled':''}>แก้ไข / ระงับ</button></td></tr>`).join('')||'<tr><td colspan="5">ยังไม่มีผู้ใช้ที่จัดการได้</td></tr>'}</tbody></table></div></section>`}`;
   host.querySelector('[data-refresh]').onclick=load;
   if(!ctx?.companies.length)return;
   host.querySelector('[data-new]').onclick=()=>{editing=null;form=blank();requestKey=null;reviewed=false;error='';draw();};
   host.querySelectorAll('[data-edit]').forEach(e=>e.onclick=()=>{const u=ctx.users.find(x=>x.user_id===e.dataset.edit);editing=u;form={...blank(),target:u.user_id,mode:u.email.endsWith('@users.audit.invalid')?'username':'email',identity:u.email.endsWith('@users.audit.invalid')?u.email.split('@')[0]:u.email,name:u.full_name,role:u.role,active:u.active,companies:[...u.companies]};reviewed=false;requestKey=null;draw();});
   host.querySelector('[data-mode]').onchange=e=>{form.mode=e.target.value;form.identity='';form.password='';requestKey=null;reviewed=false;draw();};
   const invalidate=()=>{reviewed=false;host.querySelector('[data-reviewed]').checked=false;};
   for(const [selector,key] of [['identity','identity'],['name','name'],['role','role'],['reason','reason'],['password','password']])host.querySelector('[data-'+selector+']')?.addEventListener('input',e=>{form[key]=e.target.value;invalidate();});
   host.querySelector('[data-active]').onchange=e=>{form.active=e.target.checked;invalidate();};host.querySelector('[data-reviewed]').onchange=e=>reviewed=e.target.checked;
   host.querySelectorAll('[data-company]').forEach(e=>e.onchange=()=>{form.companies=e.checked?[...new Set([...form.companies,e.dataset.company])]:form.companies.filter(c=>c!==e.dataset.company);invalidate();});
   host.querySelector('[data-form]').onsubmit=async e=>{
    e.preventDefault();if(busy||!alive())return;
    try{if(!reviewed)throw Error('ทบทวนและติ๊กยืนยันข้อมูลก่อนบันทึก');validate(form,ctx.companies);if(form.target===actor)throw Error('หัวหน้าไม่สามารถแก้สิทธิ์ตัวเอง');busy=true;error='';
     const payload={...form,companies:[...form.companies].sort()};draw();
     if(editing)await opts.update({p_target:editing.user_id,p_revision:editing.revision,p_name:payload.name.trim(),p_role:payload.role,p_active:payload.active,p_companies:payload.companies,p_reason:payload.reason.trim()});
     else{requestKey=requestKey||crypto.randomUUID();await opts.create({login_mode:payload.mode,email:payload.mode==='email'?payload.identity.trim().toLowerCase():undefined,username:payload.mode==='username'?payload.identity.trim().toLowerCase():undefined,password:payload.mode==='username'?payload.password:undefined,full_name:payload.name.trim(),role:payload.role,active:payload.active,companies:payload.companies,reason:payload.reason.trim(),request_key:requestKey});}
     notice=editing?'บันทึกสิทธิ์แล้ว เก็บประวัติครบ':'สร้างผู้ใช้แล้ว กำหนดเฉพาะบริษัทที่เลือก';form.password='';editing=null;form=blank();reviewed=false;requestKey=null;ctx=await opts.load();
    }catch(e){error=e.message;form.password='';}finally{busy=false;draw();}
   };
  }
  async function load(){if(busy||!alive())return;busy=true;error='';draw();try{ctx=await opts.load();}catch(e){ctx=null;error=e.message;}finally{busy=false;draw();}}
  draw();load();return()=>{form.password='';host.innerHTML='';};
 }
 root.ScopedUserManagement={mount,roles,validate};if(typeof module!=='undefined')module.exports=root.ScopedUserManagement;
})(typeof window==='undefined'?globalThis:window);
