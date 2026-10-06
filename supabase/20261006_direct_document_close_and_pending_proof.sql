-- Head document review closes atomically. Audit still submits for head review.
-- Append-only proof recovery for reserved pairs; no historical case is closed here.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.case_closure_requests add column review_origin text not null default 'audit_submission'
 check(review_origin in ('audit_submission','head_direct'));

do $patch$
declare def text; needle text;
begin
 def:=pg_get_functiondef('public.decide_case_closure(uuid,text,text)'::regprocedure);
 needle:='if (q.requested_by=auth.uid() or public.current_audit_assistant()) and (';
 if strpos(def,needle)=0 then raise exception 'Unrecognized document closure self-review baseline'; end if;
 execute replace(def,needle,'if ((q.requested_by=auth.uid() and not (q.review_origin=''head_direct'' and public.current_app_role() in (''lead'',''admin''))) or public.current_audit_assistant()) and (');
end $patch$;

create function public.close_document_case(p_id uuid,p_case uuid,p_outcome text,p_amount numeric,p_reason text,p_category text default null)
 returns public.case_closure_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.case_closure_requests%rowtype; e public.exceptions%rowtype;
begin
 if auth.uid() is null or not public.current_user_active()
 or (coalesce(public.current_app_role(),'') not in ('lead','admin') and not public.current_audit_assistant())
 then raise exception 'เฉพาะหัวหน้า / ผู้มีสิทธิ์ปิดเคสเท่านั้น' using errcode='42501'; end if;
 select * into e from public.exceptions where id=p_case for update;
 if not found or not public.has_company_access(e.company) then raise exception 'ไม่พบเคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;
 select * into q from public.case_closure_requests where id=p_id for update;
 if found then
  if q.requested_by<>auth.uid() or q.review_origin<>'head_direct' or q.exception_id<>p_case
  or q.outcome is distinct from p_outcome or q.loss_amount is distinct from p_amount
  or q.audit_reason is distinct from btrim(p_reason) or q.damage_category is distinct from p_category
  then raise exception 'รหัสคำขอปิดถูกใช้แล้วหรือไม่ตรงต้นทาง'; end if;
  return public.decide_case_closure(q.id,'approve',null);
 end if;
 -- All evidence, SLA, currency, source, amount and damage attribution checks stay intact.
 q:=public.submit_case_closure(p_id,p_case,p_outcome,p_amount,p_reason,p_category);
 update public.case_closure_requests set review_origin='head_direct' where id=q.id and requested_by=auth.uid();
 q:=public.decide_case_closure(q.id,'approve',null);
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(auth.uid()::text,auth.uid(),'case_closure_direct_close','case_closure_request',q.id::text,
 'ตรวจและปิดโดยผู้มีสิทธิ์ในธุรกรรมเดียว / '||q.outcome||' / เสียหายจริง '||q.loss_amount);
 return q;
end $$;
revoke all on function public.close_document_case(uuid,uuid,text,numeric,text,text) from public,anon;
grant execute on function public.close_document_case(uuid,uuid,text,numeric,text,text) to authenticated;

create function public.can_attach_pending_pair_evidence(p_case uuid) returns boolean
 language sql stable security definer set search_path=public,pg_temp as $$
 select public.current_user_active() and public.current_app_role() in ('monitor','lead','admin')
 and exists(select 1 from public.exceptions e join public.manual_case_pairs p on p.id=e.manual_pair_id
 where e.id=p_case and e.status='pair_pending' and p.status='pending' and e.id in(p.bo_case_id,p.stm_case_id)
 and public.has_company_access(p.bo_company) and public.has_company_access(p.stm_company)
 and (p.submitted_by=auth.uid() or public.current_app_role() in ('lead','admin') or public.current_audit_assistant()))
$$;
revoke all on function public.can_attach_pending_pair_evidence(uuid) from public,anon;
grant execute on function public.can_attach_pending_pair_evidence(uuid) to authenticated;

create policy pending_pair_evidence_insert on public.case_evidence for insert to authenticated
with check(uploaded_by=auth.uid() and public.can_attach_pending_pair_evidence(exception_id)
 and storage_path='case-evidence/'||exception_id::text||'/'||auth.uid()::text||'/'||id::text
 and exists(select 1 from storage.objects o where o.bucket_id='audit-files' and o.name=storage_path and o.owner_id=auth.uid()::text));
create policy pending_pair_evidence_object_insert on storage.objects for insert to authenticated
with check(bucket_id='audit-files' and split_part(name,'/',1)='case-evidence'
 and split_part(name,'/',3)=auth.uid()::text and array_length(string_to_array(name,'/'),1)=4
 and exists(select 1 from public.exceptions e where e.id::text=split_part(name,'/',2)
 and public.can_attach_pending_pair_evidence(e.id)));
notify pgrst,'reload schema';
commit;
