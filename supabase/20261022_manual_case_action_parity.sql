-- Give accepted manual-primary cases the same guarded case actions as current
-- automatic cases. Definitions only: installation changes no case, amount,
-- result, hold, run, evidence or history row.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.audit_case_action_ready(p_case uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.exceptions e where e.id=p_case
  and public.current_user_active() and public.has_company_access(e.company)
  and public.primary_case_is_current(e.id)
  and e.superseded_by_exception_id is null)
$$;
revoke all on function public.audit_case_action_ready(uuid) from public,anon,authenticated;

-- A manual-primary case can have an attachment before its first request. Keep
-- the existing automatic-case rule and the original request/SLA behaviour.
do $patch$
declare definition text; old_gate text; new_gate text;
begin
 definition:=pg_get_functiondef('public.set_document_case_deadline()'::regprocedure);
 if position('manual_primary_first_request_v1' in definition)>0 then return;end if;
 old_gate:='if public.case_has_stored_document(old.id) and not (old.status=''pending_next_day'' and old.requested_at is null and old.responded_at is null) /* waiting_cross_day_first_request_v1 */ then';
 new_gate:='if public.case_has_stored_document(old.id)
  and old.customer_details->>''manual_primary_id'' is null /* manual_primary_first_request_v1 */
  and not (old.status=''pending_next_day'' and old.requested_at is null and old.responded_at is null) /* waiting_cross_day_first_request_v1 */ then';
 if position(old_gate in definition)=0 then raise exception 'Unexpected clarification deadline definition; stop';end if;
 execute replace(definition,old_gate,new_gate);
end $patch$;

create or replace function public.request_current_case_clarification(
 p_case uuid,p_previous_status text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype;
begin
 if p_previous_status='pending_next_day' then
  return public.request_waiting_cross_day_clarification(p_case);
 end if;
 if auth.uid() is null or not coalesce(public.current_user_active(),false)
 or coalesce(public.current_app_role(),'') not in ('monitor','audit_assistant','lead','admin') then
  raise exception 'ไม่มีสิทธิ์ส่งขอชี้แจง' using errcode='42501';end if;
 select * into e from public.exceptions where id=p_case for update;
 if not found or not coalesce(public.has_company_access(e.company),false) then
  raise exception 'ไม่พบเคสในบริษัทที่มีสิทธิ์' using errcode='42501';end if;
 perform 1 from public.daily_recon_jobs j where j.company=e.company and j.business_date=e.business_date and not j.is_archived for share;
 if not public.audit_case_action_ready(e.id) then raise exception 'ผลหลักเปลี่ยน ต้องเปิดเคสปัจจุบัน';end if;
 if e.status is distinct from p_previous_status or e.status is distinct from 'open' then
  raise exception 'สถานะเปลี่ยนแล้ว หากมีคำตอบแล้วให้ใช้ปุ่มตีกลับเพื่อเก็บประวัติเดิม';end if;
 if e.manual_pair_id is not null or e.case_closure_request_id is not null
 or e.cross_day_request_id is not null or e.cross_day_image_request_id is not null
 or exists(select 1 from public.case_closure_requests q where q.exception_id=e.id and q.status='pending')
 or exists(select 1 from public.cross_day_pair_requests q where q.exception_id=e.id and q.status='pending')
 or exists(select 1 from public.cross_day_image_reviews q where q.exception_id=e.id and q.status='pending')
 then raise exception 'มีคำขออนุมัติหรือจับคู่ค้าง ต้องดำเนินการผ่านคำขอเดิม';end if;
 if public.account_review_hold_for_case(e.id) is not null then
  raise exception 'เคสอยู่ในทะเบียนพักตรวจ ต้องทบทวนผ่านงานพักตรวจเดิม';end if;
 update public.exceptions set status='clarifying',requested_at=now(),requested_by=auth.uid(),updated_at=now()
 where id=e.id and status=p_previous_status returning * into e;
 if not found then raise exception 'สถานะเปลี่ยนแล้ว กรุณาเปิดเคสล่าสุด';end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,company,detail,meta)
 values(auth.uid()::text,auth.uid(),'request_clarify','exception',e.id::text,e.company,
 'ส่งขอชี้แจงจากเคสผลหลักปัจจุบัน',jsonb_build_object('previous_status',p_previous_status,'status',e.status,'manual_primary_id',e.customer_details->>'manual_primary_id'));
 return to_jsonb(e);
end $$;
revoke all on function public.request_current_case_clarification(uuid,text) from public,anon;
grant execute on function public.request_current_case_clarification(uuid,text) to authenticated;

