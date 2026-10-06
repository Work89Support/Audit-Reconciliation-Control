-- Head/admin same-company <=5 THB: verify this pair, not unrelated missing accounts.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function public.manual_pair_source_ready(p_case uuid,p_side text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from exceptions e
  join daily_recon_jobs j on j.last_run_id=e.run_id and j.company=e.company
   and j.business_date=e.business_date and j.status='completed' and not j.is_archived
  join recon_runs r on r.id=e.run_id
  join source_files f on f.id::text=e.customer_details#>>array['source_rows',p_side,'fileId']
   and f.id=any(r.file_ids) and f.company=e.company and f.parsed and f.parse_error is null
  join storage.objects o on o.bucket_id='audit-files' and o.name=f.storage_path
  where e.id=p_case and p_side in('bo','stm')
   and r.summary->>'source_parser_completion'='true'
   and e.customer_details#>>array['source_rows',p_side,'row'] ~ '^[1-9][0-9]*$'
   and ((p_side='bo' and f.kind='bo_main') or (p_side='stm' and f.kind in('stm_pdf','pm_statement'))));
$$;
revoke all on function public.manual_pair_source_ready(uuid,text) from public,anon,authenticated;
do $patch$
declare def text; needle text; replacement text;
begin
 def:=pg_get_functiondef('public.validate_manual_pair(uuid,uuid,text,uuid)'::regprocedure);
 if position('manual_pair_source_ready' in def)>0 then raise exception 'Scoped validation already installed; inspect before reapply'; end if;
 needle:=$old$r.summary->'bo_first'->>'complete'='true'$old$;
 replacement:=$new$(r.summary->'bo_first'->>'complete'='true' or (
  public.current_app_role() in ('lead','admin') and p_mode='same' and a.company=b.company
  and difference<=5 and public.manual_pair_source_ready(a.id,'bo')
  and public.manual_pair_source_ready(b.id,'stm')))$new$;
 if (length(def)-length(replace(def,needle,'')))/length(needle)<>2
  or position('difference>5' in def)=0 or position('has_company_access' in def)=0
 then raise exception 'Unexpected validation baseline; no changes applied'; end if;
 execute replace(def,needle,replacement);
end $patch$;
create or replace function public.close_manual_case_pair(
 p_id uuid,p_bo uuid,p_stm uuid,p_mode text,p_reason text,p_evidence uuid default null)
returns public.manual_case_pairs language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.manual_case_pairs%rowtype;
begin
 if auth.uid() is null or not public.current_user_active()
  or coalesce(public.current_app_role(),'') not in ('lead','admin') or p_mode is distinct from 'same'
 then raise exception 'เฉพาะหัวหน้า/ผู้ดูแลปิดคู่บริษัทเดียวกันได้' using errcode='42501'; end if;
 -- Submission and approval are one atomic transaction; failed approval leaves no pending request.
 p:=public.submit_manual_case_pair(p_id,p_bo,p_stm,p_mode,p_reason,p_evidence);
 p:=public.decide_manual_case_pair(p.id,'approve',null);
 if p.status<>'approved' or p.decided_by<>auth.uid() then raise exception 'ยังยืนยันการปิดคู่ไม่ได้'; end if;
 return p;
end $$;
revoke all on function public.close_manual_case_pair(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.close_manual_case_pair(uuid,uuid,uuid,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
