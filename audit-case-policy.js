/* Pure policy for newly generated worker results. Never reclassifies reviewed DB cases. */
const AuditCasePolicy = (() => {
  const version='source-proven-case-routing-v1';
  function apply(payload, screen, now=new Date().toISOString()) {
    const result=structuredClone(payload);
    const job=result.job, run=result.result, rows=result.exceptions;
    const summary=run?.summary;
    if(!job || !run || !Array.isArray(rows) || !Array.isArray(result.quality_errors)
      || result.quality_errors.length || !Array.isArray(job.missing_groups) || job.missing_groups.length
      || summary?.bo_first?.complete!==true || !Array.isArray(summary.bo_first.missing)
      || summary.bo_first.missing.length || summary.rules_only
      || !Array.isArray(summary.match_evidence) || summary.match_evidence.length!==run.matched
      || !Array.isArray(run.file_ids) || !run.file_ids.length) return result;
    const fresh=rows.map((e,i)=>({...e,id:'policy-'+i,run_id:'new-worker-result'}));
    const eligible=screen({complete:true,run:{id:'new-worker-result',jobStatus:'completed',matched:run.matched,summary},cases:fresh});
    const decisions=[];
    rows.forEach((e,i)=>{
      if(e.company!==job.company || e.business_date!==job.business_date || e.status!=='open'
        || e.clarification_file_id || e.response_text || e.resolution_note || e.resolved_at
        || e.requested_at || e.approved_at) return;
      if(eligible.has(fresh[i].id)){
        Object.assign(e,{status:'closed',auto_closed:true,resolved_at:now,resolved_by:'system:'+version,
          resolution_note:`${version}: อ้างอิง BO/PM ตรง ยอดจ่ายจริงตรง วันเดียวกันภายใน 60 นาที ไม่พบการใช้รายการซ้ำ; BO: ${e.bo_raw}; PM: ${e.stm_raw}`});
        decisions.push({code:e.code,action:'closed',reason:'unique-source-reference-time-only'});
      } else if(['missing_bo','missing_stm'].includes(e.ex_type)) {
        const source=String((e.ex_type==='missing_bo'?e.stm_raw:e.bo_raw)??'').trim();
        if(!['ฝาก','ถอน'].includes(e.direction)||!e.account||source.length<2||/^[—–-]|ไม่พบรายการ|ไม่ต้องใช้\s*statement|ตรวจจากรายงานหลังบ้าน/i.test(source))return;
        // No same-identity/amount counterpart among exceptions: ambiguous pairs stay for Audit.
        const opposite=e.ex_type==='missing_bo'?'missing_stm':'missing_bo';
        const amount=e.ex_type==='missing_bo'?e.bank_amount:e.system_amount;
        if(!(Number(amount)>0))return;
        if(rows.some(other=>other!==e && other.direction===e.direction && other.account===e.account
          && other.ex_type===opposite && Number(other.ex_type==='missing_bo'?other.bank_amount:other.system_amount)===Number(amount)))return;
        Object.assign(e,{status:'clarifying',requested_at:now,requested_by:null});
        decisions.push({code:e.code,action:'clarifying',reason:'complete-files-unmatched',actor:'system:'+version});
      }
    });
    summary.case_routing={version,at:now,decisions,closed:decisions.filter(d=>d.action==='closed').length,clarifying:decisions.filter(d=>d.action==='clarifying').length};
    return result;
  }
  return {apply,version};
})();
if(typeof module!=='undefined')module.exports=AuditCasePolicy;
