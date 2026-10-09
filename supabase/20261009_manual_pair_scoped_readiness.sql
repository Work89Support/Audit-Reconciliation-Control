-- Pair-specific readiness. Never marks a company-day complete or changes cases.
begin;
set local lock_timeout='5s';
create function public.manual_pair_scoped_source_ready(p_case uuid,p_side text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype;r public.recon_runs%rowtype;j public.daily_recon_jobs%rowtype;coverage jsonb;item jsonb;
begin
 if p_side is null or p_side not in ('BO','STM') then return false;end if;
 select * into e from public.exceptions where id=p_case;
 if not found or e.superseded_by_exception_id is not null or public.has_company_access(e.company) is distinct from true then return false;end if;
 select * into j from public.daily_recon_jobs where company=e.company and business_date=e.business_date and not is_archived;
 if not found or coalesce(j.status,'') not in ('completed','needs_review') or j.last_run_id is distinct from e.run_id then return false;end if;
 select * into r from public.recon_runs where id=j.last_run_id;
 if not found or r.summary->>'source_parser_completion' is distinct from 'true' or coalesce(cardinality(r.file_ids),0)=0 then return false;end if;
 -- Preserve the global parser gate: missing files and failed parses are not zero.
 if (select count(*) from public.source_files f where f.id=any(r.file_ids))<>cardinality(r.file_ids)
 or exists(select 1 from public.source_files f where f.id=any(r.file_ids) and (f.parsed is distinct from true or f.parse_error is not null)) then return false;end if;
 if j.status='completed' and r.summary->'bo_first'->>'complete'='true' then return true;end if;
 -- For an incomplete day require the immutable exact source file/row retained
 -- by the original pair validator, including the stored object and source kind.
 if not exists(select 1 from public.source_files f join storage.objects o
  on o.bucket_id='audit-files' and o.name=f.storage_path
  where f.id::text=e.customer_details#>>array['source_rows',lower(p_side),'fileId']
  and f.id=any(r.file_ids) and f.company=e.company and f.parsed is true and f.parse_error is null
  and e.customer_details#>>array['source_rows',lower(p_side),'row'] ~ '^[1-9][0-9]*$'
  and ((p_side='BO' and f.kind='bo_main') or (p_side='STM' and f.kind in('stm_pdf','pm_statement')))) then return false;end if;
 coverage:=r.summary->'bo_first'->(case when p_side='BO' then 'required' else 'received' end);
 if jsonb_typeof(coverage) is distinct from 'array' then return false;end if;
 for item in select value from jsonb_array_elements(coverage) loop
  if item->>'company'=e.company and item->>'identity'=e.account
   and item->>'direction'=(case when e.direction='ฝาก' then 'deposit' when e.direction='ถอน' then 'withdraw' else '' end)
   and coalesce((item->>'rows')::integer,0)>0
   and jsonb_typeof(item->'source_files')='array' and jsonb_array_length(item->'source_files')>0
   and not exists(select 1 from jsonb_array_elements_text(item->'source_files') names(name)
    where not exists(select 1 from public.source_files f where f.id=any(r.file_ids) and f.company=e.company and f.file_name=names.name and f.parsed is true and f.parse_error is null)) then return true;end if;
 end loop;
 return false;
end $$;
revoke all on function public.manual_pair_scoped_source_ready(uuid,text) from public,anon,authenticated;
do $patch$
declare def text;start_at integer;end_at integer;old_block text;
begin
 def:=pg_get_functiondef('public.validate_manual_pair(uuid,uuid,text,uuid)'::regprocedure);
 start_at:=strpos(def,'if a.superseded_by_exception_id is not null or b.superseded_by_exception_id is not null');
 end_at:=strpos(def,'if (p_mode=''cross'' or p_evidence is not null)');
 if start_at=0 or end_at<=start_at then raise exception 'Unexpected manual validation baseline';end if;
 old_block:=substr(def,start_at,end_at-start_at);
 if strpos(old_block,'source_parser_completion')=0 or strpos(old_block,'bo_first')=0 then raise exception 'Unexpected readiness gate';end if;
 execute overlay(def placing 'if not public.manual_pair_scoped_source_ready(a.id,''BO'') or not public.manual_pair_scoped_source_ready(b.id,''STM'') then raise exception ''คู่ที่เลือกยังไม่พร้อม: ต้องเป็นรันล่าสุดที่อ่านไฟล์สำเร็จ และมี BO/STM ของบัญชีและทิศทางนี้จริง'';end if;
 if p_mode=''cross'' and exists(select 1 from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id where (j.company,j.business_date) in ((a.company,a.business_date),(b.company,b.business_date)) and not j.is_archived and (j.status is distinct from ''completed'' or r.summary->''bo_first''->>''complete'' is distinct from ''true'')) then raise exception ''ข้ามบริษัทต้องมีผลรันที่ครบทั้งสองบริษัท'';end if;
 ' from start_at for end_at-start_at);
end $patch$;
notify pgrst,'reload schema';
commit;
