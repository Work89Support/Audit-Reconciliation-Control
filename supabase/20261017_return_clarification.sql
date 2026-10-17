-- Definitions only. Installation never returns, closes or changes a live case.
begin;
set local lock_timeout='5s';
create table if not exists public.case_clarification_returns(
 id uuid primary key, exception_id uuid not null references public.exceptions(id),
 company text not null, actor_user_id uuid not null references auth.users(id),
 reason text not null check(length(btrim(reason)) between 10 and 2000),
 previous_updated_at timestamptz, previous_responded_at timestamptz,
 previous_answer jsonb not null, created_at timestamptz not null default now()
);
alter table public.case_clarification_returns enable row level security;
revoke all on public.case_clarification_returns from public,anon,authenticated;
grant select on public.case_clarification_returns to authenticated;
drop policy if exists clarification_return_read on public.case_clarification_returns;
create policy clarification_return_read on public.case_clarification_returns for select to authenticated
 using(public.current_user_active() and public.current_app_role() in ('monitor','audit_assistant','lead','admin')
 and public.has_company_access(company));

create or replace function public.return_case_for_clarification(
 p_id uuid,p_case uuid,p_reason text,p_expected_updated_at timestamptz,p_expected_responded_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype; r public.case_clarification_returns%rowtype; reason text:=btrim(p_reason); current_source boolean;
begin
 if auth.uid() is null or not coalesce(public.current_user_active(),false)
 or coalesce(public.current_app_role(),'') not in ('monitor','audit_assistant','lead','admin')
 then raise exception 'ไม่มีสิทธิ์ตีกลับคำชี้แจง' using errcode='42501';end if;
 if p_id is null or reason is null or length(reason) not between 10 and 2000 then
 raise exception 'ระบุสิ่งที่ต้องชี้แจงเพิ่มเติม 10–2,000 ตัวอักษร';end if;
 select * into e from public.exceptions where id=p_case for update;
 if not found or not coalesce(public.has_company_access(e.company),false) then
 raise exception 'ไม่พบเคสในบริษัทที่มีสิทธิ์' using errcode='42501';end if;
 select * into r from public.case_clarification_returns where id=p_id;
 if found then
  if r.exception_id is distinct from p_case or r.actor_user_id is distinct from auth.uid()
   or r.reason is distinct from reason or r.previous_updated_at is distinct from p_expected_updated_at
   or r.previous_responded_at is distinct from p_expected_responded_at then raise exception 'รหัสคำขอซ้ำแต่รายละเอียดไม่ตรง';end if;
  return jsonb_build_object('id',e.id,'request_id',r.id,'status',e.status,'replayed',true);
 end if;
 if e.status is distinct from 'answered' or e.updated_at is distinct from p_expected_updated_at
 or e.responded_at is distinct from p_expected_responded_at then
 raise exception 'คำชี้แจงหรือสถานะเปลี่ยน กรุณาเปิดเคสล่าสุดก่อนตีกลับ';end if;
 if e.manual_pair_id is not null or e.case_closure_request_id is not null
 or e.cross_day_request_id is not null or e.cross_day_image_request_id is not null
 or to_jsonb(e)->>'governance_request_id' is not null
 or exists(select 1 from public.case_closure_requests q where q.exception_id=e.id and q.status='pending')
 or exists(select 1 from public.cross_day_pair_requests q where q.exception_id=e.id and q.status='pending')
 or exists(select 1 from public.cross_day_image_reviews q where q.exception_id=e.id and q.status='pending')
 then raise exception 'มีคำขออนุมัติหรือจับคู่ค้าง ต้องดำเนินการผ่านคำขอเดิม';end if;
 perform 1 from public.daily_recon_jobs j where j.company=e.company and j.business_date=e.business_date and not j.is_archived for share;
 if e.customer_details->>'manual_primary_id' is not null then current_source:=coalesce(public.cross_day_current_manual_case(e),false);
 else current_source:=coalesce(public.primary_case_is_current(e.id),false);end if;
 if not current_source or e.superseded_by_exception_id is not null then
 raise exception 'ผลหลักเปลี่ยน ต้องเปิดเคสปัจจุบัน ไม่ตีกลับเคสประวัติ';end if;
 if public.account_review_hold_for_case(e.id) is not null then raise exception 'เคสอยู่ในทะเบียนพักตรวจ ต้องทบทวนผ่านงานพักตรวจเดิม';end if;
 insert into public.case_clarification_returns(id,exception_id,company,actor_user_id,reason,previous_updated_at,previous_responded_at,previous_answer)
 values(p_id,e.id,e.company,auth.uid(),reason,e.updated_at,e.responded_at,
 jsonb_build_object('response_text',e.response_text,'responded_at',e.responded_at,'responded_by',e.responded_by,
 'clarification_file_id',e.clarification_file_id,'requested_at',e.requested_at,'document_due_at',e.document_due_at));
 -- Existing company-visible instruction history, in the SAME transaction.
 perform public.append_clarification_instruction(e.id,reason);
 update public.exceptions set status='clarifying',updated_at=now() where id=e.id returning * into e;
 insert into public.audit_log(actor,actor_user_id,company,action,entity,target,detail,meta)
 values(auth.uid()::text,auth.uid(),e.company,'clarification_returned','exception',e.id::text,reason,
 jsonb_build_object('request_id',p_id,'previous_status','answered','status','clarifying','preserved_answer',true,'preserved_evidence',true));
 return jsonb_build_object('id',e.id,'request_id',p_id,'status',e.status,'replayed',false);
end $$;
revoke all on function public.return_case_for_clarification(uuid,uuid,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.return_case_for_clarification(uuid,uuid,text,timestamptz,timestamptz) to authenticated;

-- A return receipt can only be inserted by the guarded RPC. Permit that precise
-- answered -> clarifying transition without resetting the original request/SLA.
do $patch$
declare definition text; anchor text:='declare days integer;'||chr(10)||'begin';
begin
 definition:=pg_get_functiondef('public.set_document_case_deadline()'::regprocedure);
 if position('clarification_return_receipt_v1' in definition)>0 then return;end if;
 if position(anchor in definition)=0 then raise exception 'Deadline function drift: stop installation';end if;
 execute replace(definition,anchor,anchor||'
 /* clarification_return_receipt_v1 */
 if old.status=''answered'' and new.status=''clarifying'' and exists(
 select 1 from public.case_clarification_returns r where r.exception_id=old.id
 and r.actor_user_id=auth.uid() and r.created_at=transaction_timestamp()
 and r.previous_updated_at is not distinct from old.updated_at
 and r.previous_responded_at is not distinct from old.responded_at) then
  new.requested_at:=old.requested_at;new.requested_by:=old.requested_by;
  new.document_due_at:=old.document_due_at;return new;
 end if;');
end $patch$;
notify pgrst,'reload schema';
commit;

