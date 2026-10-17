-- Definitions only. Original reports, source rows, amounts, cases and holds stay intact.
begin;
set local lock_timeout='5s';
create or replace function public.manual_primary_bo_timing_links(p_report jsonb)
returns table(warning_index integer,source_index integer) language sql immutable
set search_path=public,pg_temp as $$
 with rows as (
 select (n-1)::integer idx,r from jsonb_array_elements(coalesce(p_report->'exceptions','[]')) with ordinality x(r,n)
 ), candidates as (
 select a.idx warning_index,b.idx source_index,
 count(*) over(partition by a.idx) candidates,
 count(*) over(partition by b.idx) warnings
 from rows a join rows b on a.idx<>b.idx
 and a.r->>'bo_raw'=b.r->>'bo_raw'
 and a.r->>'company'=b.r->>'company' and a.r->>'account'=b.r->>'account'
 and a.r->>'business_date'=b.r->>'business_date' and a.r->>'direction'=b.r->>'direction'
 and a.r->>'system_amount'=b.r->>'system_amount'
 where a.r->>'ex_type'='cross_day' and b.r->>'ex_type'='cross_day'
 and a.r->>'stm_raw'='— ตรวจจากรายงานหลังบ้าน ไม่ต้องใช้ statement —'
 and a.r#>'{customer_details,source_rows}'=jsonb_build_object('bo',null,'stm',null)
 and a.r->>'system_amount'=a.r->>'bank_amount'
 and a.r->>'bo_raw' ~ '^[0-9]+ [|] '
 and trim(split_part(a.r->>'bo_raw','|',4)) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and b.r#>>'{customer_details,source_rows,bo,fileId}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and b.r#>>'{customer_details,source_rows,bo,row}' ~ '^[0-9]+$'
 and coalesce(b.r#>'{customer_details,source_rows,stm}','null')='null'::jsonb
 and coalesce(b.r->'bank_amount','null')='null'::jsonb
 ) select warning_index,source_index from candidates where candidates=1 and warnings=1
$$;

create or replace function public.manual_primary_report_projection(p_report jsonb)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
 with links as materialized(select * from public.manual_primary_bo_timing_links(p_report)),
 rows as (select (n-1)::integer idx,r from jsonb_array_elements(coalesce(p_report->'exceptions','[]')) with ordinality x(r,n)),
 projected as (
 select idx,case when exists(select 1 from links where source_index=idx)
 then jsonb_set(r,'{customer_details}',coalesce(r->'customer_details','{}')||jsonb_build_object('bo_timing_annotations',
 (select jsonb_agg(jsonb_build_object('original_index',w.idx,'original_warning',w.r,
 'source_rows',r#>'{customer_details,source_rows}') order by w.idx) from links l join rows w on w.idx=l.warning_index where l.source_index=rows.idx)))
 else r end r from rows where not exists(select 1 from links where warning_index=idx)
 ) select case when not exists(select 1 from links) then p_report else
 jsonb_set(jsonb_set(p_report,'{exceptions}',(select coalesce(jsonb_agg(r order by idx),'[]') from projected)),
 '{summary}',coalesce(p_report->'summary','{}')||jsonb_build_object('bo_timing_annotation_count',(select count(*) from links),
 'original_exception_count',jsonb_array_length(p_report->'exceptions'),'bo_timing_projection_version',1)) end
$$;
revoke all on function public.manual_primary_bo_timing_links(jsonb),public.manual_primary_report_projection(jsonb) from public,anon,authenticated;

-- Patch reviewed production functions, not table contents. The local q record
-- is projected only after reading the original; all stale/source/auth gates stay.
do $$declare d text;signature text;
begin
 foreach signature in array array['public.manual_primary_preview(uuid)',
 'public.accept_manual_primary(uuid,text,text,boolean)'] loop
 d:=pg_get_functiondef(signature::regprocedure);
 if position('q.result:=public.manual_primary_report_projection(q.result);' in d)=0 then
 if position(' select * into q from public.account_recheck_jobs where id=p_id;' in d)=0 then raise exception 'Unreviewed primary definition: %',signature;end if;
 d:=replace(d,' select * into q from public.account_recheck_jobs where id=p_id;',
 ' select * into q from public.account_recheck_jobs where id=p_id; q.result:=public.manual_primary_report_projection(q.result);');
 -- Acceptance re-reads under the row lock: project that local record too.
 d:=replace(d,'select * into q from public.account_recheck_jobs where id=p_id for update;',
 'select * into q from public.account_recheck_jobs where id=p_id for update; q.result:=public.manual_primary_report_projection(q.result);');
 if signature='public.manual_primary_preview(uuid)' then
 d:=replace(d,'files:=public.effective_audit_source_files',
 $patch$if exists(select 1 from jsonb_array_elements(coalesce(q.result->'exceptions','[]')) e
 where coalesce(e#>>'{customer_details,source_rows,bo,fileId}',e#>>'{customer_details,source_rows,stm,fileId}') is null)
 then problems:=array_append(problems,'เคสไม่มีแถว BO/STM จริงที่พิสูจน์ได้ ห้ามยืนยันผลหลัก');end if;
 files:=public.effective_audit_source_files$patch$);
 d:=replace(d,$needle$'file_count',jsonb_array_length(stamp)$needle$,
 $patch$'bo_timing_annotation_count',coalesce((q.result#>>'{summary,bo_timing_annotation_count}')::integer,0),
 'file_count',jsonb_array_length(stamp)$patch$);
 end if;
 execute d;
 end if;
 end loop;
 d:=pg_get_functiondef('public.manual_primary_cases_preview(uuid)'::regprocedure);
 if position('q.result=v.report' in d)=0 and position('manual_primary_report_projection(q.result)=v.report' in d)=0 then raise exception 'Unreviewed case preview definition';end if;
 execute replace(d,'q.result=v.report','public.manual_primary_report_projection(q.result)=v.report');
 d:=pg_get_functiondef('public.activate_manual_primary_cases(uuid,text,text,boolean)'::regprocedure);
 if position('ไม่มีแถว BO/STM จริง' in d)=0 then
 if position(' k:=md5(' in d)=0 then raise exception 'Unreviewed activation definition';end if;
 execute replace(d,' k:=md5(',
 $patch$ if coalesce(r#>>'{customer_details,source_rows,bo,fileId}',r#>>'{customer_details,source_rows,stm,fileId}') is null
 then raise exception 'ไม่มีแถว BO/STM จริง ห้ามสร้างเคส';end if;
 k:=md5($patch$);
 end if;
end$$;
notify pgrst,'reload schema';
commit;
