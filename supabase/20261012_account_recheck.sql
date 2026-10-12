-- Isolated staged results. No financial amounts, evidence or case state is changed.
-- Worker RPCs are service_role-only. Confirmation is lead/admin only.
begin;
create table public.account_recheck_jobs (
 id uuid primary key default gen_random_uuid(),
 company text not null,business_date date not null,account text not null,
 direction text not null check(direction in ('all','deposit','withdraw')),
 mode text not null check(mode in ('compare','account')),
 status text not null default 'queued' check(status in ('queued','running','ready','failed','confirmed','stale')),
 request_key uuid not null unique,requested_by uuid not null references auth.users(id),
 base_run_id uuid not null references public.recon_runs(id),
 snapshot jsonb not null,selected_file_ids uuid[] not null default '{}',result jsonb,error text,revision integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 lease_expires_at timestamptz not null default now()+interval '5 minutes',worker_execution_id text,
 attempt_count integer not null default 0 check(attempt_count between 0 and 3),
 confirmed_by uuid references auth.users(id),confirmed_at timestamptz,confirmation_reason text,
 check((status='confirmed')=(confirmed_by is not null and confirmed_at is not null and length(confirmation_reason)>=10))
);
-- Conservative company-day mutex: an 'all' scope may never race a single direction.
create unique index account_recheck_busy on public.account_recheck_jobs(company,business_date)
 where status in ('queued','running');
alter table public.account_recheck_jobs enable row level security;
create policy account_recheck_read on public.account_recheck_jobs for select to authenticated
 using(public.current_user_active() and public.current_app_role() in ('monitor','lead','admin') and public.has_company_access(company));
grant select on public.account_recheck_jobs to authenticated;
revoke insert,update,delete on public.account_recheck_jobs from authenticated,anon;

create function public.expire_account_rechecks(p_company text,p_date date) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.account_recheck_jobs set status='failed',error='งานหมดเวลา กรุณาตรวจสถานะก่อนลองใหม่',revision=revision+1,updated_at=now()
 where company=p_company and business_date=p_date and status in ('queued','running') and lease_expires_at<now();
end $$;
revoke all on function public.expire_account_rechecks(text,date) from public,anon,authenticated;

create function public.account_recheck_snapshot(p_company text,p_date date) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
 'job',coalesce((select jsonb_build_object('id',id,'last_run_id',last_run_id) from public.daily_recon_jobs
  where company=p_company and business_date=p_date and not is_archived),'{}'),
 'files',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('ocr',
  (select coalesce(jsonb_agg(to_jsonb(o) order by o.source_file_id),'[]') from public.source_file_ocr o where o.source_file_id=f.id)) order by f.id) from public.source_files f
  join public.mail_batches b on b.id=f.batch_id where f.company=p_company and b.business_date between p_date and p_date+1
  and f.kind in ('bo_main','stm_pdf','pm_statement')),'[]'),
 'cases',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.exceptions e
  where e.company=p_company and e.business_date=p_date),'[]'),
 'evidence',coalesce((select jsonb_agg(to_jsonb(ce) order by ce.id) from public.case_evidence ce
  join public.exceptions e on e.id=ce.exception_id where e.company=p_company and e.business_date=p_date),'[]'))
$$;
-- Snapshot is internal only: callers cannot use it to read another company's data.
revoke all on function public.account_recheck_snapshot(text,date) from public,anon,authenticated;

