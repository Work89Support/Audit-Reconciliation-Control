-- Preserve unresolved cases across reruns and close them only from unique match evidence.
-- The historical exception row is never deleted. Every carry/closure is appended to audit_log.
begin;
set local lock_timeout = '5s';

alter table public.exceptions
  add column if not exists lifecycle_key text,
  add column if not exists previous_exception_id uuid references public.exceptions(id) on delete set null,
  add column if not exists superseded_by_exception_id uuid references public.exceptions(id) on delete set null,
  add column if not exists closing_run_id uuid references public.recon_runs(id) on delete set null,
  add column if not exists closure_rule text;

create index if not exists exceptions_lifecycle_key_idx
  on public.exceptions(run_id, lifecycle_key);
create index if not exists exceptions_previous_idx
  on public.exceptions(previous_exception_id);
create index if not exists exceptions_superseded_idx
  on public.exceptions(superseded_by_exception_id);

create or replace function public.recon_exception_lifecycle_key(p_exception public.exceptions)
returns text language sql immutable set search_path=public as $$
  select md5(concat_ws('|',
    upper(trim(coalesce(p_exception.company,''))),
    coalesce(p_exception.business_date::text,''),
    lower(trim(coalesce(p_exception.ex_type,''))),
    upper(trim(coalesce(p_exception.account,''))),
    trim(coalesce(p_exception.direction,'')),
    coalesce(p_exception.bank_amount,p_exception.system_amount,0)::text,
    trim(coalesce(p_exception.stm_raw,'')),
    trim(coalesce(p_exception.bo_raw,''))
  ))
$$;

