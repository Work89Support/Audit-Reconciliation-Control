-- Explicit FR8 report repair only. Never accepts a primary or creates cases.
-- Run as the database operator after review. Old reports and requests are immutable.
begin;
set local lock_timeout='5s';
-- SQL Editor already runs as database operator. This transaction-local backend
-- claim lets the existing file reader run; no user identity or grants change.
set local request.jwt.claim.role='service_role';

-- A session-local transformer: no new callable production API or permission.
create or replace function pg_temp.repair_fr8_report(r jsonb, day date) returns jsonb
language plpgsql as $$
declare e jsonb; t jsonb; original jsonb; out_rows jsonb:='[]'; notes jsonb:='[]';
 changes jsonb:='[]'; i integer; hit integer; hits integer; linked integer[]:='{}';
begin
 if day is null or r->>'company' is distinct from 'FR8' or r->>'business_date' is distinct from day::text
 or r->>'account' is distinct from 'ALL' or r->>'direction' is distinct from 'all' or r->>'quality' is distinct from 'passed'
 or jsonb_typeof(r->'exceptions') is distinct from 'array'
 then raise exception 'Unexpected report scope';end if;
 for e,i in select value,(ordinality-1)::integer from jsonb_array_elements(r->'exceptions') with ordinality loop
  if e->>'ex_type'='cross_day' and e#>'{customer_details,source_rows}'='{"bo":null,"stm":null}'::jsonb
   and e->>'stm_raw'='— ตรวจจากรายงานหลังบ้าน ไม่ต้องใช้ statement —'
   and length(trim(e->>'bo_raw'))>=40 and cardinality(string_to_array(e->>'bo_raw','|'))>=5
   and (e->>'system_amount')::numeric>0 and e->'system_amount'=e->'bank_amount' then
   select count(*),min((n-1)::integer) into hits,hit
   from jsonb_array_elements(r->'exceptions') with ordinality x(v,n)
   where n-1<>i and v->>'ex_type'='cross_day' and v->>'company'=e->>'company'
    and v->>'account'=e->>'account' and v->>'direction'=e->>'direction'
    and v->>'business_date'=e->>'business_date' and coalesce(v->>'currency','THB')=coalesce(e->>'currency','THB')
    and v->'system_amount'=e->'system_amount' and v->>'bank_amount' is null
    and v#>>'{customer_details,source_rows,stm}' is null
    and v#>>'{customer_details,source_rows,bo,fileId}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and v#>>'{customer_details,source_rows,bo,row}' ~ '^[0-9]+$'
    and trim(v->>'bo_raw')=trim(e->>'bo_raw');
   if hits<>1 or hit=any(linked) then raise exception 'Unproved or ambiguous Rules annotation %',i;end if;
   linked:=array_append(linked,hit);
   notes:=notes||jsonb_build_array(jsonb_build_object('original_index',i,'target_original_index',hit,
    'bo_source',r->'exceptions'->hit#>'{customer_details,source_rows,bo}','original_warning',e));
  elsif e#>>'{customer_details,source_rows,bo,fileId}' is null and e#>>'{customer_details,source_rows,stm,fileId}' is null then
   raise exception 'Unproved financial row %',i;
  end if;
 end loop;
 for original,i in select value,(ordinality-1)::integer from jsonb_array_elements(r->'exceptions') with ordinality loop
  if exists(select 1 from jsonb_array_elements(notes) n where (n->>'original_index')::integer=i) then continue;end if;
  e:=original;
  if e->>'business_date' is distinct from day::text then
   -- A report-day label is distinct from the actual transaction date. Only
   -- this proven next-day BO row is relabelled; all timestamps remain intact.
   if e->>'ex_type' is distinct from 'cross_day' or e->>'business_date' is distinct from (day+1)::text
    or e->>'bo_date' is distinct from (day+1)::text or not i=any(linked)
   then raise exception 'Unproved out-of-scope row %',i;end if;
   changes:=changes||jsonb_build_array(jsonb_build_object('original_index',i,'from',e->'business_date','to',day,
    'source',e#>'{customer_details,source_rows,bo}','transaction_date_preserved',e->'bo_date'));
   e:=jsonb_set(e,'{business_date}',to_jsonb(day::text));
  end if;
  select coalesce(jsonb_agg(n->'original_warning'),'[]') into t from jsonb_array_elements(notes) n where (n->>'target_original_index')::integer=i;
  if jsonb_array_length(t)>0 then
   e:=jsonb_set(e,'{customer_details}',coalesce(e->'customer_details','{}')||jsonb_build_object('related_cross_day_warnings',t));
   e:=jsonb_set(e,'{detail}',to_jsonb(coalesce(e->>'detail','')||' · '||
    (select string_agg('คำเตือนเดิม: '||coalesce(n->>'detail',''),' · ') from jsonb_array_elements(t) n)));
  end if;
  out_rows:=out_rows||jsonb_build_array(e);
 end loop;
 return r||jsonb_build_object('exceptions',out_rows,'exception_count',jsonb_array_length(out_rows)+jsonb_array_length(coalesce(r#>'{summary,waiting_bo}','[]')),
  'summary',r->'summary'||jsonb_build_object('report_repair',jsonb_build_object('version','fr8-oct15-scope-v1',
   'scope_changes',changes,'rules_annotations',notes,'old_exception_count',jsonb_array_length(r->'exceptions'),
   'new_exception_count',jsonb_array_length(out_rows),'waiting_count',jsonb_array_length(coalesce(r#>'{summary,waiting_bo}','[]')),
   'transaction_timestamps_preserved',true,'source_amounts_changed',0,'cases_created',0,'primary_accepted',false)));
end $$;

-- BEGIN STAGING: all assertions and the insert are one atomic transaction.
do $$
declare v public.manual_primary_results; q public.account_recheck_jobs; j public.daily_recon_jobs;
 fixed jsonb; draft public.account_recheck_jobs; stamp jsonb; nbo integer; nstm integer; rawbo integer; rawstm integer;
 request constant uuid:='648f0ad5-780a-4ea9-b1d1-f677cde8e467';
begin
 select * into strict v from public.manual_primary_results where id='f8c22ef6-10ab-4c80-8cf1-a5a92590e6e1' for update;
 select * into strict j from public.daily_recon_jobs where company=v.company and business_date=v.business_date and not is_archived for update;
 select * into strict q from public.account_recheck_jobs where id=v.recheck_id for update;
 if v.company<>'FR8' or v.business_date<>'2026-10-15'::date or md5(v.report::text)<>'4d158438daa3a3fbe0e0d46def8372f6'
 or q.result<>v.report or q.status<>'confirmed' or q.account<>'ALL' or q.direction<>'all'
 or j.last_run_id is distinct from v.base_run_id or j.status='running'
 or v.id is distinct from (select id from public.manual_primary_results where company=v.company and business_date=v.business_date order by accepted_at desc,id desc limit 1)
 or exists(select 1 from public.manual_primary_case_sets where primary_id=v.id)
 or exists(select 1 from public.account_recheck_jobs where company=v.company and business_date=v.business_date and status in ('queued','running'))
 then raise exception 'Scope, primary, cases or worker changed; stop for review';end if;
 stamp:=public.manual_primary_sources(public.effective_audit_source_files(v.company,v.business_date));
 if stamp<>v.source_stamp or stamp<>public.manual_primary_sources(q.snapshot->'effective_files') then raise exception 'Source files or OCR changed';end if;
 fixed:=pg_temp.repair_fr8_report(v.report,v.business_date);
 if jsonb_array_length(fixed->'exceptions')<>15 or jsonb_array_length(fixed#>'{summary,waiting_bo}')<>143
 or jsonb_array_length(fixed#>'{summary,report_repair,rules_annotations}')<>5
 or jsonb_array_length(fixed#>'{summary,report_repair,scope_changes}')<>5
 or fixed->'match_evidence'<>v.report->'match_evidence' or fixed#>'{summary,waiting_bo}'<>v.report#>'{summary,waiting_bo}'
 or fixed->'bo_count'<>v.report->'bo_count' or fixed->'stm_count'<>v.report->'stm_count' or fixed->'matched'<>v.report->'matched'
 then raise exception 'Unexpected report repair; stop';end if;
 -- Independently validate every retained row and physical pointer. The two
 -- existing, proven manual-review annotations are still retained as warnings.
 if exists(select 1 from jsonb_array_elements(fixed->'exceptions') e where e->>'company'<>'FR8'
  or e->>'business_date'<>'2026-10-15' or nullif(e->>'account','') is null or e->>'direction' not in ('ฝาก','ถอน','deposit','withdraw'))
 then raise exception 'Invalid row scope';end if;
 if exists(select 1 from public.manual_primary_counted_pointers(fixed) p where s is not null and s<>'null'::jsonb
  and (coalesce(s->>'row','')!~'^[0-9]+$' or not exists(select 1 from jsonb_array_elements(stamp) f
   where f->>'physical'=s->>'fileId' and f->>'company'='FR8' and f->>'kind'=case when p.side='bo' then 'bo_main' else f->>'kind' end
   and (p.side='bo' or f->>'kind' in ('pm_statement','stm_pdf')))))
 then raise exception 'Unproved physical source';end if;
 select count(distinct(s->>'fileId',s->>'row')) filter(where side='bo' and s->>'fileId' is not null),
 count(distinct(s->>'fileId',s->>'row')) filter(where side='stm' and s->>'fileId' is not null),
 count(*) filter(where side='bo' and s->>'fileId' is not null),count(*) filter(where side='stm' and s->>'fileId' is not null)
 into nbo,nstm,rawbo,rawstm from public.manual_primary_counted_pointers(fixed);
 if nbo<>4580 or nstm<>4430 or rawbo<>nbo or rawstm<>nstm then raise exception 'Incomplete or duplicate source coverage';end if;
 select * into draft from public.account_recheck_jobs where request_key=request;
 if found then
  if draft.result is distinct from fixed or draft.company is distinct from v.company
   or draft.business_date is distinct from v.business_date or draft.base_run_id is distinct from q.base_run_id
  then raise exception 'Repair replay conflict';end if;
 else
  insert into public.account_recheck_jobs(company,business_date,account,direction,mode,status,request_key,requested_by,base_run_id,
   snapshot,selected_file_ids,result,attempt_count,worker_execution_id,lease_expires_at)
  values(v.company,v.business_date,'ALL','all','account','ready',request,q.requested_by,q.base_run_id,
   q.snapshot,q.selected_file_ids,fixed,0,null,now()) returning * into draft;
  insert into public.audit_log(actor,action,entity,target,company,detail,meta)
  values('database-operator','manual_report_repair_staged','account_recheck_jobs',draft.id::text,v.company,
   'FR8 15 Oct: preserve actual transaction dates; link proven Rules notices to physical BO; ready for head/Admin review only',
   jsonb_build_object('parent_primary_id',v.id,'parent_recheck_id',q.id,'parent_report_md5',md5(v.report::text),
    'new_report_md5',md5(fixed::text),'cases_before',163,'cases_for_review',158,'annotations_preserved',5,
    'sources_changed',0,'cases_created',0,'cases_closed',0,'primary_accepted',false));
 end if;
end $$;
commit;
select id,company,business_date,status,confirmed_at,revision,result->'stm_count' stm_count,result->'bo_count' bo_count,
 result->'matched' matched,result->'exception_count' review_count,result#>'{summary,report_repair}' repair
from public.account_recheck_jobs where request_key='648f0ad5-780a-4ea9-b1d1-f677cde8e467';