create function public.request_account_recheck(p_company text,p_date date,p_account text,p_direction text,p_mode text,p_request_key uuid,p_file_ids uuid[] default null)
returns public.account_recheck_jobs language plpgsql security definer set search_path=public as $$
declare j public.daily_recon_jobs%rowtype;q public.account_recheck_jobs%rowtype;s jsonb;plan jsonb;chosen uuid[];
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false)
  or coalesce(public.current_app_role(),'') not in ('monitor','lead','admin') then raise exception 'ไม่มีสิทธิ์สั่งตรวจ';end if;
 if p_direction not in ('all','deposit','withdraw') or p_mode not in ('compare','account') or length(trim(p_account)) not between 1 and 100
 then raise exception 'ขอบเขตไม่ถูกต้อง';end if;
 select * into q from public.account_recheck_jobs where request_key=p_request_key;
 if found then
  if q.requested_by<>auth.uid() or q.company<>p_company or q.business_date<>p_date or q.account<>p_account
   or q.direction<>p_direction or q.mode<>p_mode or (p_file_ids is not null and q.selected_file_ids<>p_file_ids) then raise exception 'Request key conflict';end if;return q;
 end if;
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived for update;
 perform public.expire_account_rechecks(p_company,p_date);
 if not found or j.last_run_id is null then raise exception 'ยังไม่มีผลรอบเดิมให้เปรียบเทียบ';end if;
 if j.status='running' or (j.status='queued' and not exists(select 1 from public.audit_run_holds where company=p_company and business_date=p_date and paused)) then raise exception 'บอทกำลังใช้วัน/บริษัทนี้ กรุณารอให้จบก่อน';end if;
 s:=public.account_recheck_snapshot(p_company,p_date);
 plan:=public.effective_audit_source_files(p_company,p_date);
 chosen:=coalesce(p_file_ids,array(select (f->>'id')::uuid from jsonb_array_elements(plan) f where not (f->>'excluded')::boolean and f->>'kind' in ('bo_main','stm_pdf','pm_statement')));
 if cardinality(chosen)=0 or cardinality(chosen)>500 or cardinality(chosen)<>(select count(distinct id) from unnest(chosen) id)
 or exists(select 1 from unnest(chosen) id where not exists(select 1 from jsonb_array_elements(plan) f where (f->>'id')::uuid=id and not (f->>'excluded')::boolean and f->>'kind' in ('bo_main','stm_pdf','pm_statement')))
 then raise exception 'ไฟล์ที่เลือกไม่มีสิทธิ์ อยู่นอกบริษัท/วัน หรือถูกกักไว้';end if;
 if not exists(select 1 from jsonb_array_elements(plan) f where (f->>'id')::uuid=any(chosen) and f->>'kind'='bo_main')
 or not exists(select 1 from jsonb_array_elements(plan) f where (f->>'id')::uuid=any(chosen) and f->>'kind' in ('stm_pdf','pm_statement'))
 then raise exception 'ต้องเลือกหลักฐานทั้ง STM/PM และ BO ไม่ถือว่าไฟล์ขาดเป็นยอดศูนย์';end if;
 if exists(select 1 from jsonb_array_elements(plan) f where (f->>'id')::uuid=any(chosen) and nullif(f->>'checksum','') is not null group by f->>'checksum',f->>'kind' having count(*)>1)
 then raise exception 'เลือกไฟล์เนื้อหาซ้ำกัน กรุณาเลือกเพียงหนึ่งฉบับ';end if;
 s:=s||jsonb_build_object('effective_files',plan);
 if p_account<>'ALL' and not exists(select 1 from public.recon_runs r,jsonb_array_elements(coalesce(r.summary->'bo_first'->'required','[]')) c
  where r.id=j.last_run_id and c->>'identity'=p_account)
  and not exists(select 1 from public.exceptions e where e.run_id=j.last_run_id and e.account=p_account)
  and not exists(select 1 from public.recon_runs r,jsonb_array_elements(coalesce(r.summary->'match_evidence','[]')) c
   where r.id=j.last_run_id and c->>'account'=p_account)
 then raise exception 'บัญชีไม่อยู่ในผลบริษัท/วันที่นี้';end if;
 insert into public.account_recheck_jobs(company,business_date,account,direction,mode,request_key,requested_by,base_run_id,snapshot,selected_file_ids)
 values(p_company,p_date,p_account,p_direction,p_mode,p_request_key,auth.uid(),j.last_run_id,s,chosen) returning * into q;
 insert into public.audit_log(actor,action,entity,target,company,detail)
 values(auth.uid()::text,'account_recheck_requested','account_recheck',q.id::text,p_company,'ตรวจเฉพาะบัญชี ไม่เปิดหรือปิดเคส');
 return q;
end $$;

