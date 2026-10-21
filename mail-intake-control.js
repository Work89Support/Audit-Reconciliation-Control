const MailIntakeControl = (() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const statusLabel = status => ({queued:'รอดึง',processing:'กำลังดึง',completed:'ดึงสำเร็จ',partial:'สำเร็จบางส่วน',error:'ผิดพลาด',cancelled:'ยกเลิก'})[status] || status;
  const dateTime = value => value ? new Date(value).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}) : '—';
  const splitList = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);

  function mount(root,{api,role,today,isActive=()=>true,notify=()=>{}}){
    let sources=[];
    let requests=[];
    const editable=['lead','admin'].includes(role);
    const render=()=>{
      root.innerHTML=`<section class="panel mail-intake-summary">
        <div class="panel-heading"><div><p class="eyebrow">คลังอีเมลต้นทาง</p><h2>ตรวจผู้ส่งและดึงเมลที่ตกหล่น</h2><p>เพิ่มผู้ส่งที่เชื่อถือได้ แล้วสั่งดึงเฉพาะช่วงวันที่เข้าคลังเอกสาร</p></div><span class="health ${sources.length?'ok':'warn'}">${sources.length.toLocaleString('th-TH')} ผู้ส่ง</span></div>
        <div class="alert warn"><strong>แยกจากการกระทบยอด</strong><span>การเพิ่มผู้ส่งและกดดึงเมลไม่ใช่การยืนยันผล ไม่แก้ยอด ไม่เปลี่ยนสถานะเคส และไม่ปิดเคส</span></div>
      </section>
      <section class="mail-intake-grid">
        <article class="panel"><h3>1. เพิ่มอีเมลผู้ส่ง</h3><p>ใช้เมื่อมีอีเมลต้นทางใหม่ หรืออีเมลเดิมยังไม่อยู่ในทะเบียน</p>
          <form id="mailSourceForm" class="mail-intake-form">
            <label><span>อีเมลผู้ส่ง</span><input id="mailSourceEmail" type="email" autocomplete="off" placeholder="name@example.com" required ${editable?'':'disabled'}></label>
            <label><span>ชื่อที่แสดง</span><input id="mailSourceName" placeholder="เช่น All Head" required ${editable?'':'disabled'}></label>
            <label><span>ระบบที่ส่ง (คั่นด้วย ,)</span><input id="mailSourceSystems" placeholder="เช่น SYS123, XXX" ${editable?'':'disabled'}></label>
            <label><span>รายงานที่คาดว่าจะได้รับ (คั่นด้วย ,)</span><input id="mailSourceReports" placeholder="เช่น STM, EVIDENCE" ${editable?'':'disabled'}></label>
            <label><span>หมายเหตุ</span><textarea id="mailSourceNote" rows="2" placeholder="บริษัทหรือรูปแบบเมล" ${editable?'':'disabled'}></textarea></label>
            <button class="primary-button" ${editable?'':'disabled'}>เพิ่ม/เปิดใช้งานอีเมล</button>
          </form>
        </article>
        <article class="panel"><h3>2. ดึงเมลเข้าคลัง</h3><p>ดึงได้ครั้งละไม่เกิน 32 วัน ระบบกันคำขอซ้ำและเก็บผู้กดพร้อมเวลา</p>
          <form id="mailPullForm" class="mail-intake-form">
            <label><span>อีเมลผู้ส่ง</span><select id="mailPullEmail" required ${editable?'':'disabled'}><option value="">เลือกผู้ส่ง</option>${sources.filter(item=>item.active).map(item=>`<option value="${escapeHtml(item.email)}">${escapeHtml(item.display_name)} · ${escapeHtml(item.email)}</option>`).join('')}</select></label>
            <div class="mail-intake-dates"><label><span>ตั้งแต่วันที่</span><input id="mailPullFrom" type="date" value="${escapeHtml(today)}" required ${editable?'':'disabled'}></label><label><span>ถึงวันที่</span><input id="mailPullTo" type="date" value="${escapeHtml(today)}" required ${editable?'':'disabled'}></label></div>
            <button class="primary-button" ${editable?'':'disabled'}>ส่งคำขอดึงเมล</button>
            <small>คำขอจะเข้าคิว n8n และแสดงใบรับด้านล่าง การดึงซ้ำใช้ Gmail Message ID ป้องกันไฟล์ซ้ำ</small>
          </form>
        </article>
      </section>
      <section class="panel"><div class="panel-heading"><div><h3>ทะเบียนผู้ส่ง</h3><p>เฉพาะอีเมลที่เปิดใช้งานจึงถูกดึงเข้าคลัง</p></div><button class="ghost-button sm" id="mailIntakeRefresh">โหลดใหม่</button></div>
        <div class="table-wrap"><table><thead><tr><th>ผู้ส่ง</th><th>ระบบ</th><th>รายงาน</th><th>สถานะ</th><th>แก้ไขล่าสุด</th></tr></thead><tbody>${sources.map(item=>`<tr><td><b>${escapeHtml(item.display_name)}</b><small>${escapeHtml(item.email)}</small></td><td>${escapeHtml((item.business_systems||[]).join(', ')||'—')}</td><td>${escapeHtml((item.expected_reports||[]).join(', ')||'—')}</td><td><span class="badge ${item.active?'green':'grey'}">${item.active?'เปิดใช้':'ปิดใช้'}</span></td><td>${dateTime(item.updated_at)}</td></tr>`).join('')||'<tr><td colspan="5">ยังไม่มีทะเบียนผู้ส่ง</td></tr>'}</tbody></table></div>
      </section>
      <section class="panel"><div class="panel-heading"><div><h3>ประวัติคำขอดึงเมล</h3><p>ใบรับนี้ยืนยันเฉพาะการรับคำขอและผลนำเข้าคลัง ไม่ใช่ผลกระทบยอด</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>วันที่ขอ</th><th>ผู้ส่ง / ช่วงวันที่</th><th>สถานะ</th><th>ผลดึง</th><th>ผู้ขอ</th></tr></thead><tbody>${requests.map(item=>`<tr><td>${dateTime(item.requested_at)}</td><td><b>${escapeHtml(item.source_email)}</b><small>${escapeHtml(item.date_from)} ถึง ${escapeHtml(item.date_to)}</small></td><td><span class="badge ${item.status==='completed'?'green':item.status==='error'?'red':'amber'}">${escapeHtml(statusLabel(item.status))}</span>${item.error_message?`<small class="mail-intake-error">${escapeHtml(item.error_message)}</small>`:''}</td><td>พบ ${Number(item.found_count||0).toLocaleString('th-TH')} · เข้าใหม่ ${Number(item.imported_count||0).toLocaleString('th-TH')} · ข้าม ${Number(item.skipped_count||0).toLocaleString('th-TH')}</td><td>${escapeHtml(item.requested_by_email||'—')}</td></tr>`).join('')||'<tr><td colspan="5">ยังไม่มีคำขอดึงเมล</td></tr>'}</tbody></table></div>
      </section>`;
      bind();
    };
    const load=async()=>{
      root.innerHTML='<section class="panel"><p>กำลังอ่านทะเบียนผู้ส่งและคิวดึงเมล…</p></section>';
      try{[sources,requests]=await Promise.all([api.mailSources(),api.mailPullRequests()]);if(isActive())render();}
      catch(error){if(isActive())root.innerHTML=`<section class="alert warn"><strong>อ่านข้อมูลตรวจเมลไม่สำเร็จ</strong><span>${escapeHtml(error.message)}</span><button class="ghost-button" id="mailIntakeRetry">ลองใหม่</button></section>`;document.querySelector('#mailIntakeRetry')?.addEventListener('click',load);}
    };
    const bind=()=>{
      root.querySelector('#mailIntakeRefresh')?.addEventListener('click',load);
      root.querySelector('#mailSourceForm')?.addEventListener('submit',async event=>{
        event.preventDefault();const button=event.submitter;button.disabled=true;
        try{await api.registerMailSource({email:root.querySelector('#mailSourceEmail').value,displayName:root.querySelector('#mailSourceName').value,businessSystems:splitList(root.querySelector('#mailSourceSystems').value),expectedReports:splitList(root.querySelector('#mailSourceReports').value),note:root.querySelector('#mailSourceNote').value});notify('เพิ่มผู้ส่งแล้ว ยังไม่ได้ดึงเมลหรือรันกระทบยอด','ok');await load();}
        catch(error){notify(error.message,'warn');button.disabled=false;}
      });
      root.querySelector('#mailPullForm')?.addEventListener('submit',async event=>{
        event.preventDefault();const button=event.submitter;button.disabled=true;
        try{await api.requestMailPull({email:root.querySelector('#mailPullEmail').value,dateFrom:root.querySelector('#mailPullFrom').value,dateTo:root.querySelector('#mailPullTo').value});notify('รับคำขอดึงเมลแล้ว ตรวจสถานะได้จากใบรับด้านล่าง','ok');await load();}
        catch(error){notify(error.message,'warn');button.disabled=false;}
      });
    };
    load();
    return ()=>{};
  }
  return {mount};
})();

