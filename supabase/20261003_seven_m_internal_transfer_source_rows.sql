-- Staged only: preserve repeated 7M source rows through rerun lifecycle.
-- No historical rewrite, deletion, permission or RLS changes.
begin;
set local lock_timeout='5s';
do $migration$
declare definition text; needle text;
begin
  select pg_get_functiondef('public.recon_exception_lifecycle_key(public.exceptions)'::regprocedure) into definition;
  needle := 'select md5(concat_ws(';
  if position('seven-m-source-row-v1' in definition)=0 then
    if position(needle in definition)=0 then raise exception 'Unexpected lifecycle key definition'; end if;
    definition := replace(definition, needle,
      'select case when upper(p_exception.company) in (''7M'',''UFABET7M'')
        and p_exception.ex_type in (''missing_bo'',''missing_stm'')
        and coalesce(p_exception.customer_details#>>ARRAY[''source_rows'',case p_exception.ex_type when ''missing_bo'' then ''stm'' else ''bo'' end,''fileId''],'''')<>''''
        and coalesce(p_exception.customer_details#>>ARRAY[''source_rows'',case p_exception.ex_type when ''missing_bo'' then ''stm'' else ''bo'' end,''row''],'''')<>''''
        then md5(concat_ws(''|'',''seven-m-source-row-v1'',p_exception.company,p_exception.business_date,p_exception.ex_type,
          p_exception.customer_details#>>ARRAY[''source_rows'',case p_exception.ex_type when ''missing_bo'' then ''stm'' else ''bo'' end,''fileId''],
          p_exception.customer_details#>>ARRAY[''source_rows'',case p_exception.ex_type when ''missing_bo'' then ''stm'' else ''bo'' end,''row'']))
        else md5(concat_ws(');
    -- Existing SQL key has one select expression and no nested END.
    definition := regexp_replace(definition, '\)\)[[:space:]]*\$function\$', ')) end $function$');
    if position(')) end $function$' in definition)=0 then raise exception 'Unexpected lifecycle key ending'; end if;
    execute definition;
  end if;
  -- The generic timestamp closure cannot distinguish identical minute rows.
  -- 7M internal rows must use the exact source-row/group gate below instead.
  select pg_get_functiondef('public.close_repeated_exact_evidence_for_run(uuid)'::regprocedure) into definition;
  needle := 'and e.ex_type=ev.ex_type';
  if position('seven-m-internal-source-gate' in definition)=0 then
    if position(needle in definition)=0 then raise exception 'Unexpected repeated closure definition'; end if;
    execute replace(definition,needle,needle||'
      -- seven-m-internal-source-gate
      and not (upper(e.company) in (''7M'',''UFABET7M'') and concat_ws('' '',e.bo_raw,e.stm_raw) ~* ''โยก|รับยอด|fundout'')');
  end if;
end $migration$;

create or replace function public.close_seven_m_transfer_source_rows()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  with evidence as (
    select ev from public.recon_runs r
    cross join lateral jsonb_array_elements(coalesce(r.summary->'match_evidence','[]')) ev
    where r.id=new.last_run_id and r.summary->>'source_parser_completion'='true'
      and ev->>'internalTransferMatched'='true'
      and ev->>'method'='seven-m-internal-transfer-reciprocal'
  ), candidates as (
    select e.id,e.previous_exception_id,ev,
      count(*) over(partition by e.id) evidence_count
    from public.exceptions e join evidence on e.company=ev->>'company' and e.account=ev->>'account'
    where e.run_id=new.last_run_id and e.previous_exception_id is not null
      and e.superseded_by_exception_id is null and e.status in ('open','clarifying','answered')
      and e.ex_type in ('missing_bo','missing_stm')
      and coalesce(e.bank_amount,e.system_amount)= (ev->>'amount')::numeric
      and e.customer_details#>ARRAY['source_rows',case e.ex_type when 'missing_bo' then 'stm' else 'bo' end]
        = jsonb_build_object('fileId',ev#>>ARRAY[case e.ex_type when 'missing_bo' then 'stm' else 'bo' end,'fileId'],
            'row',(ev#>>ARRAY[case e.ex_type when 'missing_bo' then 'stm' else 'bo' end,'row'])::integer)
      and e.business_date::text=ev#>>ARRAY[case e.ex_type when 'missing_bo' then 'stm' else 'bo' end,'date']
  ), closed as (
    update public.exceptions e set status='closed',auto_closed=true,resolved_at=now(),
      resolved_by='system:seven-m-transfer-source-v1',closing_run_id=new.last_run_id,
      closure_rule='seven-m-balanced-group-exact-source-row',
      resolution_note='กลุ่มโยกเงินครบทั้งสองบัญชี จำนวนและยอดตรง ยอดคงเหลือต่อเนื่อง และตรงไฟล์/แถวต้นฉบับเดิม',updated_at=now()
    from candidates c where e.id=c.id and c.evidence_count=1
    returning e.id,c.ev
  ) insert into public.audit_log(actor,action,entity,target,detail,meta)
    select 'system:seven-m-transfer-source-v1','close_internal_transfer_source_row','exception',id::text,
      'Closed only a unique original source row covered by a complete balanced transfer group',
      jsonb_build_object('closing_run_id',new.last_run_id,'match_evidence',ev) from closed;
  return new;
end $$;
revoke all on function public.close_seven_m_transfer_source_rows() from public,anon,authenticated;
drop trigger if exists daily_recon_jobs_close_seven_m_source_rows on public.daily_recon_jobs;
create trigger daily_recon_jobs_close_seven_m_source_rows after update of status,last_run_id on public.daily_recon_jobs
for each row when (new.status='completed' and not new.is_archived and new.company in ('7M','UFABET7M')
  and new.last_run_id is not null and new.last_run_id is distinct from old.last_run_id)
execute function public.close_seven_m_transfer_source_rows();
commit;