create function public.claim_account_recheck(p_id uuid,p_execution_id text) returns public.account_recheck_jobs
language plpgsql security definer set search_path=public as $$
declare q public.account_recheck_jobs%rowtype;j public.daily_recon_jobs%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker only';end if;
 if length(coalesce(p_execution_id,'')) not between 1 and 150 then raise exception 'Worker execution ID required';end if;
 select * into q from public.account_recheck_jobs where id=p_id;
 if not found then raise exception 'ไม่พบงาน';end if;
 select * into j from public.daily_recon_jobs where company=q.company and business_date=q.business_date and not is_archived for update;
 perform public.expire_account_rechecks(q.company,q.business_date);
 select * into q from public.account_recheck_jobs where id=p_id for update;
 if q.status<>'queued' then raise exception 'งานถูกจองหรือทำเสร็จแล้ว';end if;
 if (j.status='running' or (j.status='queued' and not exists(select 1 from public.audit_run_holds where company=q.company and business_date=q.business_date and paused))) or j.last_run_id<>q.base_run_id
  or (public.account_recheck_snapshot(q.company,q.business_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(q.company,q.business_date))) is distinct from q.snapshot
 then raise exception 'ข้อมูลเปลี่ยนหรือมีงานบอทซ้อน';end if;
 update public.account_recheck_jobs set status='running',revision=revision+1,updated_at=now(),
  lease_expires_at=now()+interval '30 minutes',worker_execution_id=p_execution_id,attempt_count=attempt_count+1
  where id=p_id returning * into q;
 return q;
end $$;

create function public.finish_account_recheck(p_id uuid,p_revision integer,p_result jsonb,p_error text default null)
returns public.account_recheck_jobs language plpgsql security definer set search_path=public as $$
declare q public.account_recheck_jobs%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker only';end if;
 select * into q from public.account_recheck_jobs where id=p_id for update;
 if not found or q.status<>'running' or q.revision<>p_revision or q.lease_expires_at<now() then raise exception 'งานหรือ revision เปลี่ยนแล้วหรือหมดเวลา';end if;
 if p_error is null then
  if p_result is null or not (p_result ?& array['quality','company','account','direction','business_date','exceptions','match_evidence','stm_count','bo_count','matched'])
   or (p_result->>'quality') is distinct from 'passed' or (p_result->>'company') is distinct from q.company or (p_result->>'account') is distinct from q.account
   or (p_result->>'direction') is distinct from q.direction or (p_result->>'business_date') is distinct from q.business_date::text
   or jsonb_typeof(p_result->'exceptions') is distinct from 'array' or jsonb_typeof(p_result->'match_evidence') is distinct from 'array'
   or (p_result->>'stm_count')::integer<0 or (p_result->>'bo_count')::integer<0
   or (p_result->>'matched')::integer<>jsonb_array_length(p_result->'match_evidence')
   or (p_result->>'matched')::integer>least((p_result->>'stm_count')::integer,(p_result->>'bo_count')::integer)
   or octet_length(p_result::text)>33554432
  then raise exception 'ผลตรวจไม่ครบ/ผิดขอบเขต';end if;
  if exists(select 1 from jsonb_array_elements(p_result->'exceptions') e
   where (e->>'company') is distinct from q.company or (q.account<>'ALL' and (e->>'account') is distinct from q.account) or (q.direction<>'all' and (e->>'direction') is distinct from q.direction))
   or exists(select 1 from jsonb_array_elements(p_result->'match_evidence') e
   where (e->>'company') is distinct from q.company or (q.account<>'ALL' and (e->>'account') is distinct from q.account) or (q.direction<>'all' and (e->>'direction') is distinct from q.direction))
  then raise exception 'ผลมีรายการนอกบัญชีที่สั่ง';end if;
 end if;
 update public.account_recheck_jobs set result=case when p_error is null then p_result else null end,
  status=case when p_error is not null then 'failed'
   when (public.account_recheck_snapshot(q.company,q.business_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(q.company,q.business_date))) is distinct from q.snapshot then 'stale' else 'ready' end,
  error=p_error,revision=revision+1,updated_at=now() where id=p_id returning * into q;
 return q;
