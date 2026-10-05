-- User-approved assistant role: Audit baseline plus evidence-backed <=5 THB closure.
-- Preserves company access, history and source/snapshot checks. No case is closed here.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.app_profiles drop constraint app_profiles_role_check;
alter table public.app_profiles add constraint app_profiles_role_check
 check(role in ('monitor','audit_assistant','lead','shift_lead','exec','admin'));

-- Existing RLS sees Audit, NOT Lead: no all-company, settings or damage powers.
create or replace function public.current_app_role() returns text
 language sql stable security definer set search_path=public as $$
 select case when role='audit_assistant' then 'monitor' else role end
 from public.app_profiles where user_id=auth.uid() and active limit 1
$$;
create or replace function public.current_audit_assistant() returns boolean
 language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.app_profiles where user_id=auth.uid() and active and role='audit_assistant')
$$;
revoke all on function public.current_audit_assistant() from public,anon;
grant execute on function public.current_audit_assistant() to authenticated;

alter table public.manual_case_pairs add column self_approval_role text;
alter table public.manual_case_pairs drop constraint manual_pair_self_review_shape;
alter table public.manual_case_pairs add constraint manual_pair_self_review_shape
 check((not self_approved and (decided_by is null or decided_by<>submitted_by))
 or (self_approved and decided_by=submitted_by and status='approved' and difference<=5
 and ((mode='same' and bo_company=stm_company) or self_approval_role='audit_assistant')));

-- Patch exact live definitions; abort atomically if the reviewed baseline differs.
do $patch$
declare def text; needle text;
begin
 def:=pg_get_functiondef('public.admin_upsert_user_access(text,text,text,boolean,text[])'::regprocedure);
 needle:='p_role not in (''monitor'',''lead'',''shift_lead'',''exec'',''admin'')';
 if strpos(def,needle)=0 then raise exception 'Unrecognized admin role validator'; end if;
 execute replace(def,needle,'p_role not in (''monitor'',''audit_assistant'',''lead'',''shift_lead'',''exec'',''admin'')');

 def:=pg_get_functiondef('public.decide_manual_case_pair(uuid,text,text)'::regprocedure);
 needle:='coalesce(public.current_app_role(),'''') not in (''lead'',''admin'')';
 if strpos(def,needle)=0 then raise exception 'Unrecognized pair permission guard'; end if;
 def:=replace(def,needle,'(coalesce(public.current_app_role(),'''') not in (''lead'',''admin'') and not public.current_audit_assistant())');
 needle:='if p_action<>''approve'' or p.mode<>''same'' or p.bo_company<>p.stm_company or p.difference>5';
 if strpos(def,needle)=0 then raise exception 'Unrecognized pair self-review guard'; end if;
 def:=replace(def,needle,'if p_action<>''approve'' or (not public.current_audit_assistant() and (p.mode<>''same'' or p.bo_company<>p.stm_company)) or p.difference>5');
 needle:='if p_action=''approve'' then'||chr(10)||'   proof:=';
 if strpos(def,needle)=0 then raise exception 'Unrecognized pair validation'; end if;
 def:=replace(def,needle,'if p_action=''approve'' then'||chr(10)||'   if public.current_audit_assistant() and (p.difference is null or p.difference>5 or not ('||
 'exists(select 1 from public.case_evidence f join storage.objects o on o.name=f.storage_path and o.bucket_id=''audit-files'' where f.exception_id in(a.id,b.id) and f.size_bytes>0)'||
 ' or exists(select 1 from public.source_files f join storage.objects o on o.name=f.storage_path and o.bucket_id=''audit-files'' where f.id in(a.clarification_file_id,b.clarification_file_id)))) then raise exception ''ผู้ช่วย AUDIT ต้องมีหลักฐานจริงและผลต่างไม่เกิน 5 บาท''; end if;'||chr(10)||'   proof:=');
 needle:='self_approved=(p.submitted_by=auth.uid())';
 if strpos(def,needle)=0 then raise exception 'Unrecognized pair audit fields'; end if;
 def:=replace(def,needle,needle||',self_approval_role=(select role from public.app_profiles where user_id=auth.uid())');
 execute def;

 def:=pg_get_functiondef('public.decide_case_closure(uuid,text,text)'::regprocedure);
 needle:='public.current_app_role() not in (''lead'',''admin'')';
 if strpos(def,needle)=0 then raise exception 'Unrecognized closure permission guard'; end if;
 def:=replace(def,needle,'(public.current_app_role() not in (''lead'',''admin'') and not public.current_audit_assistant())');
 needle:='if q.requested_by=auth.uid() and (';
 if strpos(def,needle)=0 then raise exception 'Unrecognized closure self-review guard'; end if;
 def:=replace(def,needle,'if (q.requested_by=auth.uid() or public.current_audit_assistant()) and (');
 execute def;
end $patch$;

do $assign$
declare changed integer;
begin
 update public.app_profiles set role='audit_assistant',updated_at=now()
 where user_id='292f1df9-4bcb-4115-b390-5bbc89e748fd' and lower(email)='audit123g@gmail.com' and active and role='monitor';
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Assistant account baseline changed'; end if;
 if not exists(select 1 from public.app_profiles where user_id='b31a4d98-1864-41cb-8831-eb99889b2339' and lower(email)='auditxm168@gmail.com' and active and role='monitor')
 then raise exception 'Basic Audit account baseline changed'; end if;
 insert into public.audit_log(actor,action,entity,target,detail)
 values('authorized role migration','update','user_access','audit123g@gmail.com','monitor -> audit_assistant; stored proof, <=5 THB, self cross-company approval; existing company access preserved');
end $assign$;
notify pgrst,'reload schema';
commit;
