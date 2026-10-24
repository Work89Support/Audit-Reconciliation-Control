-- Add a distinct, evidence-backed result for operational mistakes that caused
-- no financial loss. Existing loss amounts, closures and collection records
-- are not rewritten by installation.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.case_closure_requests
  drop constraint if exists case_closure_requests_outcome_check;
alter table public.case_closure_requests
  drop constraint if exists case_closure_requests_check;
alter table public.case_closure_requests
  add constraint case_closure_requests_outcome_check
    check(outcome in ('no_loss','process_error','damage')),
  add constraint case_closure_requests_outcome_amount_check
    check(
      (outcome in ('no_loss','process_error') and loss_amount=0 and damage_category is null)
      or (outcome='damage' and loss_amount>0 and damage_category is not null)
    );
alter table public.case_closure_requests
  add column if not exists responsible_employee text,
  add column if not exists responsible_shift text;

alter table public.case_closure_requests
  drop constraint if exists case_closure_process_responsibility_check;
alter table public.case_closure_requests
  add constraint case_closure_process_responsibility_check check(
    outcome<>'process_error' or (
      length(btrim(responsible_employee)) between 1 and 200
      and responsible_shift in ('day','night')
    )
  );

create or replace function public.submit_process_error_case(
  p_id uuid,p_case uuid,p_reason text,p_employee text,p_shift text
) returns public.case_closure_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype; q public.case_closure_requests%rowtype; has_document boolean;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in ('monitor','lead','admin')
 then raise exception 'เฉพาะ Audit ส่งผลตรวจให้หัวหน้าได้' using errcode='42501'; end if;
 select * into e from public.exceptions where id=p_case for update;
 if not found or not public.has_company_access(e.company)
 then raise exception 'ไม่พบเคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,9));
 select * into q from public.case_closure_requests where id=p_id;
 if found then
  if q.requested_by=auth.uid() and q.exception_id=p_case and q.outcome='process_error' and q.loss_amount=0
    and q.audit_reason=btrim(p_reason) and q.responsible_employee=btrim(p_employee) and q.responsible_shift=p_shift
  then return q; end if;
  raise exception 'รหัสคำขอถูกใช้แล้ว';
 end if;
 if e.status is null or e.status not in ('open','clarifying','answered') or e.manual_pair_id is not null
   or e.case_closure_request_id is not null or e.superseded_by_exception_id is not null
 then raise exception 'สถานะเคสเปลี่ยนหรือมีคำขออยู่แล้ว'; end if;
 if p_id is null or coalesce(length(btrim(p_reason)),0) not between 10 and 2000
   or coalesce(btrim(p_employee),'') in ('','-','ไม่ระบุ','รอยืนยันผู้เกี่ยวข้อง')
   or length(btrim(p_employee))>200 or coalesce(p_shift,'') not in ('day','night')
 then raise exception 'ต้องระบุเหตุการณ์ ผู้เกี่ยวข้อง และกะจากหลักฐานให้ครบ'; end if;
 has_document:=public.case_has_stored_document(e.id);
 if not has_document then raise exception 'บันทึกข้อสังเกตต้องมีเอกสารที่ผูกเคสอยู่ในคลังจริง'; end if;
 insert into public.case_closure_requests(
   id,exception_id,company,business_date,outcome,loss_amount,audit_reason,damage_category,
   responsible_employee,responsible_shift,snapshot,requested_by
 ) values(
   p_id,e.id,e.company,e.business_date,'process_error',0,btrim(p_reason),null,
   btrim(p_employee),p_shift,to_jsonb(e)||jsonb_build_object('stored_document_at_submit',true),auth.uid()
 ) returning * into q;
 update public.exceptions set case_closure_request_id=q.id,status='answered',updated_at=now() where id=e.id;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(auth.uid()::text,auth.uid(),'process_error_submit','case_closure_request',q.id::text,
   format('ไม่มีความเสียหาย 0 บาท / %s / %s / %s',q.responsible_employee,q.responsible_shift,q.audit_reason));
 return q;
end $$;