end $$;
revoke all on function public.claim_account_recheck(uuid,text),public.finish_account_recheck(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_account_recheck(uuid,text),public.finish_account_recheck(uuid,integer,jsonb,text) to service_role;

create function public.fail_account_recheck_execution(p_execution_id text,p_error text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker only';end if;
 update public.account_recheck_jobs set status='failed',error=left(coalesce(p_error,'Worker error'),2000),revision=revision+1,updated_at=now()
 where worker_execution_id=p_execution_id and status='running';
end $$;
revoke all on function public.fail_account_recheck_execution(text,text) from public,anon,authenticated;
grant execute on function public.fail_account_recheck_execution(text,text) to service_role;

create function public.confirm_account_recheck(p_id uuid,p_expected_revision integer,p_reason text,p_reviewed boolean)
returns public.account_recheck_jobs language plpgsql security definer set search_path=public as $$
declare q public.account_recheck_jobs%rowtype;j public.daily_recon_jobs%rowtype;
begin
 if coalesce(public.current_app_role(),'') not in ('lead','admin') or not coalesce(public.current_user_active(),false)
 then raise exception 'เฉพาะหัวหน้าและผู้ดูแลระบบยืนยันผลได้';end if;
 -- Same lock order as request/worker: company-day first, scoped job second.
 select * into q from public.account_recheck_jobs where id=p_id;
 if not found or not coalesce(public.has_company_access(q.company),false) then raise exception 'ไม่พบงานหรือไม่มีสิทธิ์';end if;
 select * into j from public.daily_recon_jobs where company=q.company and business_date=q.business_date and not is_archived for update;
 select * into q from public.account_recheck_jobs where id=p_id for update;
 if q.status='confirmed' then return q;end if;
 if q.mode<>'account' or q.status<>'ready' or q.revision<>p_expected_revision or not coalesce(p_reviewed,false)
  or length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'ต้องทบทวนผลล่าสุดและระบุเหตุผล';end if;
 if (j.status='running' or (j.status='queued' and not exists(select 1 from public.audit_run_holds where company=q.company and business_date=q.business_date and paused))) or j.last_run_id<>q.base_run_id
  or (public.account_recheck_snapshot(q.company,q.business_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(q.company,q.business_date))) is distinct from q.snapshot
 then raise exception 'ผลรอบเดิม ไฟล์ หรือเคสเปลี่ยนแล้ว ต้องตรวจซ้ำ';end if;
 if q.result is null or coalesce(q.result->>'quality','')<>'passed'
 then raise exception 'ยังไม่ผ่านตรวจความครบถ้วน';end if;
 update public.account_recheck_jobs set status='confirmed',confirmed_by=auth.uid(),confirmed_at=now(),
  confirmation_reason=trim(p_reason),revision=revision+1,updated_at=now() where id=p_id returning * into q;
 -- Acceptance is a separate account result, never a full-company replacement.
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values(auth.uid()::text,'account_recheck_confirmed','account_recheck',q.id::text,q.company,trim(p_reason),
 jsonb_build_object('base_run_id',q.base_run_id,'account',q.account,'direction',q.direction,'cases_closed',0));
 return q;
end $$;
revoke all on function public.request_account_recheck(text,date,text,text,text,uuid,uuid[]),public.confirm_account_recheck(uuid,integer,text,boolean) from public,anon;
grant execute on function public.request_account_recheck(text,date,text,text,text,uuid,uuid[]),public.confirm_account_recheck(uuid,integer,text,boolean) to authenticated;
create function public.list_account_rechecks(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false)
 or coalesce(public.current_app_role(),'') not in ('monitor','lead','admin') then raise exception 'ไม่มีสิทธิ์อ่านผลตรวจซ้ำ';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'company',q.company,'business_date',q.business_date,
 'account',q.account,'direction',q.direction,'mode',q.mode,
 'status',case when q.status in ('queued','running') and q.lease_expires_at<now() then 'failed' else q.status end,
 'revision',q.revision,'error',case when q.status in ('queued','running') and q.lease_expires_at<now() then 'งานหมดเวลา ตรวจสถานะแล้วสั่งใหม่ได้' else q.error end,
 'created_at',q.created_at,'lease_expires_at',q.lease_expires_at,'base_run_id',q.base_run_id,
 'confirmed_at',q.confirmed_at,'confirmed_by',q.confirmed_by,'confirmation_reason',q.confirmation_reason,
 'base_is_current',q.base_run_id=j.last_run_id,
 'result',case when q.result is null then null else jsonb_build_object('stm_count',q.result->'stm_count',
 'bo_count',q.result->'bo_count','matched',q.result->'matched','exception_count',jsonb_array_length(q.result->'exceptions')) end
 ) order by q.created_at desc),'[]') from (select * from public.account_recheck_jobs where company=p_company and business_date=p_date order by created_at desc limit 50) q
 left join public.daily_recon_jobs j on j.company=q.company and j.business_date=q.business_date and not j.is_archived);
end $$;
revoke all on function public.list_account_rechecks(text,date) from public,anon;
grant execute on function public.list_account_rechecks(text,date) to authenticated;
notify pgrst,'reload schema';
commit;