create or replace function public.close_current_audit_case(
 p_case uuid,p_previous_status text,p_resolution_note text,p_resolved_by text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype; reason text:=btrim(p_resolution_note); stored boolean; source_ready boolean;
begin
 if auth.uid() is null or not coalesce(public.current_user_active(),false)
 or (coalesce(public.current_app_role(),'') not in ('lead','admin') and not public.current_audit_assistant()) then
  raise exception 'ไม่มีสิทธิ์ยืนยันปิดเคส' using errcode='42501';end if;
 if reason is null or length(reason) not between 10 and 2000 then raise exception 'ระบุเหตุผลปิดเคส 10–2,000 ตัวอักษร';end if;
 select * into e from public.exceptions where id=p_case for update;
 if not found or not coalesce(public.has_company_access(e.company),false) then
  raise exception 'ไม่พบเคสในบริษัทที่มีสิทธิ์' using errcode='42501';end if;
 perform 1 from public.daily_recon_jobs j where j.company=e.company and j.business_date=e.business_date and not j.is_archived for share;
 if not public.audit_case_action_ready(e.id) then raise exception 'ผลหลักเปลี่ยน ต้องเปิดเคสปัจจุบัน';end if;
 if e.status is distinct from p_previous_status or e.status not in ('open','clarifying','answered') then
  raise exception 'สถานะเคสเปลี่ยน กรุณาเปิดเคสล่าสุด';end if;
 if e.manual_pair_id is not null or e.case_closure_request_id is not null
 or e.cross_day_request_id is not null or e.cross_day_image_request_id is not null
 or exists(select 1 from public.case_closure_requests q where q.exception_id=e.id and q.status='pending')
 or exists(select 1 from public.cross_day_pair_requests q where q.exception_id=e.id and q.status='pending')
 or exists(select 1 from public.cross_day_image_reviews q where q.exception_id=e.id and q.status='pending')
 then raise exception 'มีคำขออนุมัติหรือจับคู่ค้าง ต้องดำเนินการผ่านคำขอเดิม';end if;
 if public.account_review_hold_for_case(e.id) is not null then
  raise exception 'เคสอยู่ในทะเบียนพักตรวจ ห้ามปิดจากทางลัด';end if;
 stored:=public.case_has_stored_document(e.id);
 source_ready:=coalesce(public.manual_pair_scoped_source_ready(e.id,'BO'),false)
  and coalesce(public.manual_pair_scoped_source_ready(e.id,'STM'),false);
 if not stored and not source_ready then raise exception 'ต้องมีหลักฐานจริงในคลัง หรือแถว BO/STM ต้นทางที่ตรวจสอบได้ครบ';end if;
 update public.exceptions set status='closed',resolution_note=reason,resolved_at=now(),resolved_by=coalesce(nullif(btrim(p_resolved_by),''),auth.uid()::text),
 approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=e.id and status=p_previous_status returning * into e;
 if not found then raise exception 'สถานะเปลี่ยนแล้ว กรุณาเปิดเคสล่าสุด';end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,company,detail,meta)
 values(auth.uid()::text,auth.uid(),'case_closed','exception',e.id::text,e.company,reason,
 jsonb_build_object('previous_status',p_previous_status,'status',e.status,'stored_document',stored,'source_rows_ready',source_ready,'manual_primary_id',e.customer_details->>'manual_primary_id'));
 return to_jsonb(e);
end $$;
revoke all on function public.close_current_audit_case(uuid,text,text,text) from public,anon;
grant execute on function public.close_current_audit_case(uuid,text,text,text) to authenticated;

-- Existing recommendation links used a system-run-only equality. Current
-- accepted manual cases must be resolved by the same primary registry instead.
do $patch$
declare definition text; old_gate text; new_gate text;
begin
 definition:=pg_get_functiondef('public.link_recommended_case_evidence(uuid,uuid,text)'::regprocedure);
 if position('audit_case_action_ready(e.id)' in definition)>0 then return;end if;
 old_gate:='if not exists(select 1 from public.daily_recon_jobs j where j.last_run_id=e.run_id
    and j.company=e.company and j.business_date=e.business_date and not j.is_archived) then
    raise exception ''ไม่ใช่ผลรอบปัจจุบัน'';
  end if;';
 if position(old_gate in definition)=0 then
  old_gate:='if not exists(select 1 from public.daily_recon_jobs j where j.last_run_id=e.run_id and j.company=e.company and j.business_date=e.business_date and not j.is_archived) then raise exception ''ไม่ใช่ผลรอบปัจจุบัน''; end if;';
 end if;
 new_gate:='if not public.audit_case_action_ready(e.id) then
    raise exception ''ไม่ใช่ผลหลักปัจจุบัน'';
  end if;';
 if position(old_gate in definition)=0 then raise exception 'Unexpected recommended evidence guard; stop';end if;
 execute replace(definition,old_gate,new_gate);
end $patch$;

notify pgrst,'reload schema';
commit;