create or replace function public.finish_daily_recon_job(p_job_id uuid,p_run_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_job public.daily_recon_jobs%rowtype;
  v_old_run_id uuid;
  v_old public.exceptions%rowtype;
  v_current public.exceptions%rowtype;
  v_new_id uuid;
  v_payload jsonb;
  v_evidence_count integer;
  v_candidate_count integer;
  v_missing_bo_count integer;
  v_missing_stm_count integer;
  v_cross_day_count integer;
  v_amount numeric;
begin
  select * into v_job from public.daily_recon_jobs where id=p_job_id for update;
  if not found then raise exception 'ไม่พบงานกระทบยอด %', p_job_id; end if;
  if not exists(
    select 1 from public.recon_runs r
    where r.id=p_run_id and r.business_date=v_job.business_date
      and upper(coalesce(r.company,''))=upper(coalesce(v_job.company,''))
  ) then raise exception 'ผลรันไม่ตรงบริษัทหรือวันที่ของงาน'; end if;

  v_old_run_id := v_job.last_run_id;

  update public.exceptions e
     set lifecycle_key=public.recon_exception_lifecycle_key(e)
   where e.run_id=p_run_id and e.lifecycle_key is null;

  if v_old_run_id is not null and v_old_run_id<>p_run_id then
    update public.exceptions e
       set lifecycle_key=public.recon_exception_lifecycle_key(e)
     where e.run_id=v_old_run_id and e.lifecycle_key is null;

    for v_old in
      select * from public.exceptions e
       where e.run_id=v_old_run_id
         and e.status in ('open','clarifying','answered')
         and e.superseded_by_exception_id is null
       order by e.created_at,e.id
       for update
    loop
      select * into v_current from public.exceptions e
       where e.run_id=p_run_id and e.lifecycle_key=v_old.lifecycle_key
       order by e.created_at,e.id limit 1;

      if found then
        -- Same unresolved source is still present: continue the workflow on the new run.
        update public.exceptions set
          previous_exception_id=v_old.id,
          status=case when v_old.status in ('clarifying','answered') then v_old.status else status end,
          assigned_to=coalesce(v_old.assigned_to,assigned_to),
          requested_by=coalesce(v_old.requested_by,requested_by),
          requested_at=coalesce(v_old.requested_at,requested_at),
          responded_by=coalesce(v_old.responded_by,responded_by),
          response_text=coalesce(v_old.response_text,response_text),
          responded_at=coalesce(v_old.responded_at,responded_at),
          clarification_file_id=coalesce(v_old.clarification_file_id,clarification_file_id),
          updated_at=now()
        where id=v_current.id;
        update public.exceptions set superseded_by_exception_id=v_current.id,updated_at=now() where id=v_old.id;
        insert into public.audit_log(actor,action,entity,target,detail,meta)
        values('system:exception-lifecycle-v1','exception_carried_forward','exception',v_current.id::text,
          'เคสเดิมยังไม่คลี่คลาย จึงยกสถานะและหลักฐานมารอบใหม่โดยไม่ลบประวัติ',
          jsonb_build_object('previous_exception_id',v_old.id,'from_run_id',v_old_run_id,'to_run_id',p_run_id,'lifecycle_key',v_old.lifecycle_key));
        continue;
      end if;

      v_amount := coalesce(v_old.bank_amount,v_old.system_amount,0);
      select count(*) into v_evidence_count
      from public.recon_runs r
      cross join lateral jsonb_array_elements(coalesce(r.summary->'match_evidence','[]'::jsonb)) ev
      where r.id=p_run_id
        and upper(coalesce(ev->>'company',v_job.company))=upper(coalesce(v_old.company,''))
        and upper(trim(coalesce(ev->>'account','')))=upper(trim(coalesce(v_old.account,'')))
        and (case lower(coalesce(ev->>'direction','')) when 'deposit' then 'ฝาก' when 'withdraw' then 'ถอน' else ev->>'direction' end)=v_old.direction
        and case when coalesce(ev->>'amount','') ~ '^-?[0-9]+([.][0-9]+)?$' then (ev->>'amount')::numeric else null end=v_amount;

      select count(*),
             count(*) filter(where e.ex_type='missing_bo'),
             count(*) filter(where e.ex_type='missing_stm'),
             count(*) filter(where e.ex_type='cross_day')
        into v_candidate_count,v_missing_bo_count,v_missing_stm_count,v_cross_day_count
      from public.exceptions e
      where e.run_id=v_old_run_id and e.status in ('open','clarifying','answered')
        and e.superseded_by_exception_id is null
        and e.ex_type in ('missing_bo','missing_stm','cross_day')
        and upper(trim(coalesce(e.account,'')))=upper(trim(coalesce(v_old.account,'')))
        and e.direction=v_old.direction
        and coalesce(e.bank_amount,e.system_amount,0)=v_amount;

      if v_old.ex_type in ('missing_bo','missing_stm','cross_day')
         and v_evidence_count=1 and v_candidate_count between 1 and 2
         and v_missing_bo_count<=1 and v_missing_stm_count<=1 and v_cross_day_count<=1 then
        update public.exceptions set status='closed',auto_closed=true,resolved_at=now(),
          resolved_by='system:exception-lifecycle-v1',closing_run_id=p_run_id,
          closure_rule='unique-match-evidence',
          resolution_note='ปิดอัตโนมัติเมื่อรอบใหม่พบคู่ 1:1 บริษัท/บัญชี/ทิศทาง/ยอดตรงกัน; เก็บประวัติเดิมใน Audit Log',
          updated_at=now()
        where id=v_old.id;
        insert into public.audit_log(actor,action,entity,target,detail,meta)
        values('system:exception-lifecycle-v1','exception_auto_closed_on_rerun','exception',v_old.id::text,
          'รอบใหม่มีหลักฐานจับคู่ 1:1 จึงนำออกจากงานค้างและเก็บประวัติการปิด',
          jsonb_build_object('closing_run_id',p_run_id,'previous_run_id',v_old_run_id,'rule','unique-match-evidence'));
      else
        -- The row disappeared from the worker result without sufficient evidence. Keep it pending.
        v_new_id := gen_random_uuid();
        v_payload := to_jsonb(v_old) || jsonb_build_object(
          'id',v_new_id,'run_id',p_run_id,
          'code',left(coalesce(v_old.code,'EX')||'-C'||replace(v_new_id::text,'-',''),64),
          'previous_exception_id',v_old.id,'superseded_by_exception_id',null,
          'closing_run_id',null,'closure_rule',null,
          'created_at',now(),'updated_at',now()
        );
        insert into public.exceptions
        select (jsonb_populate_record(null::public.exceptions,v_payload)).*;
        update public.exceptions set superseded_by_exception_id=v_new_id,updated_at=now() where id=v_old.id;
        insert into public.audit_log(actor,action,entity,target,detail,meta)
        values('system:exception-lifecycle-v1','exception_carried_forward','exception',v_new_id::text,
          'รอบใหม่ยังไม่มีหลักฐานพอปิดเคส ระบบจึงคงรายการไว้ในงานปัจจุบัน',
          jsonb_build_object('previous_exception_id',v_old.id,'from_run_id',v_old_run_id,'to_run_id',p_run_id,'reason','no-unique-match-evidence'));
      end if;
    end loop;
  end if;

  -- A unique match in today's run may resolve yesterday's cross-day pending case.
  for v_old in
    select e.* from public.daily_recon_jobs j
    join public.exceptions e on e.run_id=j.last_run_id
    where j.company=v_job.company and j.business_date=v_job.business_date-1
      and e.ex_type='cross_day' and e.status in ('open','clarifying','answered')
      and e.superseded_by_exception_id is null
    order by e.created_at,e.id for update of e
  loop
    v_amount := coalesce(v_old.bank_amount,v_old.system_amount,0);
    select count(*) into v_evidence_count
    from public.recon_runs r
    cross join lateral jsonb_array_elements(coalesce(r.summary->'match_evidence','[]'::jsonb)) ev
    where r.id=p_run_id
      and upper(coalesce(ev->>'company',v_job.company))=upper(coalesce(v_old.company,''))
      and upper(trim(coalesce(ev->>'account','')))=upper(trim(coalesce(v_old.account,'')))
      and (case lower(coalesce(ev->>'direction','')) when 'deposit' then 'ฝาก' when 'withdraw' then 'ถอน' else ev->>'direction' end)=v_old.direction
      and case when coalesce(ev->>'amount','') ~ '^-?[0-9]+([.][0-9]+)?$' then (ev->>'amount')::numeric else null end=v_amount;
    select count(*) into v_candidate_count
    from public.daily_recon_jobs j
    join public.exceptions e on e.run_id=j.last_run_id
    where j.company=v_job.company and j.business_date=v_job.business_date-1
      and e.ex_type='cross_day' and e.status in ('open','clarifying','answered')
      and e.superseded_by_exception_id is null
      and upper(trim(coalesce(e.account,'')))=upper(trim(coalesce(v_old.account,'')))
      and e.direction=v_old.direction
      and coalesce(e.bank_amount,e.system_amount,0)=v_amount;
    if v_evidence_count=1 and v_candidate_count=1 then
      update public.exceptions set status='closed',auto_closed=true,resolved_at=now(),
        resolved_by='system:exception-lifecycle-v1',closing_run_id=p_run_id,
        closure_rule='next-day-unique-match-evidence',
        resolution_note='ปิดรายการค้างข้ามวันเมื่อข้อมูลวันถัดไปจับคู่ 1:1 และเก็บประวัติใน Audit Log',updated_at=now()
      where id=v_old.id;
      insert into public.audit_log(actor,action,entity,target,detail,meta)
      values('system:exception-lifecycle-v1','cross_day_auto_closed','exception',v_old.id::text,
        'ข้อมูลวันถัดไปจับคู่ 1:1 จึงปิดรายการค้างข้ามวัน',
        jsonb_build_object('closing_run_id',p_run_id,'rule','next-day-unique-match-evidence'));
    end if;
  end loop;

  update public.daily_recon_jobs set status='completed',last_run_id=p_run_id,completed_at=now(),
    late_file=false,rerun_requested_at=null,updated_at=now() where id=p_job_id;
  insert into public.recon_notifications(dedupe_key,level,title,detail,business_date,company,job_id)
  select 'complete:'||id||':'||p_run_id,'success','กระทบยอดรายวันสำเร็จ','บันทึกผลการรัน '||p_run_id,
    business_date,company,id from public.daily_recon_jobs where id=p_job_id on conflict(dedupe_key) do nothing;
end $$;

revoke all on function public.recon_exception_lifecycle_key(public.exceptions) from public,anon;
grant execute on function public.recon_exception_lifecycle_key(public.exceptions) to authenticated,service_role;
revoke all on function public.finish_daily_recon_job(uuid,uuid) from public,anon;
grant execute on function public.finish_daily_recon_job(uuid,uuid) to authenticated,service_role;

notify pgrst, 'reload schema';
commit;
