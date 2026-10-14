-- Add waiting cross-day actions. No case, amount, run, file or history updates.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.cross_day_current_manual_case(e public.exceptions)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.current_user_active() and public.has_company_access(e.company)
 and public.primary_case_is_current(e.id)
 and exists(select 1 from public.manual_primary_case_items i
 join public.manual_primary_results v on v.id=i.primary_id
 join public.account_recheck_jobs q on q.id=v.recheck_id
 join public.daily_recon_jobs j on j.company=v.company and j.business_date=v.business_date
 where i.exception_id=e.id and v.id::text=e.customer_details->>'manual_primary_id'
 and v.company=e.company and v.business_date=e.business_date and v.base_run_id=e.run_id
 and not j.is_archived and j.status<>'running' and j.last_run_id=v.base_run_id
 and q.status='confirmed' and q.result=v.report and q.account='ALL' and q.direction='all'
 and v.report->>'quality'='passed'
 and v.source_stamp=public.manual_primary_sources(public.effective_audit_source_files(v.company,v.business_date))
 and exists(select 1 from jsonb_array_elements(v.source_stamp) p
 join public.source_files bo on bo.id::text=p->>'id'
 join storage.objects obj on obj.bucket_id='audit-files' and obj.name=bo.storage_path
 where p->>'id'=e.customer_details#>>'{source_rows,bo,fileId}'
 and bo.company=e.company and bo.kind='bo_main' and not coalesce((to_jsonb(bo)->>'is_archived')::boolean,false)
 and e.customer_details#>>'{source_rows,bo,row}'~'^[1-9][0-9]*$'))
$$;
revoke all on function public.cross_day_current_manual_case(public.exceptions) from public,anon,authenticated;

create or replace function public.can_attach_waiting_cross_day_evidence(p_case uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and public.current_user_active()
 and public.current_app_role() in ('monitor','audit_assistant','lead','admin')
 and exists(select 1 from public.exceptions e where e.id=p_case
 and public.has_company_access(e.company) and e.ex_type='cross_day' and e.status='pending_next_day'
 and public.primary_case_is_current(e.id)
 and e.superseded_by_exception_id is null and e.manual_pair_id is null
 and e.case_closure_request_id is null and e.cross_day_request_id is null
 and e.cross_day_image_request_id is null and to_jsonb(e)->>'governance_request_id' is null
 and (public.cross_day_current_manual_case(e) or
 (e.customer_details->>'manual_primary_id' is null and exists(select 1 from public.daily_recon_jobs j
 where j.company=e.company and j.business_date=e.business_date and not j.is_archived
 and j.status='completed' and j.last_run_id=e.run_id))))
$$;
revoke all on function public.can_attach_waiting_cross_day_evidence(uuid) from public,anon;
grant execute on function public.can_attach_waiting_cross_day_evidence(uuid) to authenticated;

-- Patch exact reviewed anchors; drift aborts the entire migration.
do $patch$
declare item record; body text; a text; b text;
begin
 for item in select * from (values
 ('public.cross_day_workbench(text,date,date)', 'and e.status=''open''', 'and e.status in (''open'',''pending_next_day'') and public.primary_case_is_current(e.id) and (e.customer_details->>''manual_primary_id'' is null or public.cross_day_current_manual_case(e))'),
 ('public.submit_cross_day_pair(uuid,uuid,uuid,integer,text)', 'if e.status<>''open''', 'if e.status not in (''open'',''pending_next_day'') or not public.primary_case_is_current(e.id)'),
 ('public.submit_cross_day_image_review(uuid,uuid,uuid,integer,text)', 'e.status<>''open''', '(e.status not in (''open'',''pending_next_day'') or not public.primary_case_is_current(e.id) or (e.customer_details->>''manual_primary_id'' is not null and not public.cross_day_current_manual_case(e)))'),
 ('public.guard_cross_day_request()', 'old.status=''open''', 'old.status in (''open'',''pending_next_day'')'),
 ('public.guard_cross_day_image_request()', 'old.status=''open''', 'old.status in (''open'',''pending_next_day'')'),
 ('public.guard_cross_day_request()', 'new.status=''open'' and new.cross_day_request_id is null', 'new.status=coalesce(q.snapshot#>>''{bo,status}'',''open'') and new.cross_day_request_id is null'),
 ('public.guard_cross_day_image_request()', 'new.status=''open'' and new.cross_day_image_request_id is null', 'new.status=coalesce(q.snapshot#>>''{bo,status}'',''open'') and new.cross_day_image_request_id is null'),
 ('public.decide_cross_day_pair(uuid,text,text)', 'status=''open'',cross_day_request_id=null', 'status=coalesce(q.snapshot#>>''{bo,status}'',''open''),cross_day_request_id=null'),
 ('public.decide_cross_day_image_review(uuid,text,text)', 'status=''open'',cross_day_image_request_id=null', 'status=coalesce(q.snapshot#>>''{bo,status}'',''open''),cross_day_image_request_id=null'),
 ('public.register_case_evidence(jsonb)', 'and not coalesce(public.can_attach_pending_pair_evidence(e.id),false)', 'and not coalesce(public.can_attach_pending_pair_evidence(e.id),false) and not public.can_attach_waiting_cross_day_evidence(e.id)'),
 ('public.link_selected_case_file(uuid,uuid,text)', 'e.status not in (''open'',''clarifying'',''answered'')', '(e.status not in (''open'',''clarifying'',''answered'') and not public.can_attach_waiting_cross_day_evidence(e.id))')
 ) as patches(signature,old_anchor,new_anchor)
 loop
  body:=pg_get_functiondef(item.signature::regprocedure);
  if strpos(body,item.new_anchor)>0 then continue;end if;
  if (length(body)-length(replace(body,item.old_anchor,'')))/length(item.old_anchor)<>1 then
   raise exception 'Cross-day function drift: %',item.signature;
  end if;
  execute replace(body,item.old_anchor,item.new_anchor);
 end loop;
 -- Retain the native parser gate for automatic cases. Accepted manual cases
 -- use their exact current primary report and unchanged physical file stamp.
 body:=pg_get_functiondef('public.validate_cross_day_row(uuid,uuid,integer)'::regprocedure);
 a:='if not exists(select 1 from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id';
 b:='if not (public.cross_day_current_manual_case(e) or exists(select 1 from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id';
 if strpos(body,b)=0 then
  if strpos(body,a)=0 or strpos(body,'then raise exception ''ผลรันเปลี่ยนหรือยังรันไม่เสร็จ')=0 then raise exception 'Native validation gate drift';end if;
  body:=replace(body,a,b);
  a:='row}''~''^[1-9][0-9]*$'')'; b:='row}''~''^[1-9][0-9]*$''))';
  if (length(body)-length(replace(body,a,'')))/length(a)<>1 then raise exception 'Native validation close anchor drift';end if;
  body:=replace(body,a,b);
  -- Revalidate current primary authority again at head approval.
  body:=replace(body,'if e.ex_type<>''cross_day''', 'if not public.primary_case_is_current(e.id) or (e.customer_details->>''manual_primary_id'' is not null and not public.cross_day_current_manual_case(e)) or e.ex_type<>''cross_day''');
  execute body;
 end if;
 -- Image head decisions must also reject an outdated accepted manual result.
 body:=pg_get_functiondef('public.decide_cross_day_image_review(uuid,text,text)'::regprocedure);
 a:='if p_action=''approve'' then';
 b:='if p_action=''approve'' then
  if not public.primary_case_is_current(e.id) or (e.customer_details->>''manual_primary_id'' is not null and not public.cross_day_current_manual_case(e)) then raise exception ''ผลหลักหรือไฟล์ล่าสุดเปลี่ยน ต้องตรวจใหม่'';end if;';
 if strpos(body,'ผลหลักหรือไฟล์ล่าสุดเปลี่ยน ต้องตรวจใหม่')=0 then execute replace(body,a,b);end if;
end $patch$;

create or replace function public.link_waiting_cross_day_file(p_exception_id uuid,p_file_id uuid,p_note text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype;f public.source_files%rowtype;
begin
 select * into e from public.exceptions where id=p_exception_id for update;
 if not found or public.can_attach_waiting_cross_day_evidence(e.id) is distinct from true
 then raise exception 'ไม่มีสิทธิ์ หรือเคสรอข้ามวัน/ผลหลักล่าสุดเปลี่ยน';end if;
 if coalesce(length(btrim(p_note)),0) not between 10 and 2000 then raise exception 'ระบุเหตุผล 10–2000 ตัวอักษร';end if;
 select * into f from public.source_files where id=p_file_id for share;
 if not found or f.company is distinct from e.company or coalesce((to_jsonb(f)->>'is_archived')::boolean,false)
 or nullif(f.storage_path,'') is null or not exists(select 1 from storage.objects o
 where o.bucket_id='audit-files' and o.name=f.storage_path)
 then raise exception 'ไฟล์ต้นฉบับไม่พร้อมหรือไม่ใช่บริษัทของเคส';end if;
 if e.clarification_file_id is not null and e.clarification_file_id<>f.id
 then raise exception 'มีหลักฐานเดิมแล้ว ไม่เขียนทับ';end if;
 if e.clarification_file_id is distinct from f.id then
  update public.exceptions set clarification_file_id=f.id where id=e.id;
  insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta)
  values(auth.uid()::text,auth.uid(),'case_note','exception',e.id::text,btrim(p_note),
  jsonb_build_object('source_file_id',f.id,'case_company',e.company,'evidence_link_only',true));
 end if;
 return jsonb_build_object('exception_id',e.id,'source_file_id',f.id,'status',e.status);
end $$;
revoke all on function public.link_waiting_cross_day_file(uuid,uuid,text) from public,anon;
grant execute on function public.link_waiting_cross_day_file(uuid,uuid,text) to authenticated;

do $policy$ begin
if not exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname='waiting_cross_day_object_insert') then
execute $create_policy$ create policy waiting_cross_day_object_insert on storage.objects for insert to authenticated
with check(bucket_id='audit-files' and split_part(name,'/',1)='case-evidence'
 and split_part(name,'/',3)=auth.uid()::text and array_length(string_to_array(name,'/'),1)=4
 and exists(select 1 from public.exceptions e where e.id=case
 when split_part(objects.name,'/',2)~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then split_part(objects.name,'/',2)::uuid else null::uuid end
 and public.can_attach_waiting_cross_day_evidence(e.id))) $create_policy$;
end if;end $policy$;
-- Registration is the only new metadata path: exact object/size/owner checks
-- remain in register_case_evidence. No UPDATE/DELETE policy is added.
notify pgrst,'reload schema';
commit;
