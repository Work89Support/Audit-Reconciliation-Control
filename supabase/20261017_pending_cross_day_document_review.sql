-- Definitions only. Never close, re-open, backfill or change any live case here.
begin;
set local lock_timeout='5s';
create or replace function public.pending_document_closure_preview(p_case uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype; problems text[]:='{}'; current_source boolean:=false; stored boolean:=false;
begin
 if auth.uid() is null or not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'') not in('lead','admin') then
  raise exception 'เคสรอข้ามวันต้องให้หัวหน้า/Admin ตรวจหลักฐานและผลยอดก่อนปิด' using errcode='42501';end if;
 select * into e from public.exceptions where id=p_case;
 if not found or not public.has_company_access(e.company) then raise exception 'ไม่พบเคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if e.status is distinct from 'pending_next_day' or e.ex_type is distinct from 'cross_day' then problems:=array_append(problems,'สถานะล่าสุดไม่ใช่เคสรอข้ามวัน ต้องเปิดตรวจใหม่');end if;
 if e.manual_pair_id is not null or e.case_closure_request_id is not null
  or to_jsonb(e)->>'cross_day_request_id' is not null or to_jsonb(e)->>'cross_day_image_request_id' is not null
  or to_jsonb(e)->>'governance_request_id' is not null
  or exists(select 1 from public.case_closure_requests q where q.exception_id=e.id and q.status='pending')
  or exists(select 1 from public.cross_day_pair_requests q where q.exception_id=e.id and q.status='pending')
  or exists(select 1 from public.cross_day_image_reviews q where q.exception_id=e.id and q.status='pending')
 then problems:=array_append(problems,'มีคำขอปิด/จับคู่/ตรวจภาพค้างอยู่ ต้องดำเนินการผ่านคำขอเดิม');end if;
 if e.superseded_by_exception_id is not null then problems:=array_append(problems,'เคสนี้ถูกแทนที่แล้ว ต้องใช้เคสปัจจุบัน');end if;
 if public.account_review_hold_id(e.company,e.business_date,e.account,coalesce(e.bo_time,e.occurred_at)::text) is not null then
  problems:=array_append(problems,'เคสอยู่ในทะเบียนพักตรวจ ห้ามปิดหรือสรุปความเสียหาย');end if;
 if e.customer_details->>'manual_primary_id' is not null then
  current_source:=coalesce(public.cross_day_current_manual_case(e),false);
 else
  current_source:=public.primary_case_is_current(e.id) and exists(select 1 from public.daily_recon_jobs j
   where j.company=e.company and j.business_date=e.business_date and not j.is_archived and j.last_run_id=e.run_id);
 end if;
 if not current_source then problems:=array_append(problems,'แถวต้นทาง/ไฟล์/ผลหลักเปลี่ยน ต้องทบทวนผลล่าสุด ไม่ใช้ประวัติมาปิด');end if;
 stored:=public.case_has_stored_document(e.id);
 if not stored then problems:=array_append(problems,'ยังไม่มีหลักฐานที่ผูกเคสและมีไฟล์จริงในคลัง');end if;
 if coalesce(e.currency,'THB')<>'THB' then problems:=array_append(problems,'รายการเงินต่างประเทศต้องทบทวนสกุลเงินก่อน');end if;
 return jsonb_build_object('case_id',e.id,'status',e.status,'allowed',cardinality(problems)=0,'problems',to_jsonb(problems),
  'stored_document',stored,'current_source',current_source,'requires_head_confirmation',true,'outcome','no_loss');
end $$;
revoke all on function public.pending_document_closure_preview(uuid) from public,anon;
grant execute on function public.pending_document_closure_preview(uuid) to authenticated;
-- Preserve the complete existing submission/decision workflow. Only the
-- pending-cross-day branch gains a guarded head-only document review path.
do $patch$
declare definition text; old_gate text; replacement text;
begin
 definition:=pg_get_functiondef('public.submit_case_closure(uuid,uuid,text,numeric,text,text)'::regprocedure);
 if position('pending_cross_day_document_review_v1' in definition)>0 then return;end if;
 old_gate:='if e.status is null or e.status not in (''open'',''clarifying'',''answered'') or e.manual_pair_id is not null or e.case_closure_request_id is not null';
 if position(old_gate in definition)=0 then raise exception 'Unreviewed document submission status guard';end if;
 replacement:='/* pending_cross_day_document_review_v1 */
 if e.status=''pending_next_day'' then
  if p_outcome is distinct from ''no_loss'' or p_amount is distinct from 0::numeric or p_category is not null then
   raise exception ''เคสรอข้ามวันยังไม่สรุปเป็นความเสียหาย ทางนี้ใช้เฉพาะหัวหน้ายืนยันเอกสารและไม่มีความเสียหาย 0 บาท'';end if;
  if not coalesce((public.pending_document_closure_preview(e.id)->>''allowed'')::boolean,false) then
   raise exception ''ยังทบทวนปิดเคสข้ามวันไม่ได้: %'',public.pending_document_closure_preview(e.id)->''problems'';end if;
 end if;
 if e.status is null or e.status not in (''open'',''clarifying'',''answered'',''pending_next_day'') or e.manual_pair_id is not null or e.case_closure_request_id is not null';
 execute replace(definition,old_gate,replacement);
end $patch$;
notify pgrst,'reload schema';
commit;
