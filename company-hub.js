/* Explicit, authenticated, read-only handoff. Never transfer sessions. */
(()=>{
 const origin='https://work89support.github.io', p=new URLSearchParams(location.hash.slice(1));
 const nonce=p.get('nonce'),from=p.get('from'),to=p.get('to');
 const state=document.getElementById('state'),button=document.getElementById('send');
 const valid=/^[a-f0-9]{32}$/.test(nonce||'')&&/^\d{4}-\d{2}-\d{2}$/.test(from||'')&&/^\d{4}-\d{2}-\d{2}$/.test(to||'')&&Date.parse(to)>=Date.parse(from)&&Date.parse(to)-Date.parse(from)<=31*86400000;
 if(!window.opener||!valid){state.textContent='กรุณาเริ่มเชื่อมจาก Company Hub';return;}
 state.textContent=`ช่วงวันที่ ${from} ถึง ${to}`;button.disabled=false;
 button.onclick=async()=>{button.disabled=true;state.textContent='กำลังอ่านผลจริงตามสิทธิ์ Audit…';try{
  if(!await Sb.restore())throw Error('กรุณาเข้าสู่ Audit ก่อน แล้วกดเชื่อมอีกครั้ง');
  const result=await Sb.companyHubResults({from,to}),cases=result.rows,operations=result.jobs;
  const rows=cases.map(x=>({id:x.id,title:x.code||x.type_name||'เคสออดิท',company:x.company||'',date:x.business_date,status:x.status,ownerId:x.assigned_to||'',owner:x.assigned_to||'ยังไม่มอบหมาย',closed:['closed','approved'].includes(x.status),waiting:x.status==='clarifying'}));
  const runs=operations.filter(x=>!x.is_archived).map(x=>({id:x.id,company:x.company||'',date:x.business_date,status:x.status,matched:x.last_run_id?x.matched:null}));
  opener.postMessage({type:'company-hub-results',nonce,source:'audit',data:{version:1,from,to,fetchedAt:new Date().toISOString(),partial:result.partial,rows,runs}},origin);
  state.textContent='ส่งผลให้ Company Hub แล้ว ปิดหน้าต่างนี้ได้';
 }catch(e){state.textContent=e.message||'อ่านผลไม่สำเร็จ';}finally{button.disabled=false;}};
})();
