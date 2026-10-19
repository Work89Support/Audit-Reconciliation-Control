-- Definitions/read-only diagnostics only. No queue, source, case or hold writes.
begin;
set local lock_timeout='5s';
create table if not exists public.audit_run_preflight_drafts(
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.daily_recon_jobs(id),
 company text not null,business_date date not null,source_token text not null,
 result jsonb not null,exceptions jsonb not null,warnings jsonb not null,
 created_at timestamptz not null default now(),unique(job_id,source_token)
);
alter table public.audit_run_preflight_drafts enable row level security;
revoke all on public.audit_run_preflight_drafts from public,anon,authenticated;
create or replace function public.audit_run_preflight_review(p_company text,p_date date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare j public.daily_recon_jobs; r public.recon_runs; draft public.audit_run_preflight_drafts; warnings jsonb:='[]'; arrivals jsonb:='[]';
begin
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived;
 if j.last_run_id is not null then select * into r from public.recon_runs where id=j.last_run_id and company=p_company and business_date=p_date;
 elsif j.id is not null then select * into r from public.recon_runs where company=p_company and business_date=p_date
 and summary->>'job_id'=j.id::text order by created_at desc,id desc limit 1;end if;
 select * into draft from public.audit_run_preflight_drafts where job_id=j.id order by created_at desc,id desc limit 1;
 with files as (
 select f.id,coalesce(v.effective_name,f.file_name) name,coalesce(v.kind,f.kind) kind,
 coalesce(v.business_date,b.business_date) effective_day,case when v.id is null then f.parse_error else null end error,
 coalesce(v.replacement_file_id,f.id) physical_id,f.created_at
 from public.source_files f join public.mail_batches b on b.id=f.batch_id
 left join lateral(select * from public.audit_source_revisions where source_file_id=f.id order by revision desc limit 1) v on true
 where coalesce(v.company,f.company,b.company)=p_company and coalesce(v.business_date,b.business_date)=p_date
 and not coalesce(v.excluded,false) and not exists(select 1 from public.audit_source_revisions parent where parent.replacement_file_id=f.id)
 ), notices as (
 select 'file_day_mismatch' code,id,name,substring(name from '20[0-9]{2}-[0-9]{2}-[0-9]{2}') detail
 from files where kind in ('bo_main','stm_pdf','pm_statement') and substring(name from '20[0-9]{2}-[0-9]{2}-[0-9]{2}') is not null
 and substring(name from '20[0-9]{2}-[0-9]{2}-[0-9]{2}')<>effective_day::text
 union all select 'parse_error',id,name,error from files where nullif(error,'') is not null
 union all select 'files_after_run',id,name,'มีไฟล์ใหม่หลังผลรันเดิม ต้องทบทวนก่อนรันต่อ' from files
 where r.id is not null and created_at>r.created_at and not(physical_id=any(coalesce(r.file_ids,'{}'::uuid[])))
 and kind in ('bo_main','stm_pdf','pm_statement','manual_credit','manual_payment','manual_bonus','comm_req','credit_out')
 ) select coalesce(jsonb_agg(jsonb_build_object('code',code,'file_id',id,'file_name',name,'detail',detail) order by code,name,id),'[]') into warnings from notices;
 if exists(select 1 from public.audit_run_holds where company=p_company and business_date=p_date and paused)
 or public.audit_source_scope_managed(p_company,p_date) then
 warnings:=warnings||jsonb_build_array(jsonb_build_object('code','source_held','detail','รอบนี้พักรันหรือมีเวอร์ชันแก้ไข ต้องให้คนทบทวนก่อน'));
 end if;
 if r.id is not null then
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'code',e.code,'source_date',e.business_date,'report_date',r.business_date,
 'account',e.account,'direction',e.direction,'amount',e.system_amount,'status',e.status,'run_id',e.run_id,
 'source_rows',e.customer_details->'source_rows','read_only',true) order by e.business_date,e.occurred_at,e.id),'[]') into arrivals
 from public.exceptions e where e.run_id=r.id and e.company=p_company and e.business_date<>p_date
 and e.ex_type='cross_day' and e.superseded_by_exception_id is null;
 end if;
 if jsonb_array_length(arrivals)>0 then warnings:=warnings||jsonb_build_array(jsonb_build_object(
 'code','cross_day_scope','detail','มีรายการคนละวันในผลรัน ต้องตรวจแถวจริงและคิวเดิมก่อนดำเนินการ ไม่ตัดทิ้งหรือสร้างซ้ำ','count',jsonb_array_length(arrivals)));end if;
 if draft.id is not null then
 warnings:=warnings||draft.warnings;
 select arrivals||coalesce(jsonb_agg(jsonb_build_object('code',e->>'code','source_date',e->>'business_date','report_date',p_date,
 'account',e->>'account','direction',e->>'direction','amount',e->'system_amount','source_rows',e#>'{customer_details,source_rows}',
 'draft_id',draft.id,'read_only',true,'persisted_case',false)),'[]') into arrivals
 from jsonb_array_elements(draft.exceptions) e where e->>'business_date' is distinct from p_date::text;
 end if;
 return jsonb_build_object('version',1,'blocked',jsonb_array_length(warnings)>0,'warnings',warnings,
 'cross_day_queue',arrivals,'run_id',r.id,'draft_id',draft.id,'review_mode','warnings_only','read_only',true);
