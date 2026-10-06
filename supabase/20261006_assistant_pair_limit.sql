-- Authorized assistant scope: same company, both principal amounts <=30000,
-- <=5 THB difference, verified original BO/STM; cross-company requires head.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function public.audit_assistant_pair_ready(p_bo uuid,p_stm uuid,p_mode text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.current_audit_assistant() and exists(
  select 1 from public.exceptions a join public.exceptions b on b.id=p_stm
  where a.id=p_bo and p_mode='same' and a.company=b.company
   and public.has_company_access(a.company) and public.has_company_access(b.company)
   and a.currency='THB' and b.currency='THB' and a.direction=b.direction
   and a.direction in('ฝาก','ถอน')
   and a.system_amount>0 and a.system_amount<=30000
   and b.bank_amount>0 and b.bank_amount<=30000
   and abs(a.system_amount-b.bank_amount)<=5
   and a.superseded_by_exception_id is null and b.superseded_by_exception_id is null
   and not exists(select 1 from public.damages d where d.exception_id in(a.id,b.id))
   and public.manual_pair_source_ready(a.id,'bo')
   and public.manual_pair_source_ready(b.id,'stm'));
$$;
revoke all on function public.audit_assistant_pair_ready(uuid,uuid,text) from public,anon,authenticated;
do $patch$
declare def text; needle text; replacement text; n integer;
begin
 def:=pg_get_functiondef('public.validate_manual_pair(uuid,uuid,text,uuid)'::regprocedure);
 needle:='public.current_app_role() in (''lead'',''admin'') and p_mode=''same'' and a.company=b.company';
 n:=(length(def)-length(replace(def,needle,'')))/length(needle);
 if n<>2 then raise exception 'Unexpected validate baseline'; end if;
 replacement:='(public.current_app_role() in (''lead'',''admin'') or public.audit_assistant_pair_ready(a.id,b.id,p_mode)) and p_mode=''same'' and a.company=b.company';
 execute replace(def,needle,replacement);

 def:=pg_get_functiondef('public.decide_manual_case_pair(uuid,text,text)'::regprocedure);
 needle:='public.current_app_role() in (''lead'',''admin'') and p.mode=''same'' and p.bo_company=p.stm_company';
 if strpos(def,needle)=0 then raise exception 'Unexpected self review baseline'; end if;
 def:=replace(def,needle,'('||needle||' or public.audit_assistant_pair_ready(a.id,b.id,p.mode))');
 needle:='if public.current_audit_assistant() and (p.difference is null or p.difference>5 or not (exists(select 1 from public.case_evidence f join storage.objects o on o.name=f.storage_path and o.bucket_id=''audit-files'' where f.exception_id in(a.id,b.id) and f.size_bytes>0) or exists(select 1 from public.source_files f join storage.objects o on o.name=f.storage_path and o.bucket_id=''audit-files'' where f.id in(a.clarification_file_id,b.clarification_file_id)))) then raise exception ''ผู้ช่วย AUDIT ต้องมีหลักฐานจริงและผลต่างไม่เกิน 5 บาท''; end if;';
 if strpos(def,needle)=0 then raise exception 'Unexpected assistant proof baseline'; end if;
 replacement:='if public.current_audit_assistant() and not public.audit_assistant_pair_ready(a.id,b.id,p.mode) then raise exception ''ผู้ช่วย AUDIT ปิดได้เฉพาะบริษัทเดียวกัน ยอดแต่ละฝั่งไม่เกิน 30,000 บาท ต่างไม่เกิน 5 บาท ไม่มีความเสียหาย และต้นทางครบ มิฉะนั้นส่งหัวหน้า'' using errcode=''42501''; end if;';
 execute replace(def,needle,replacement);
end $patch$;
create or replace function public.close_manual_case_pair(
 p_id uuid,p_bo uuid,p_stm uuid,p_mode text,p_reason text,p_evidence uuid default null)
returns public.manual_case_pairs language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.manual_case_pairs%rowtype;
begin
 if auth.uid() is null or not public.current_user_active() or p_mode is distinct from 'same'
  or (coalesce(public.current_app_role(),'') not in ('lead','admin')
      and not public.audit_assistant_pair_ready(p_bo,p_stm,p_mode))
 then raise exception 'ไม่มีสิทธิ์ปิดคู่นี้เอง ให้ส่งหัวหน้าอนุมัติ' using errcode='42501'; end if;
 p:=public.submit_manual_case_pair(p_id,p_bo,p_stm,p_mode,p_reason,p_evidence);
 p:=public.decide_manual_case_pair(p.id,'approve',null);
 if p.status<>'approved' or p.decided_by<>auth.uid() then raise exception 'ยังยืนยันการปิดคู่ไม่ได้'; end if;
 return p;
end $$;
revoke all on function public.close_manual_case_pair(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.close_manual_case_pair(uuid,uuid,uuid,text,text,uuid) to authenticated;
insert into public.audit_log(actor,action,entity,target,detail)
 values('authorized policy migration','update','approval_policy','audit_assistant',
 'Same-company BO/STM each <=30000 THB; difference <=5; verified original source; no damage. Cross-company and larger amounts require head. No cases closed by migration.');
notify pgrst,'reload schema';
commit;
