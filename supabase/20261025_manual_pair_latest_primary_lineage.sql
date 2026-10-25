-- Keep manual pairing tied to the latest accepted primary case set even when
-- an existing exception retains the id of an earlier accepted primary result.
-- Reviewed PDF recovery is accepted only for the exact approved STM source.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.manual_pair_scoped_source_ready(p_case uuid,p_side text)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype;r public.recon_runs%rowtype;j public.daily_recon_jobs%rowtype;
 coverage jsonb;item jsonb;primary_result public.manual_primary_results%rowtype;source_file_id text;
begin
 if p_side is null or p_side not in ('BO','STM') then return false;end if;
 select * into e from public.exceptions where id=p_case;
 if not found or e.superseded_by_exception_id is not null
  or public.has_company_access(e.company) is distinct from true then return false;end if;

 -- Case-set membership is authoritative. A case can be retained by a newer
 -- accepted primary result without rewriting its historical manual_primary_id.
 select v.* into primary_result
 from public.manual_primary_case_items pair_item
 join public.manual_primary_results v on v.id=pair_item.primary_id
 join public.account_recheck_jobs recheck on recheck.id=v.recheck_id
 join public.daily_recon_jobs job on job.company=v.company and job.business_date=v.business_date and not job.is_archived
 where pair_item.exception_id=e.id
  and v.id=(select latest.id from public.manual_primary_results latest
   where latest.company=e.company and latest.business_date=e.business_date
   order by latest.accepted_at desc,latest.id desc limit 1)
  and v.company=e.company and v.business_date=e.business_date
  and v.base_run_id is not distinct from e.run_id
  and job.status<>'running' and job.last_run_id is not distinct from v.base_run_id
  and recheck.status='confirmed' and recheck.account='ALL' and recheck.direction='all'
  and public.manual_primary_report_projection(recheck.result)=v.report
  and v.report->>'quality'='passed'
  and public.manual_primary_sources_intact(v.source_stamp,public.effective_audit_source_files(v.company,v.business_date));
 if found then
  source_file_id:=e.customer_details#>>array['source_rows',lower(p_side),'fileId'];
  if source_file_id is null or source_file_id!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or e.customer_details#>>array['source_rows',lower(p_side),'row']!~'^[1-9][0-9]*$' then return false;end if;
  return exists(select 1 from jsonb_array_elements(primary_result.source_stamp) stamp
   join public.source_files source_file on source_file.id::text=stamp->>'physical'
   join storage.objects stored on stored.bucket_id='audit-files' and stored.name=stamp->>'path'
   where stamp->>'physical'=source_file_id and stamp->>'company'=e.company
   and stamp->>'path'=source_file.storage_path
   and source_file.parse_error is null
   and ((p_side='BO' and stamp->>'kind'='bo_main' and source_file.kind='bo_main' and source_file.parsed is true)
    or (p_side='STM' and stamp->>'kind' in('stm_pdf','pm_statement')
     and source_file.kind=stamp->>'kind'
     and (source_file.parsed is true or (source_file.kind='stm_pdf' and exists(
      select 1 from public.reviewed_pdf_recoveries recovery
      where recovery.source_file_id=source_file.id and recovery.company=e.company
       and recovery.business_date=e.business_date and recovery.status='approved'
       and recovery.superseded_at is null))))));
 end if;

 -- Existing automatic-run path remains fail-closed.
 select * into j from public.daily_recon_jobs where company=e.company and business_date=e.business_date and not is_archived;
 if not found or coalesce(j.status,'') not in ('completed','needs_review') or j.last_run_id is distinct from e.run_id then return false;end if;
 select * into r from public.recon_runs where id=j.last_run_id;
 if not found or r.summary->>'source_parser_completion' is distinct from 'true' or coalesce(cardinality(r.file_ids),0)=0 then return false;end if;
 if (select count(*) from public.source_files f where f.id=any(r.file_ids))<>cardinality(r.file_ids)
  or exists(select 1 from public.source_files f where f.id=any(r.file_ids) and (f.parsed is distinct from true or f.parse_error is not null)) then return false;end if;
 if j.status='completed' and r.summary->'bo_first'->>'complete'='true' then return true;end if;
 if not exists(select 1 from public.source_files f join storage.objects o
  on o.bucket_id='audit-files' and o.name=f.storage_path
  where f.id::text=e.customer_details#>>array['source_rows',lower(p_side),'fileId']
  and f.id=any(r.file_ids) and f.company=e.company and f.parsed is true and f.parse_error is null
  and e.customer_details#>>array['source_rows',lower(p_side),'row']~'^[1-9][0-9]*$'
  and ((p_side='BO' and f.kind='bo_main') or (p_side='STM' and f.kind in('stm_pdf','pm_statement')))) then return false;end if;
 coverage:=r.summary->'bo_first'->(case when p_side='BO' then 'required' else 'received' end);
 if jsonb_typeof(coverage) is distinct from 'array' then return false;end if;
 for item in select value from jsonb_array_elements(coverage) loop
  if item->>'company'=e.company and item->>'identity'=e.account
   and item->>'direction'=(case when e.direction='ฝาก' then 'deposit' when e.direction='ถอน' then 'withdraw' else '' end)
   and coalesce((item->>'rows')::integer,0)>0 and jsonb_typeof(item->'source_files')='array'
   and jsonb_array_length(item->'source_files')>0
   and not exists(select 1 from jsonb_array_elements_text(item->'source_files') names(name)
    where not exists(select 1 from public.source_files f where f.id=any(r.file_ids) and f.company=e.company
     and f.file_name=names.name and f.parsed is true and f.parse_error is null)) then return true;end if;
 end loop;
 return false;
end $$;
revoke all on function public.manual_pair_scoped_source_ready(uuid,text) from public,anon,authenticated;

do $patch$
declare definition text;patched text;
begin
 definition:=pg_get_functiondef('public.validate_7m_internal_transfer_pair(uuid,uuid)'::regprocedure);
 patched:=replace(replace(definition,
  'public.manual_pair_source_ready(a.id,''bo'')','public.manual_pair_scoped_source_ready(a.id,''BO'')'),
  'public.manual_pair_source_ready(b.id,''stm'')','public.manual_pair_scoped_source_ready(b.id,''STM'')');
 if patched=definition or position('manual_pair_source_ready' in patched)>0
  or position('manual_pair_scoped_source_ready(a.id,''BO'')' in patched)=0
  or position('manual_pair_scoped_source_ready(b.id,''STM'')' in patched)=0
 then raise exception 'Unexpected 7M internal-transfer validator; no changes applied';end if;
 execute patched;
end $patch$;

notify pgrst,'reload schema';
commit;
