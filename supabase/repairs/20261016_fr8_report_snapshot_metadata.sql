-- Repair draft metadata placement only. Never relax the live snapshot guard.
begin;
set local lock_timeout='5s';
set local request.jwt.claim.role='service_role';
do $$
declare q public.account_recheck_jobs; fresh jsonb; cleaned jsonb; metadata jsonb;
begin
 perform 1 from public.daily_recon_jobs where company='FR8' and business_date='2026-10-15' and not is_archived for update;
 select * into strict q from public.account_recheck_jobs where id='60e28693-cd34-42f3-bf65-b740bcb4cbaf' for update;
 cleaned:=q.snapshot-'repair_parent_primary_id'-'repair_parent_recheck_id'-'repair_parent_report_md5'-'repair_prepared_by'-'repair_version';
 fresh:=public.account_recheck_snapshot(q.company,q.business_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(q.company,q.business_date));
 if q.company<>'FR8' or q.business_date<>'2026-10-15'::date or q.status<>'ready' or q.revision<>1
  or md5(q.snapshot::text)<>'48ec9db924526f20241305e021933dac' or cleaned is distinct from fresh
  or q.result#>>'{summary,report_repair,version}' is distinct from 'fr8-oct15-scope-v1'
  or exists(select 1 from public.manual_primary_results where recheck_id=q.id)
  or (select id from public.manual_primary_results where company=q.company and business_date=q.business_date order by accepted_at desc,id desc limit 1)
     is distinct from 'f8c22ef6-10ab-4c80-8cf1-a5a92590e6e1'::uuid
 then raise exception 'Draft or live state changed; stop without rebasing';end if;
 metadata:=jsonb_build_object('repair_parent_primary_id',q.snapshot->'repair_parent_primary_id',
  'repair_parent_recheck_id',q.snapshot->'repair_parent_recheck_id','repair_parent_report_md5',q.snapshot->'repair_parent_report_md5',
  'repair_prepared_by',q.snapshot->'repair_prepared_by','repair_version',q.snapshot->'repair_version');
 update public.account_recheck_jobs set snapshot=cleaned,revision=revision+1,updated_at=now() where id=q.id;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values('database-operator','manual_report_snapshot_metadata_repaired','account_recheck_jobs',q.id::text,q.company,
  'Move draft-only metadata to audit history; exact live snapshot unchanged; no stale-state bypass',
  jsonb_build_object('metadata_preserved',metadata,'old_snapshot_md5',md5(q.snapshot::text),'new_snapshot_md5',md5(cleaned::text),
   'report_md5',md5(q.result::text),'source_changes',0,'cases_created',0,'primary_accepted',false));
end $$;
commit;
select id,status,revision from public.account_recheck_jobs where id='60e28693-cd34-42f3-bf65-b740bcb4cbaf';
