-- A statement attached to the correct business-date mail batch may keep the
-- bank's previous calendar date in its file name. Keep BO and PM strict.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $patch$
declare
  d text; n text;
  needle text := $needle$and substring(name from '20[0-9]{2}-[0-9]{2}-[0-9]{2}')<>effective_day::text$needle$;
  replacement text := $replacement$and substring(name from '20[0-9]{2}-[0-9]{2}-[0-9]{2}')<>effective_day::text
  and not(
    kind='stm_pdf'
    and substring(name from '20[0-9]{2}-[0-9]{2}-[0-9]{2}')=(effective_day-1)::text
  ) /* previous_day_stm_context */$replacement$;
begin
  d:=pg_get_functiondef('public.audit_run_preflight_review(text,date)'::regprocedure);
  if position('previous_day_stm_context' in d)=0 then
    n:=replace(d,needle,replacement);
    if n=d then raise exception 'Preflight file-day condition changed; refusing an unreviewed patch'; end if;
    execute n;
  end if;
end $patch$;

insert into public.audit_log(actor,action,entity,target,company,detail,meta)
values('system:migration','previous_day_stm_context_enabled','daily_recon_jobs','2026-11-01:all',null,
  'ยอมรับเฉพาะ STM ที่อยู่ในชุดอีเมลวันงานถูกต้องและวันที่ในชื่อไฟล์เป็นวันก่อนหน้า 1 วัน; BO และ PM ยังตรวจวันเข้มตามเดิม',
  jsonb_build_object('stm_previous_day_allowed',true,'bo_previous_day_allowed',false,
    'pm_previous_day_allowed',false,'cases_created',0,'cases_closed',0));

notify pgrst,'reload schema';
commit;
