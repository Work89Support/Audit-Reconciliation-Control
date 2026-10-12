-- Bounded one-time repair of current AT4/SK8 2026-10-11 duplicates.
-- Changes only lineage pointers + updated_at and appends Audit Log.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create temporary table bo_lineage_before on commit drop as
 select e.id,to_jsonb(e)-'superseded_by_exception_id'-'updated_at' as protected
 from public.exceptions e where e.company in ('AT4','SK8') and e.business_date='2026-10-11';
create temporary table bo_lineage_files_before on commit drop as
 select f.id,to_jsonb(f) as protected from public.case_evidence f join bo_lineage_before b on b.id=f.exception_id;
create temporary table bo_lineage_runs_before on commit drop as
 select r.id,to_jsonb(r) as protected from public.recon_runs r
 where r.company in ('AT4','SK8') and r.business_date='2026-10-11';
create temporary table bo_lineage_targets on commit drop as
 select e.id as old_id,public.bo_waiting_cross_day_target(to_jsonb(e),j.last_run_id) as target_id
 from public.daily_recon_jobs j join public.exceptions e on e.run_id=j.last_run_id
 where j.company in ('AT4','SK8') and j.business_date='2026-10-11' and not j.is_archived
   and e.superseded_by_exception_id is null and e.customer_details->>'waiting_source'='true';
delete from bo_lineage_targets where target_id is null;
do $$ begin
 if (select count(*) from bo_lineage_targets)<>10
 or (select count(*) from bo_lineage_targets t join public.exceptions e on e.id=t.old_id where e.company='AT4')<>3
 or (select count(*) from bo_lineage_targets t join public.exceptions e on e.id=t.old_id where e.company='SK8')<>7
 then raise exception 'Expected exact 3 AT4 + 7 SK8 source-linked candidates; recheck current state';end if;
end $$;
update public.exceptions e set superseded_by_exception_id=t.target_id,updated_at=now()
 from bo_lineage_targets t where e.id=t.old_id;
insert into public.audit_log(actor,action,entity,target,detail,meta)
 select 'system:bo-source-lineage','bo_waiting_linked_to_cross_day','exception',t.old_id::text,
 'เชื่อมเคส BO รอ STM เป็นประวัติของเคสข้ามวันจากไฟล์/แถว/Ref/User เดียวกัน ไม่ปิดเคส ไม่เปลี่ยนยอดหรือหลักฐาน',
 jsonb_build_object('canonical_exception_id',t.target_id,'business_date','2026-10-11','source_rows',e.customer_details->'source_rows')
 from bo_lineage_targets t join public.exceptions e on e.id=t.old_id;
do $$ begin
 if exists(select 1 from bo_lineage_before b left join public.exceptions e on e.id=b.id
   where e.id is null or b.protected is distinct from to_jsonb(e)-'superseded_by_exception_id'-'updated_at')
 or exists(select 1 from bo_lineage_files_before b left join public.case_evidence f on f.id=b.id
   where f.id is null or b.protected is distinct from to_jsonb(f))
 or exists(select 1 from bo_lineage_runs_before b left join public.recon_runs r on r.id=b.id
   where r.id is null or b.protected is distinct from to_jsonb(r))
 then raise exception 'Protected case/evidence fields changed; rollback';end if;
end $$;
select jsonb_build_object('linked',count(*),'cases_closed',0,'amounts_changed',0,'evidence_changed',0) as result from bo_lineage_targets;
commit;
