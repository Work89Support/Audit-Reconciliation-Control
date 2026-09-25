-- Finish large reconciliation reruns without scanning match evidence once per
-- historical exception.  The lifecycle rules remain the same, but evidence,
-- duplicate counts, carry-forward rows, and audit logs are handled set-wise.
begin;
set local lock_timeout = '10s';

create index if not exists exceptions_run_open_lifecycle_idx
  on public.exceptions(run_id, lifecycle_key, created_at, id)
  where status in ('open','clarifying','answered')
    and superseded_by_exception_id is null;

create or replace function public.finish_daily_recon_job(p_job_id uuid,p_run_id uuid)
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
declare
  v_job public.daily_recon_jobs%rowtype;
  v_old_run_id uuid;
begin
  select * into v_job
  from public.daily_recon_jobs
  where id=p_job_id
  for update;

  if not found then
    raise exception 'ไม่พบงานกระทบยอด %', p_job_id;
  end if;

  if not exists(
    select 1
    from public.recon_runs r
    where r.id=p_run_id
      and r.business_date=v_job.business_date
      and upper(coalesce(r.company,''))=upper(coalesce(v_job.company,''))
  ) then
    raise exception 'ผลรันไม่ตรงบริษัทหรือวันที่ของงาน';
  end if;

  v_old_run_id := v_job.last_run_id;

  update public.exceptions e
  set lifecycle_key=public.recon_exception_lifecycle_key(e)
  where e.run_id=p_run_id and e.lifecycle_key is null;

  create temporary table recon_finish_evidence(
    company text,
    account text,
    direction text,
    amount numeric,
    evidence_count integer,
    primary key(company,account,direction,amount)
  ) on commit drop;

  insert into recon_finish_evidence(company,account,direction,amount,evidence_count)
  select
    upper(coalesce(ev->>'company',v_job.company)),
    upper(trim(coalesce(ev->>'account',''))),
    case lower(coalesce(ev->>'direction',''))
      when 'deposit' then 'ฝาก'
      when 'withdraw' then 'ถอน'
      else coalesce(ev->>'direction','')
    end,
    (ev->>'amount')::numeric,
    count(*)::integer
  from public.recon_runs r
  cross join lateral jsonb_array_elements(coalesce(r.summary->'match_evidence','[]'::jsonb)) ev
  where r.id=p_run_id
    and coalesce(ev->>'amount','') ~ '^-?[0-9]+([.][0-9]+)?$'
  group by 1,2,3,4;

  if v_old_run_id is not null and v_old_run_id<>p_run_id then
    update public.exceptions e
    set lifecycle_key=public.recon_exception_lifecycle_key(e)
    where e.run_id=v_old_run_id and e.lifecycle_key is null;

    create temporary table recon_finish_old on commit drop as
    select e.*
    from public.exceptions e
    where e.run_id=v_old_run_id
      and e.status in ('open','clarifying','answered')
      and e.superseded_by_exception_id is null;
    create index on recon_finish_old(id);
    create index on recon_finish_old(lifecycle_key);

    create temporary table recon_finish_current_match on commit drop as
    select distinct on (o.id)
      o.id as old_id,
      c.id as current_id
    from recon_finish_old o
    join public.exceptions c
      on c.run_id=p_run_id and c.lifecycle_key=o.lifecycle_key
    order by o.id,c.created_at,c.id;
    create unique index on recon_finish_current_match(old_id);

    update public.exceptions c
    set previous_exception_id=o.id,
        status=case when o.status in ('clarifying','answered') then o.status else c.status end,
        assigned_to=coalesce(o.assigned_to,c.assigned_to),
        requested_by=coalesce(o.requested_by,c.requested_by),
        requested_at=coalesce(o.requested_at,c.requested_at),
        responded_by=coalesce(o.responded_by,c.responded_by),
        response_text=coalesce(o.response_text,c.response_text),
        responded_at=coalesce(o.responded_at,c.responded_at),
        clarification_file_id=coalesce(o.clarification_file_id,c.clarification_file_id),
        updated_at=now()
    from recon_finish_current_match m
    join recon_finish_old o on o.id=m.old_id
    where c.id=m.current_id;

    update public.exceptions o
    set superseded_by_exception_id=m.current_id,updated_at=now()
    from recon_finish_current_match m
    where o.id=m.old_id;

    insert into public.audit_log(actor,action,entity,target,detail,meta)
    select 'system:exception-lifecycle-v2','exception_carried_forward','exception',m.current_id::text,
      'เคสเดิมยังไม่คลี่คลาย จึงยกสถานะและหลักฐานมารอบใหม่โดยไม่ลบประวัติ',
      jsonb_build_object('previous_exception_id',m.old_id,'from_run_id',v_old_run_id,
        'to_run_id',p_run_id,'lifecycle_key',o.lifecycle_key)
    from recon_finish_current_match m
    join recon_finish_old o on o.id=m.old_id;

    create temporary table recon_finish_candidates on commit drop as
    select
      upper(trim(coalesce(account,''))) as account,
      direction,
      coalesce(bank_amount,system_amount,0) as amount,
      count(*)::integer as candidate_count,
      count(*) filter(where ex_type='missing_bo')::integer as missing_bo_count,
      count(*) filter(where ex_type='missing_stm')::integer as missing_stm_count,
      count(*) filter(where ex_type='cross_day')::integer as cross_day_count
    from recon_finish_old
    where ex_type in ('missing_bo','missing_stm','cross_day')
    group by 1,2,3;
    create unique index on recon_finish_candidates(account,direction,amount);

    create temporary table recon_finish_auto_close on commit drop as
    select o.id
    from recon_finish_old o
    left join recon_finish_current_match m on m.old_id=o.id
    join recon_finish_candidates c
      on c.account=upper(trim(coalesce(o.account,'')))
     and c.direction=o.direction
     and c.amount=coalesce(o.bank_amount,o.system_amount,0)
    join recon_finish_evidence ev
      on ev.company=upper(coalesce(o.company,''))
     and ev.account=upper(trim(coalesce(o.account,'')))
     and ev.direction=o.direction
     and ev.amount=coalesce(o.bank_amount,o.system_amount,0)
    where m.old_id is null
      and o.ex_type in ('missing_bo','missing_stm','cross_day')
      and ev.evidence_count=1
      and c.candidate_count between 1 and 2
      and c.missing_bo_count<=1
      and c.missing_stm_count<=1
      and c.cross_day_count<=1;
    create unique index on recon_finish_auto_close(id);

    update public.exceptions e
    set status='closed',auto_closed=true,resolved_at=now(),
        resolved_by='system:exception-lifecycle-v2',closing_run_id=p_run_id,
        closure_rule='unique-match-evidence',
        resolution_note='ปิดอัตโนมัติเมื่อรอบใหม่พบคู่ 1:1 บริษัท/บัญชี/ทิศทาง/ยอดตรงกัน; เก็บประวัติเดิมใน Audit Log',
        updated_at=now()
    from recon_finish_auto_close a
    where e.id=a.id;

    insert into public.audit_log(actor,action,entity,target,detail,meta)
    select 'system:exception-lifecycle-v2','exception_auto_closed_on_rerun','exception',a.id::text,
      'รอบใหม่มีหลักฐานจับคู่ 1:1 จึงนำออกจากงานค้างและเก็บประวัติการปิด',
      jsonb_build_object('closing_run_id',p_run_id,'previous_run_id',v_old_run_id,'rule','unique-match-evidence')
    from recon_finish_auto_close a;

    create temporary table recon_finish_carry_map on commit drop as
    select o.id as old_id,gen_random_uuid() as new_id
    from recon_finish_old o
    left join recon_finish_current_match m on m.old_id=o.id
    left join recon_finish_auto_close a on a.id=o.id
    where m.old_id is null and a.id is null;
    create unique index on recon_finish_carry_map(old_id);

    insert into public.exceptions
    select populated.*
    from recon_finish_carry_map m
    join recon_finish_old o on o.id=m.old_id
    cross join lateral jsonb_populate_record(
      null::public.exceptions,
      to_jsonb(o) || jsonb_build_object(
        'id',m.new_id,'run_id',p_run_id,
        'code',left(coalesce(o.code,'EX')||'-C'||replace(m.new_id::text,'-',''),64),
        'previous_exception_id',o.id,'superseded_by_exception_id',null,
        'closing_run_id',null,'closure_rule',null,
        'created_at',now(),'updated_at',now()
      )
    ) populated;

    update public.exceptions o
    set superseded_by_exception_id=m.new_id,updated_at=now()
    from recon_finish_carry_map m
    where o.id=m.old_id;

    insert into public.audit_log(actor,action,entity,target,detail,meta)
    select 'system:exception-lifecycle-v2','exception_carried_forward','exception',m.new_id::text,
      'รอบใหม่ยังไม่มีหลักฐานพอปิดเคส ระบบจึงคงรายการไว้ในงานปัจจุบัน',
      jsonb_build_object('previous_exception_id',m.old_id,'from_run_id',v_old_run_id,
        'to_run_id',p_run_id,'reason','no-unique-match-evidence')
    from recon_finish_carry_map m;
  end if;

  create temporary table recon_finish_prev_cross_day on commit drop as
  select e.id,
         upper(trim(coalesce(e.account,''))) as account,
         e.direction,
         coalesce(e.bank_amount,e.system_amount,0) as amount,
         upper(coalesce(e.company,'')) as company,
         count(*) over(partition by upper(trim(coalesce(e.account,''))),e.direction,
           coalesce(e.bank_amount,e.system_amount,0))::integer as candidate_count
  from public.daily_recon_jobs j
  join public.exceptions e on e.run_id=j.last_run_id
  where j.company=v_job.company
    and j.business_date=v_job.business_date-1
    and e.ex_type='cross_day'
    and e.status in ('open','clarifying','answered')
    and e.superseded_by_exception_id is null;

  update public.exceptions e
  set status='closed',auto_closed=true,resolved_at=now(),
      resolved_by='system:exception-lifecycle-v2',closing_run_id=p_run_id,
      closure_rule='next-day-unique-match-evidence',
      resolution_note='ปิดรายการค้างข้ามวันเมื่อข้อมูลวันถัดไปจับคู่ 1:1 และเก็บประวัติใน Audit Log',
      updated_at=now()
  from recon_finish_prev_cross_day p
  join recon_finish_evidence ev
    on ev.company=p.company and ev.account=p.account and ev.direction=p.direction and ev.amount=p.amount
  where e.id=p.id and p.candidate_count=1 and ev.evidence_count=1;

  insert into public.audit_log(actor,action,entity,target,detail,meta)
  select 'system:exception-lifecycle-v2','cross_day_auto_closed','exception',p.id::text,
    'ข้อมูลวันถัดไปจับคู่ 1:1 จึงปิดรายการค้างข้ามวัน',
    jsonb_build_object('closing_run_id',p_run_id,'rule','next-day-unique-match-evidence')
  from recon_finish_prev_cross_day p
  join recon_finish_evidence ev
    on ev.company=p.company and ev.account=p.account and ev.direction=p.direction and ev.amount=p.amount
  where p.candidate_count=1 and ev.evidence_count=1;

  update public.daily_recon_jobs
  set status='completed',last_run_id=p_run_id,completed_at=now(),late_file=false,
      rerun_requested_at=null,updated_at=now()
  where id=p_job_id;

  insert into public.recon_notifications(dedupe_key,level,title,detail,business_date,company,job_id)
  select 'complete:'||id||':'||p_run_id,'success','กระทบยอดรายวันสำเร็จ','บันทึกผลการรัน '||p_run_id,
    business_date,company,id
  from public.daily_recon_jobs
  where id=p_job_id
  on conflict(dedupe_key) do nothing;
end $$;

revoke all on function public.finish_daily_recon_job(uuid,uuid) from public,anon;
grant execute on function public.finish_daily_recon_job(uuid,uuid) to authenticated,service_role;

notify pgrst, 'reload schema';
commit;
