-- Make a returned clarification visible to the responder queue even when the
-- original case was answered from an evidence/manual flow and therefore never
-- had requested_at/requested_by. Financial data, answers and evidence stay put.
begin;
set local lock_timeout='5s';

do $patch$
declare
 definition text;
 marker text:='/* clarification_return_receipt_v1 */';
 start_pos integer;
 relative_end integer;
 end_pos integer;
 replacement text;
begin
 definition:=pg_get_functiondef('public.set_document_case_deadline()'::regprocedure);
 if position('clarification_return_receipt_v2' in definition)>0 then return; end if;
 start_pos:=position(marker in definition);
 if start_pos=0 then raise exception 'Deadline function drift: v1 return receipt not found'; end if;
 relative_end:=position(' end if;' in substring(definition from start_pos));
 if relative_end=0 then raise exception 'Deadline function drift: v1 return receipt end not found'; end if;
 end_pos:=start_pos+relative_end+length(' end if;')-1;
 replacement:='/* clarification_return_receipt_v2 */
 if old.status=''answered'' and new.status=''clarifying'' and exists(
 select 1 from public.case_clarification_returns r where r.exception_id=old.id
 and r.actor_user_id=auth.uid() and r.created_at=transaction_timestamp()
 and r.previous_updated_at is not distinct from old.updated_at
 and r.previous_responded_at is not distinct from old.responded_at) then
  new.requested_at:=coalesce(old.requested_at,transaction_timestamp());
  new.requested_by:=coalesce(old.requested_by,auth.uid());
  if old.requested_at is null and old.document_due_at is null then
   select document_days into days from public.company_case_sla where company=new.company;
   new.document_due_at:=new.requested_at+make_interval(days=>coalesce(days,15));
  else
   new.document_due_at:=old.document_due_at;
  end if;
  return new;
 end if;';
 execute substring(definition from 1 for start_pos-1)||replacement||substring(definition from end_pos+1);
end $patch$;

-- Repair only currently returned cases that are invisible because the request
-- receipt is absent. Keep the original answer, evidence and reconciliation.
with latest_return as (
 select distinct on (r.exception_id)
  r.exception_id,r.actor_user_id,r.created_at
 from public.case_clarification_returns r
 order by r.exception_id,r.created_at desc
), repaired as (
 update public.exceptions e
 set requested_at=r.created_at,
     requested_by=r.actor_user_id,
     document_due_at=coalesce(e.document_due_at,r.created_at+make_interval(days=>coalesce((select s.document_days from public.company_case_sla s where s.company=e.company),15))),
     updated_at=now()
 from latest_return r
 where e.id=r.exception_id and e.status='clarifying' and e.requested_at is null
 returning e.id,e.company,e.requested_at,e.requested_by
)
insert into public.audit_log(actor,actor_user_id,company,action,entity,target,detail,meta)
select 'system',requested_by,company,'clarification_request_receipt_repaired','exception',id::text,
 'ซ่อมข้อมูลรับคำขอตีกลับเพื่อให้เคสกลับเข้าคิวผู้ชี้แจง โดยไม่แก้คำตอบ ไฟล์ หรือยอด',
 jsonb_build_object('requested_at',requested_at,'preserved_financial_data',true,'preserved_evidence',true)
from repaired;

notify pgrst,'reload schema';
commit;
