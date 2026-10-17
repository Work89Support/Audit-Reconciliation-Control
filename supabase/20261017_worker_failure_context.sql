-- No jobs/cases/sources/holds are changed. Preserve verified failure evidence.
begin;
set local lock_timeout='5s';
insert into public.audit_log(actor,action,entity,target,company,detail,meta)
select 'deployment-verification','worker_failure_verified','daily_recon_jobs',
 'e81767ba-d6cc-46d4-89b2-8f590125885b','FR8',
 'อ่านและคำนวณแล้ว แต่ขั้นบันทึก Exception ถูก guard พักงาน/ตรวจเฉพาะบัญชีกันไว้ ไม่ใช่ข้อสรุปว่าไฟล์อ่านไม่ได้',
 jsonb_build_object('business_date','2026-10-16','execution_id','14474','stage','save_exceptions',
 'code','AUTOMATIC_WRITE_BLOCKED','message','พักงาน/ตรวจเฉพาะบัญชีอยู่ ไม่บันทึกผลอัตโนมัติ',
 'evidence_url','https://work8989.app.n8n.cloud/workflow/dmQDrxLA7q2yAqCn/executions/14474',
 'historical_evidence',true,'cases_changed',0,'jobs_changed',0)
where not exists(select 1 from public.audit_log where action='worker_failure_verified'
 and target='e81767ba-d6cc-46d4-89b2-8f590125885b' and meta->>'execution_id'='14474');

create or replace function public.worker_failure_context(p_company text,p_date date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare context jsonb;
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false)
 then raise exception 'ไม่มีสิทธิ์อ่านบริษัทนี้';end if;
 select jsonb_build_object('detail',detail,'at',at,'execution_id',meta->>'execution_id',
 'stage',meta->>'stage','message',meta->>'message','historical_evidence',true) into context
 from public.audit_log where company=p_company and action='worker_failure_verified'
 and meta->>'business_date'=p_date::text order by at desc,id desc limit 1;
 return context;
end$$;
revoke all on function public.worker_failure_context(text,date) from public,anon;
grant execute on function public.worker_failure_context(text,date) to authenticated;

do $$declare d text;
begin
 d:=pg_get_functiondef('public.file_run_management_state(text,date)'::regprocedure);
 if position('worker_failure_context' in d)=0 then
 if position($needle$'files',public.effective_audit_source_files$needle$ in d)=0 then raise exception 'Unreviewed file management definition';end if;
 execute replace(d,$needle$'files',public.effective_audit_source_files$needle$,
 $patch$'workerFailure',public.worker_failure_context(p_company,p_date),'files',public.effective_audit_source_files$patch$);
 end if;
 d:=pg_get_functiondef('public.audit_run_notices(date,date,text)'::regprocedure);
 if position('worker_failure_context' in d)=0 then
 if position($needle$'status',j.status$needle$ in d)=0 then raise exception 'Unreviewed run notice definition';end if;
 execute replace(d,$needle$'status',j.status$needle$,
 $patch$'workerFailure',public.worker_failure_context(j.company,j.business_date),'status',j.status$patch$);
 end if;
 d:=pg_get_functiondef('public.queue_due_daily_recon_jobs(date,date)'::regprocedure);
 -- A retry limit is not proof of a file format error. Keep the real error if
 -- available; never overwrite it with an unsupported instruction to resend files.
 d:=replace(d,'หยุดลองอัตโนมัติหลังล้มเหลว 3 ครั้ง: ตรวจรูปแบบไฟล์หรือเพิ่มไฟล์ที่ถูกต้อง',
 'หยุดลองอัตโนมัติหลังล้มเหลว 3 ครั้ง: ต้องตรวจบันทึก worker ไม่ได้ยืนยันว่าไฟล์เสีย');
 execute d;
 d:=pg_get_functiondef('public.claim_daily_recon_jobs(text,integer)'::regprocedure);
 if position('not public.audit_run_blocked' in d)=0 then
 if position('j.status=''queued''' in d)=0 then raise exception 'Unreviewed claim definition';end if;
 execute replace(d,'j.status=''queued''','j.status=''queued'' and not public.audit_run_blocked(j.company,j.business_date)');
 end if;
 d:=pg_get_functiondef('public.guard_automatic_run_write()'::regprocedure);
 if position('สาเหตุระหว่างบันทึก:' in d)=0 then
 if position($needle$raise exception 'พักงาน/ตรวจเฉพาะบัญชีอยู่ ไม่บันทึกผลอัตโนมัติ';$needle$ in d)=0 then raise exception 'Unreviewed automatic write guard';end if;
 execute replace(d,$needle$raise exception 'พักงาน/ตรวจเฉพาะบัญชีอยู่ ไม่บันทึกผลอัตโนมัติ';$needle$,
 $patch$raise exception 'พักงาน/ตรวจเฉพาะบัญชีอยู่ ไม่บันทึกผลอัตโนมัติ — สาเหตุระหว่างบันทึก: %',
 case when exists(select 1 from public.audit_run_holds where company=new.company and business_date=new.business_date and paused)
 then 'พักบอทรอบหลักตามคำสั่ง'
 when public.audit_source_scope_managed(new.company,new.business_date) then 'มีเวอร์ชันไฟล์แก้ไข ต้องทบทวนผลแยก'
 else 'มีงานตรวจมือ queued/running ที่ lease ยังไม่หมด ป้องกันงานซ้อน' end;$patch$);
 end if;
end$$;
notify pgrst,'reload schema';
commit;
