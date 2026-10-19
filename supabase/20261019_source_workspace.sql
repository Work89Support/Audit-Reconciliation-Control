-- Source preparation UI support only. Installing this changes no business rows.
begin;
set local lock_timeout='3s';
create or replace function public.audit_source_workspace(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare s jsonb;
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false)
 or coalesce(public.current_app_role(),'') not in('monitor','audit_assistant','lead','admin') then raise exception 'ไม่มีสิทธิ์อ่านรอบไฟล์บริษัทนี้';end if;
 -- Preparation reads metadata only. Full preflight still runs at the existing
 -- manual request/worker/acceptance boundaries; never invoke it for a file list.
 s:=jsonb_build_object('files',public.effective_audit_source_files(p_company,p_date),
 'hold',(select to_jsonb(h) from public.audit_run_holds h where company=p_company and business_date=p_date),
 'manualOnly',public.audit_source_scope_managed(p_company,p_date));
 return s||jsonb_build_object('files',(select coalesce(jsonb_agg(x||jsonb_build_object(
 'source_origin',case when b.gmail_message_id like 'manual-source:%' then 'upload' else 'mail' end,
 'original_mail_date',b.business_date,'source_subject',b.subject)),'[]')
 from jsonb_array_elements(s->'files') x join public.source_files f on f.id=(x->>'id')::uuid join public.mail_batches b on b.id=f.batch_id));
end $$;
revoke all on function public.audit_source_workspace(text,date) from public,anon;
grant execute on function public.audit_source_workspace(text,date) to authenticated;

do $upgrade$
declare d text;a text;b text;
begin
 d:=pg_get_functiondef('public.add_audit_manual_source(text,date,text,jsonb,text)'::regprocedure);
 if position('source-workspace-v1' in d)>0 then return;end if;
 a:=$old$p_kind not in ('bo_main','stm_pdf','pm_statement')$old$;
 if position(a in d)=0 then raise exception 'Unexpected upload kind guard';end if;
 d:=replace(d,a,$new$p_kind not in ('bo_main','stm_pdf','pm_statement','doc_clarify')$new$);
 a:=$old$if not found then raise exception 'ยังไม่มีรอบบริษัท/วันที่นี้ กรุณาตรวจรอบรับไฟล์';end if;$old$;
 b:=$new$if not found then
  -- source-workspace-v1: first upload creates only an idle scoped intake job.
  insert into public.daily_recon_jobs(id,company,business_date,status) values(gen_random_uuid(),p_company,p_date,'waiting_files') on conflict(business_date,company) do nothing;
  select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived for update;
  if not found then raise exception 'รอบนี้เก็บถาวรแล้ว ต้องให้หัวหน้าตรวจประวัติก่อน';end if;
 end if;
 if nullif(p_metadata->>'effective_name','') is not null and (length(trim(p_metadata->>'effective_name')) not between 1 and 255 or (p_metadata->>'effective_name')~'[[:cntrl:]/]' or position(chr(92) in p_metadata->>'effective_name')>0) then raise exception 'ชื่อที่ใช้ในระบบไม่ถูกต้อง';end if;$new$;
 if position(a in d)=0 then raise exception 'Unexpected first-round guard';end if;d:=replace(d,a,b);
 a:=$old$r:=public.correct_audit_source(fid,1,p_metadata->>'file_name',p_company,p_date,p_kind,null,false,trim(p_reason));$old$;
 b:=$new$r:=public.correct_audit_source(fid,1,coalesce(nullif(trim(p_metadata->>'effective_name'),''),p_metadata->>'file_name'),p_company,p_date,p_kind,null,false,trim(p_reason));$new$;
 if position(a in d)=0 then raise exception 'Unexpected immutable-source registration';end if;d:=replace(d,a,b);
 a:=$old$or r.created_by is distinct from auth.uid() or r.reason is distinct from trim(p_reason)$old$;
 b:=$new$or r.effective_name is distinct from coalesce(nullif(trim(p_metadata->>'effective_name'),''),p_metadata->>'file_name')
  or r.created_by is distinct from auth.uid() or r.reason is distinct from trim(p_reason)$new$;
 if position(a in d)=0 then raise exception 'Unexpected upload retry receipt guard';end if;d:=replace(d,a,b);
 execute d;
end $upgrade$;
commit;
