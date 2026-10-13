/* Scoped recheck UI. Results remain staged until an authorized server decision. */
(function(root){
  'use strict';
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canConfirm=role=>['lead','admin'].includes(role);
  const validScope=s=>s&&/^[A-Z0-9]+$/.test(s.company)&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&String(s.account||'').trim()&&['all','deposit','withdraw'].includes(s.direction);
  function mount(host,opts){
    let busy=false,loaded=false,items=[],error='',dispatchError='',runState=null,active=true,account=opts.accounts[0],direction='all',timer,opened=null;
    const actor=opts.actor?.(),sameActor=()=>!opts.actor||opts.actor()===actor;
    const statusName={queued:'รอ Worker รับงาน',running:'กำลังตรวจไฟล์',ready:'พร้อมทบทวน',failed:'ตรวจไม่สำเร็จ',stale:'ข้อมูลเปลี่ยน ต้องตรวจใหม่',confirmed:'ยืนยันผลตรวจซ้ำแล้ว'};
    const draw=()=>{
      if(!active)return;if(!sameActor()){host.innerHTML='<p role="alert">บัญชีผู้ใช้เปลี่ยน กรุณาปิดและเปิดใหม่</p>';return;}
      const running=!loaded||items.some(q=>['queued','running'].includes(q.status))||runState?.job?.status==='running';
      host.innerHTML=`<section class="manual-tools"><div class="manual-scope"><strong>${escape(opts.company)} · ${escape(opts.date)}</strong><span>เลือกไฟล์ → ตรวจซ้ำ → ทบทวนและยืนยัน</span></div><p>ผลใหม่แยกจากรอบบอท เก็บผลเดิมไว้ ไม่แก้ยอด และไม่เปิดหรือปิดเคสอัตโนมัติ</p>
        ${opts.loadState&&root.FileRunManagement?root.FileRunManagement.noticeHtml(runState):''}
        <div class="manual-fields"><label>บัญชี <select data-account ${busy||running?'disabled':''}>${opts.accounts.map(a=>`<option value="${escape(a)}" ${a===account?'selected':''}>${escape(a==='ALL'?'ทุกบัญชีในไฟล์ที่เลือก':a)}</option>`).join('')}</select></label>
        <label>ประเภท <select data-direction ${busy||running?'disabled':''}>${['all','deposit','withdraw'].map((d,i)=>`<option value="${d}" ${d===direction?'selected':''}>${['ฝากและถอน','ฝาก','ถอน'][i]}</option>`).join('')}</select></label></div>
        <div class="manual-actions"><button data-compare ${busy||running?'disabled':''}>ตรวจเปรียบเทียบ (ไม่ใช้ผล)</button>
        <button class="primary" data-stage ${busy||running?'disabled':''}>รันตรวจมือ · รอหัวหน้า/ผู้ดูแลยืนยันผล</button>
        <button data-refresh ${busy?'disabled':''}>โหลดสถานะล่าสุด</button>
        </div><p role="alert">${escape(error||dispatchError)}</p>${running?'<p class="manual-note">กำลังตรวจ ไม่ต้องกดซ้ำ หน้านี้อัปเดตสถานะอัตโนมัติ</p>':''}<div data-results>${items.map(q=>`<article><b>${escape(q.account)} · ${escape(q.direction)} · ${escape(q.mode==='compare'?'ผลเปรียบเทียบ':'รอยืนยันผลตรวจซ้ำ')}</b>
          <p><span class="manual-state ${q.status==='confirmed'?'confirmed':''}">${escape(statusName[q.status]||q.status)}</span> ${q.error?' · '+escape(q.error):''}</p>
          ${q.result?`<p>STM/PM ${escape(q.result.stm_count)} รายการ · BO ${escape(q.result.bo_count)} รายการ · จับคู่ ${escape(q.result.matched)} คู่ · ต้องตรวจ ${escape(q.result.exception_count??q.result.exceptions?.length??0)} รายการ</p><button data-detail="${escape(q.id)}" ${busy?'disabled':''}>ดูรายละเอียด / ดาวน์โหลดรายงาน</button>`:''}
          ${opened?.id===q.id?`<div class="manual-review"><h4>ทบทวนรายละเอียด</h4><button data-export>ดาวน์โหลด Excel · STM → BO → ผลเทียบ</button><p>รายการจับคู่ ${(opened.result?.match_evidence||[]).length} คู่ · รายการต้องตรวจ ${(opened.result?.exceptions||[]).length}</p><details><summary>ดูรายการต้องตรวจ</summary>${(opened.result?.exceptions||[]).map(e=>`<p>${escape(e.account)} · ${escape(e.type_name||e.ex_type)} · STM/PM ${escape(e.bank_amount??'—')} ↔ BO ${escape(e.system_amount??'—')} · ${escape(e.detail||'')}</p>`).join('')}</details></div>`:''}
          ${q.status==='ready'&&q.mode==='account'&&opened?.id===q.id?canConfirm(opts.role())?`<label class="manual-check"><input type="checkbox" data-reviewed="${escape(q.id)}"> ฉันทบทวนผลและหลักฐานแล้ว</label><label>เหตุผลยืนยัน <input data-reason="${escape(q.id)}" maxlength="2000"></label>
          <button class="primary" data-confirm="${escape(q.id)}" disabled>ทบทวนและยืนยันผลตรวจซ้ำ</button><p>ยืนยันได้เฉพาะหัวหน้า / ผู้ดูแล มีการยืนยันขั้นสุดท้าย และเซิร์ฟเวอร์ตรวจสิทธิ์/เวอร์ชันล่าสุดอีกครั้ง</p>`:'<p class="manual-note">Audit ดูและดาวน์โหลดได้ แต่ยืนยันได้เฉพาะหัวหน้า/ผู้ดูแล</p>':''}</article>`).join('')||'<p>ยังไม่มีคำสั่งตรวจซ้ำในวันนี้</p>'}</div></section>`;
      host.querySelector('[data-account]').onchange=e=>{account=e.target.value;};host.querySelector('[data-direction]').onchange=e=>{direction=e.target.value;};
      host.querySelector('[data-compare]').onclick=()=>request('compare');
      host.querySelector('[data-stage]').onclick=()=>request('account');
      host.querySelector('[data-refresh]').onclick=refresh;
      host.querySelectorAll('[data-detail]').forEach(el=>el.onclick=async()=>{busy=true;draw();try{opened=await opts.detail(el.dataset.detail);error='';}catch(e){error=e.message;}finally{busy=false;draw();}});
      host.querySelector('[data-export]')?.addEventListener('click',()=>opts.exportWorkbook?.(exportSheets(opened),`ตรวจซ้ำ_${opened.company}_${opened.business_date}_${opened.id}`,'รายงานแยกจากรอบบริษัทเดิม · ไม่เปลี่ยนยอดหรือเคส'));
      const enable=id=>{host.querySelector(`[data-confirm="${id}"]`).disabled=busy||!sameActor()||!host.querySelector(`[data-reviewed="${id}"]`).checked||host.querySelector(`[data-reason="${id}"]`).value.trim().length<10||!canConfirm(opts.role());};
      host.querySelectorAll('[data-reviewed]').forEach(el=>el.onchange=()=>enable(el.dataset.reviewed));
      host.querySelectorAll('[data-reason]').forEach(el=>el.oninput=()=>enable(el.dataset.reason));
      host.querySelectorAll('[data-confirm]').forEach(el=>el.onclick=async()=>{
        const id=el.dataset.confirm,q=items.find(x=>x.id===id);
        const reason=host.querySelector(`[data-reason="${id}"]`).value.trim();
        if(!sameActor()||!canConfirm(opts.role())||!host.querySelector(`[data-reviewed="${id}"]`).checked||reason.length<10){error='เฉพาะหัวหน้า/ผู้ดูแล ต้องทบทวนและระบุเหตุผลอย่างน้อย 10 ตัวอักษร';draw();return;}
        let latest;try{latest=await opts.detail(id);if(latest.status!=='ready'||latest.revision!==q.revision){error='ผลหรือสถานะเปลี่ยน ต้องเปิดทบทวนใหม่';opened=null;draw();return;}if(!await opts.finalConfirmation(latest))return;}catch(e){error=e.message;draw();return;}
        if(!sameActor()){error='ผู้ใช้เปลี่ยน กรุณาเปิดทบทวนใหม่';draw();return;}
        busy=true;draw();
        try{await opts.confirm({p_id:id,p_expected_revision:latest.revision,p_reason:reason,p_reviewed:true});error='';opened=null;await refresh();}
        catch(e){error=e.message;}finally{busy=false;draw();}
      });
    };
    async function request(mode){
      const scope={company:opts.company,date:opts.date,account,direction};
      if(!sameActor()||!validScope(scope)){error='ผู้ใช้เปลี่ยนหรือเลือกขอบเขตไม่ครบ กรุณาเปิดหน้าตรวจใหม่';draw();return;}
      busy=true;error='';dispatchError='';draw();
      try{const storageKey='audit-manual-request:'+JSON.stringify([actor,scope.company,scope.date,scope.account,scope.direction,mode,[...(opts.fileIds||[])].sort()]);let requestKey;try{requestKey=root.sessionStorage?.getItem(storageKey)||crypto.randomUUID();root.sessionStorage?.setItem(storageKey,requestKey);}catch{requestKey=crypto.randomUUID();}const reply=await opts.request({...scope,mode,fileIds:opts.fileIds?[...opts.fileIds].sort():null,requestKey});dispatchError=reply.dispatch_error||'';await refresh();}
      catch(e){error=e.message;}finally{busy=false;draw();}
    }
    async function refresh(){clearTimeout(timer);try{const result=await Promise.all([opts.list(opts.company,opts.date),opts.loadState?opts.loadState(opts.company,opts.date):Promise.resolve(null)]);items=result[0];runState=result[1];if(!active||!sameActor())return;loaded=true;error='';if(items.some(q=>['running','ready','confirmed'].includes(q.status)))dispatchError='';for(const q of items)if(!['queued','running'].includes(q.status)){try{const key='audit-manual-request:'+JSON.stringify([actor,q.company,q.business_date,q.account,q.direction,q.mode,[...(opts.fileIds||[])].sort()]);if(root.sessionStorage?.getItem(key)===q.request_key)root.sessionStorage?.removeItem(key);}catch{}}}catch(e){loaded=false;runState=null;error='โหลดสถานะไม่สำเร็จ: '+e.message;}draw();if(active&&sameActor()&&items.some(q=>['queued','running'].includes(q.status)))timer=setTimeout(refresh,5000);}
    draw();refresh();return()=>{active=false;clearTimeout(timer);opened=null;host.innerHTML='';};
  }
  function exportSheets(q){const r=q.result||{},status=q.status==='confirmed'?'ยืนยันผลตรวจซ้ำแล้ว · ไม่เปลี่ยนเคส':'ผลตรวจซ้ำ · ยังไม่ใช่ผลรอบบริษัท',stamp=t=>t?.date?[t.date,Number.isFinite(t.sec)?new Date(t.sec*1000).toISOString().slice(11,19):''].filter(Boolean).join(' '):'—';const rows=(r.match_evidence||[]).map(p=>[stamp(p.stm),p.stmAmount??p.amount??null,p.stm?.fileId||'',p.stm?.row??'',stamp(p.bo),p.boAmount??p.amount??null,p.bo?.fileId||'',p.bo?.row??'',p.method||'จับคู่แล้ว',status]);for(const e of r.exceptions||[])rows.push([[e.stm_date,e.stm_time].filter(Boolean).join(' ')||'—',e.bank_amount??null,e.customer_details?.source_rows?.stm?.fileId||'',e.customer_details?.source_rows?.stm?.row??'',[e.bo_date,e.bo_time].filter(Boolean).join(' ')||'—',e.system_amount??null,e.customer_details?.source_rows?.bo?.fileId||'',e.customer_details?.source_rows?.bo?.row??'',e.type_name||e.ex_type||'ต้องตรวจ',status]);return [{name:'สรุปตรวจซ้ำ',title:`${q.company} ${q.business_date} · ${q.account}`,headers:['บริษัท','วันที่','บัญชี','ประเภท','STM/PM รายการ','BO รายการ','จับคู่','ต้องตรวจ','สถานะผล','ยืนยันเมื่อ','เหตุผล','รอบเดิมอ้างอิง'],rows:[[q.company,q.business_date,q.account,q.direction,r.stm_count,r.bo_count,r.matched,r.exceptions?.length??r.exception_count??0,status,q.confirmed_at||'',q.confirmation_reason||'',q.base_run_id||'']],widths:[14,14,26,14,18,18,14,14,38,24,50,40]},{name:'STM BO ผลเทียบ',title:'ผลตรวจซ้ำ · เก็บทุกแถว ไม่ยุบยอดเท่ากันต่างเวลา',headers:['STM/PM วันเวลา','STM/PM ยอด','STM/PM ไฟล์','STM/PM แถว','BO วันเวลา','BO ยอด','BO ไฟล์','BO แถว','ผลเทียบ','สถานะยืนยันผล'],rows,widths:[24,18,40,14,24,18,40,14,40,42]}];}
  function confirmedSheets(items){const rows=items.filter(q=>q.status==='confirmed').map(q=>[q.company,q.business_date,q.account,q.direction,q.result?.stm_count??null,q.result?.bo_count??null,q.result?.matched??null,q.result?.exception_count??null,q.confirmed_at||'',q.confirmed_by||'',q.confirmation_reason||'',q.base_run_id||'']);return rows.length?[{name:'ผลตรวจซ้ำยืนยัน',title:'รายงานเพิ่มเติมที่หัวหน้า/ผู้ดูแลยืนยัน · ไม่ทับผลรอบบริษัทเดิม',headers:['บริษัท','วันที่','บัญชี','ประเภท','STM/PM รายการ','BO รายการ','จับคู่','ต้องตรวจ','ยืนยันเมื่อ','ผู้ยืนยัน','เหตุผล','อ้างอิงรอบเดิม'],rows,widths:[14,14,30,14,18,18,14,14,24,40,50,40]}]:[];}
  function reportPanel(items){const q=items.filter(x=>x.status==='confirmed');return q.length?`<section class="manual-confirmed-report"><h3>ผลตรวจซ้ำที่ยืนยันแล้ว (${q.length})</h3><p>รายงานเพิ่มเติมตามขอบเขตที่เลือก · ไม่ทับผลบริษัทเดิม ไม่แก้ยอดหรือเคส</p>${q.map(x=>`<p><strong>${escape(x.account==='ALL'?'ทุกบัญชีในไฟล์ที่เลือก':x.account)}</strong> · STM/PM ${escape(x.result?.stm_count)} · BO ${escape(x.result?.bo_count)} · จับคู่ ${escape(x.result?.matched)} · ${escape(x.confirmed_at)}</p>`).join('')}</section>`:'';}
  root.AccountRecheck={mount,canConfirm,validScope,exportSheets,confirmedSheets,reportPanel};
  if(typeof module!=='undefined')module.exports=root.AccountRecheck;
})(typeof window==='undefined'?globalThis:window);