end $$;
revoke all on function public.audit_run_preflight_review(text,date) from public,anon,authenticated;
grant execute on function public.audit_run_preflight_review(text,date) to service_role;

-- Called by the main worker AFTER read/quality checks and BEFORE creating a
-- run or cases. A warning stores a report draft only and releases the job.
create or replace function public.stage_daily_recon_preflight(p_job_id uuid,p_result jsonb,p_exceptions jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.daily_recon_jobs; warnings jsonb; draft_id uuid; token text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker service role required';end if;
 select * into strict j from public.daily_recon_jobs where id=p_job_id for update;
 if jsonb_typeof(p_exceptions)<>'array' or jsonb_typeof(p_result->'file_ids')<>'array'
 or jsonb_array_length(p_result->'file_ids')=0 then raise exception 'Missing report/source receipt';end if;
 token:=md5(jsonb_build_object('result',p_result,'exceptions',p_exceptions)::text);
 select id into draft_id from public.audit_run_preflight_drafts where job_id=j.id and source_token=token;
 if j.status='needs_review' and draft_id is not null then return jsonb_build_object('proceed',false,'draft_id',draft_id,'replayed',true,'case_writes',0);end if;
 if j.status<>'running' or j.is_archived then raise exception 'Job is not an active worker lease';end if;
 if exists(select 1 from jsonb_array_elements_text(p_result->'file_ids') fid
 where not exists(select 1 from public.source_files f join public.mail_batches b on b.id=f.batch_id
 where f.id::text=fid and coalesce(f.company,b.company)=j.company)) then raise exception 'Source company mismatch';end if;
 if exists(select 1 from jsonb_array_elements(p_exceptions) e where e->>'company' is distinct from j.company)
 then raise exception 'Report company mismatch';end if;
 warnings:=public.audit_run_preflight_review(j.company,j.business_date)->'warnings';
 if exists(select 1 from jsonb_array_elements(p_exceptions) e where e->>'business_date' is distinct from j.business_date::text) then
 warnings:=warnings||jsonb_build_array(jsonb_build_object('code','cross_day_scope','detail','อ่านรายการคนละวันแล้ว พักเป็นรายงานรอทบทวนก่อนสร้างเคสหรือเปลี่ยนผลหลัก'));
 end if;
 if jsonb_array_length(warnings)=0 then return jsonb_build_object('proceed',true,'warnings','[]'::jsonb);end if;
 insert into public.audit_run_preflight_drafts(job_id,company,business_date,source_token,result,exceptions,warnings)
 values(j.id,j.company,j.business_date,token,p_result,p_exceptions,warnings)
 on conflict(job_id,source_token) do nothing returning id into draft_id;
 if draft_id is null then select id into draft_id from public.audit_run_preflight_drafts where job_id=j.id and source_token=token;end if;
 update public.daily_recon_jobs set status='needs_review',claimed_at=null,claimed_by=null,
 last_error='อ่านแล้วพักรอคนทบทวนคำเตือน ยังไม่สร้างผลรันหรือเคสใหม่',updated_at=now() where id=j.id;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values('system:worker-preflight','worker_report_held_before_case_writes','daily_recon_jobs',j.id::text,j.company,
 'พักเฉพาะเมื่อพบคำเตือน เก็บผลอ่านรอคนตัดสินใจ ไม่สร้างเคส ไม่ใช้ผลหลัก ไม่เปลี่ยนยอดหรือสถานะเคส',
 jsonb_build_object('draft_id',draft_id,'source_token',token,'warnings',warnings,'case_writes',0));
 return jsonb_build_object('proceed',false,'draft_id',draft_id,'warnings',warnings,'case_writes',0);
end $$;
revoke all on function public.stage_daily_recon_preflight(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.stage_daily_recon_preflight(uuid,jsonb,jsonb) to service_role;

do $patch$ declare d text;needle text;
begin
 d:=pg_get_functiondef('public.audit_run_blocked(text,date)'::regprocedure);
 if position('audit_run_preflight_review' in d)=0 then
 needle:='select exists(';
 if (length(d)-length(replace(d,needle,'')))/length(needle)<>1 or position('audit_source_scope_managed' in d)=0
 then raise exception 'Unreviewed run-blocked definition';end if;
 execute replace(d,needle,'select coalesce((public.audit_run_preflight_review(p_company,p_date)->>''blocked'')::boolean,true) or exists(');
 end if;
 d:=pg_get_functiondef('public.file_run_management_state(text,date)'::regprocedure);
 if position('''preflight''' in d)=0 then
 needle:='return jsonb_build_object(';
 if (length(d)-length(replace(d,needle,'')))/length(needle)<>1 or position('current_user_active()' in d)=0 or position('has_company_access(p_company)' in d)=0
 then raise exception 'Unreviewed file-management definition';end if;
 execute replace(d,needle,'return jsonb_build_object(''preflight'',public.audit_run_preflight_review(p_company,p_date),');
 end if;
end $patch$;
notify pgrst,'reload schema';
commit;