create or replace function public.decide_process_error_case(
  p_id uuid,p_action text,p_note text default null
) returns public.case_closure_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.case_closure_requests%rowtype; e public.exceptions%rowtype; note text; has_document boolean;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in ('lead','admin')
 then raise exception 'เฉพาะหัวหน้า Audit อนุมัติปิดเคสได้' using errcode='42501'; end if;
 select * into q from public.case_closure_requests where id=p_id;
 if not found or q.outcome<>'process_error' or not public.has_company_access(q.company)
 then raise exception 'ไม่พบคำขอข้อสังเกตหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;
 select * into e from public.exceptions where id=q.exception_id for update;
 select * into q from public.case_closure_requests where id=p_id for update;
 note:=coalesce(nullif(btrim(p_note),''),'หัวหน้าตรวจผล Audit และหลักฐาน อนุมัติปิดเคส');
 if p_action is null or p_action not in ('approve','reject') or length(note)>2000
   or (p_action='reject' and coalesce(length(btrim(p_note)),0)<10)
 then raise exception 'เหตุผลอนุมัติไม่บังคับ แต่ส่งกลับต้องระบุอย่างน้อย 10 ตัวอักษร'; end if;
 if q.status<>'pending' then
  if q.decided_by=auth.uid() and q.decision_note=note
    and q.status=(case when p_action='approve' then 'approved' else 'rejected' end) then return q; end if;
  raise exception 'คำขอไม่ได้รออนุมัติ';
 end if;
 if q.requested_by=auth.uid() and q.review_origin<>'head_direct'
 then raise exception 'คำขอของตนเองต้องให้หัวหน้าอีกบัญชีตรวจ'; end if;
 if e.status<>'answered' or e.case_closure_request_id is distinct from q.id or e.manual_pair_id is not null
   or e.superseded_by_exception_id is not null then raise exception 'สถานะเคสเปลี่ยน ต้องตรวจใหม่'; end if;
 if exists(select 1 from unnest(array['run_id','company','business_date','direction','account','currency','system_amount','bank_amount','bo_raw','stm_raw','clarification_file_id','document_due_at']) k
   where to_jsonb(e)->k is distinct from q.snapshot->k) then raise exception 'ต้นทางเปลี่ยนหลังส่งคำขอ ต้องตรวจใหม่'; end if;
 has_document:=public.case_has_stored_document(e.id);
 if p_action='approve' and not has_document then raise exception 'หลักฐานไม่อยู่ในคลังแล้ว'; end if;
 if p_action='approve' and exists(select 1 from public.damages where exception_id=e.id and voided_at is null)
 then raise exception 'มีรายการในทะเบียนเดิม ต้องตรวจแทนการบันทึกซ้ำ'; end if;
 update public.case_closure_requests set status=case when p_action='approve' then 'approved' else 'rejected' end,
   decided_by=auth.uid(),decided_at=now(),decision_note=note where id=q.id returning * into q;
 if p_action='approve' then
  insert into public.damages(
    code,exception_id,business_date,company,employee,shift,occurred_at,amount,currency,fx_rate,
    amount_thb,cause,cycle,has_evidence,hr_status,finance_status
  ) values(
    'OBS-'||e.id,e.id,e.business_date,e.company,q.responsible_employee,q.responsible_shift,e.occurred_at::time,
    0,'THB',1,0,'[damage:v2:employee] [process_error:v1] '||q.audit_reason,
    case when extract(day from e.business_date)<=15 then 'C1' when extract(day from e.business_date)<=25 then 'C2' else 'C3' end,
    true,'บันทึกข้อสังเกต','ไม่ต้องเรียกเก็บ'
  );
  update public.exceptions set status='closed',employee=q.responsible_employee,shift=q.responsible_shift,
    auto_closed=false,approved_by=auth.uid(),approved_at=now(),resolved_by=auth.uid()::text,resolved_at=now(),
    resolution_note='หัวหน้าอนุมัติ: ทำงานผิดพลาด แต่ไม่เกิดความเสียหาย 0 บาท / '||q.audit_reason||' / '||note,
    updated_at=now() where id=e.id;
 else
  update public.exceptions set status=q.snapshot->>'status',case_closure_request_id=null,updated_at=now() where id=e.id;
 end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(auth.uid()::text,auth.uid(),'process_error_'||p_action,'case_closure_request',q.id::text,
   format('ไม่มีความเสียหาย 0 บาท / %s / %s / %s',q.responsible_employee,q.responsible_shift,note));
 return q;
end $$;

create or replace function public.close_process_error_case(
  p_id uuid,p_case uuid,p_reason text,p_employee text,p_shift text
) returns public.case_closure_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.case_closure_requests%rowtype;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in ('lead','admin')
 then raise exception 'เฉพาะหัวหน้า / ผู้ดูแลระบบปิดข้อสังเกตได้' using errcode='42501'; end if;
 select * into q from public.case_closure_requests where id=p_id for update;
 if found then
  if q.requested_by<>auth.uid() or q.review_origin<>'head_direct' or q.exception_id<>p_case
    or q.outcome<>'process_error' or q.audit_reason<>btrim(p_reason)
    or q.responsible_employee<>btrim(p_employee) or q.responsible_shift<>p_shift
  then raise exception 'รหัสคำขอปิดถูกใช้แล้วหรือไม่ตรงต้นทาง'; end if;
  return public.decide_process_error_case(q.id,'approve',null);
 end if;
 q:=public.submit_process_error_case(p_id,p_case,p_reason,p_employee,p_shift);
 update public.case_closure_requests set review_origin='head_direct' where id=q.id and requested_by=auth.uid();
 return public.decide_process_error_case(q.id,'approve',null);
end $$;

revoke all on function public.submit_process_error_case(uuid,uuid,text,text,text) from public,anon;
revoke all on function public.decide_process_error_case(uuid,text,text) from public,anon;
revoke all on function public.close_process_error_case(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.submit_process_error_case(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.decide_process_error_case(uuid,text,text) to authenticated;
grant execute on function public.close_process_error_case(uuid,uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
