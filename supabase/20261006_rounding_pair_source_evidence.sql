-- Approved: source BO/STM is sufficient for head/admin own same-company pairs <= 5 THB.
-- Assistant/cross-company proof, validate_manual_pair, snapshots, audit and reservations unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $patch$
declare def text; needle text; replacement text;
begin
 def:=pg_get_functiondef('public.decide_manual_case_pair(uuid,text,text)'::regprocedure);
 needle:=$old$ if p.submitted_by=auth.uid() then
   if p_action<>'approve' or (not public.current_audit_assistant() and (p.mode<>'same' or p.bo_company<>p.stm_company)) or p.difference>5
     or not (
       exists(select 1 from public.case_evidence f join storage.objects o on o.name=f.storage_path and o.bucket_id='audit-files'
         where (f.id=p.evidence_id or p.evidence_id is null) and f.exception_id in(a.id,b.id) and f.size_bytes>0)
       or exists(select 1 from public.source_files f join storage.objects o on o.name=f.storage_path and o.bucket_id='audit-files'
         where f.id in(a.clarification_file_id,b.clarification_file_id))
     ) then raise exception 'คำขอตัวเองต้องเป็นบริษัทเดียวกัน ไม่เกิน 5 บาท และมีหลักฐานในคลังจริง'; end if;
 end if;$old$;
 replacement:=$new$ if p.submitted_by=auth.uid() then
   if p_action<>'approve' or (not public.current_audit_assistant() and (p.mode<>'same' or p.bo_company<>p.stm_company))
     or p.difference is null or p.difference<0 or p.difference>5
     or (not (public.current_app_role() in ('lead','admin') and p.mode='same' and p.bo_company=p.stm_company) and not (
       exists(select 1 from public.case_evidence f join storage.objects o on o.name=f.storage_path and o.bucket_id='audit-files'
         where (f.id=p.evidence_id or p.evidence_id is null) and f.exception_id in(a.id,b.id) and f.size_bytes>0)
       or exists(select 1 from public.source_files f join storage.objects o on o.name=f.storage_path and o.bucket_id='audit-files'
         where f.id in(a.clarification_file_id,b.clarification_file_id))
     )) then raise exception 'คำขอตัวเองต้องเป็นบริษัทเดียวกัน ไม่เกิน 5 บาท มี BO/STM ต้นทางจริง หรือหลักฐานตามสิทธิ์'; end if;
 end if;$new$;
 if strpos(def,needle)=0 then raise exception 'Unrecognized own-pair approval baseline; no changes applied'; end if;
 if strpos(def,'proof:=public.validate_manual_pair(a.id,b.id,p.mode,p.evidence_id)')=0
 or strpos(def,'ต้นทางหรือยอดเปลี่ยนหลังส่งคำขอ')=0
 or strpos(def,'manual_pair_self_approve')=0 then raise exception 'Required source/snapshot/audit checks missing'; end if;
 execute replace(def,needle,replacement);
end $patch$;
notify pgrst,'reload schema';
commit;
