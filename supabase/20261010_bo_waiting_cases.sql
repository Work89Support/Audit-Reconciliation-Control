-- Attach review cases to the current company/day run without accepting it,
-- changing a transaction, closing a case, or recording a financial loss.
begin;
set local lock_timeout='5s';
create or replace function public.register_bo_waiting_cases(p_run_id uuid,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path=public
set statement_timeout='30s' as $$
declare v_run public.recon_runs; r jsonb; v_file uuid; v_row integer;
 v_amount numeric; v_id uuid; v_created integer:=0; v_existing integer:=0; v_matched integer:=0;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>10000 then raise exception 'Invalid bounded BO rows';end if;
 perform 1 from public.daily_recon_jobs j where j.last_run_id=p_run_id and not j.is_archived for update;
 select * into strict v_run from public.recon_runs where id=p_run_id for update;
 if not exists(select 1 from public.daily_recon_jobs j where j.last_run_id=p_run_id and j.company=v_run.company and j.business_date=v_run.business_date and not j.is_archived) then raise exception 'Run is no longer current';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  v_file:=(r->'boSource'->>'fileId')::uuid;v_row:=(r->'boSource'->>'row')::integer;v_amount:=(r->>'systemAmount')::numeric;
  if r->>'company' is distinct from v_run.company or r->>'boDate' is distinct from v_run.business_date::text
    or coalesce(r->>'direction','') not in('deposit','withdraw','ฝาก','ถอน') or v_row is null or v_row<1
    or v_amount is null or v_amount<=0 or v_amount::text in('NaN','Infinity','-Infinity')
    or nullif(trim(r->>'account'),'') is null or trim(r->>'account') in('-','—','–','ไม่ระบุ','ไม่ระบุบัญชี','ไม่มีข้อมูล')
    or nullif(trim(r->>'boRaw'),'') is null then raise exception 'BO source scope or data invalid';end if;
  if not exists(select 1 from public.source_files f join public.mail_batches b on b.id=f.batch_id
     where f.id=v_file and f.id=any(v_run.file_ids) and f.kind='bo_main' and f.parsed and f.parse_error is null
     and coalesce(f.company,b.company)=v_run.company and b.business_date=v_run.business_date) then raise exception 'BO file not verified for this run';end if;
  if exists(select 1 from jsonb_array_elements(coalesce(v_run.summary->'match_evidence','[]'::jsonb)) m
     where m->'bo'->>'fileId'=v_file::text and m->'bo'->>'row'=v_row::text) then v_matched:=v_matched+1;continue;end if;
  if exists(select 1 from public.exceptions e where e.company=v_run.company and e.business_date=v_run.business_date
     and e.customer_details->'source_rows'->'bo'->>'fileId'=v_file::text
     and e.customer_details->'source_rows'->'bo'->>'row'=v_row::text) then v_existing:=v_existing+1;continue;end if;
  v_id:=gen_random_uuid();
  insert into public.exceptions(id,run_id,code,business_date,occurred_at,company,account,direction,member_code,
    ex_type,type_name,severity,status,track,system_amount,bank_amount,amount_diff,risk_amount,employee,cause,detail,
    bo_raw,stm_raw,bo_date,bo_time,customer_details)
  values(v_id,p_run_id,'BO-WAIT-'||replace(v_id::text,'-',''),v_run.business_date,nullif(r->>'boTime','')::time,
    v_run.company,r->>'account',case when r->>'direction' in('withdraw','ถอน') then 'ถอน' else 'ฝาก' end,
    r->'customerDetails'->'bo'->>'user','missing_stm','BO รอ STM/PM/หลักฐาน','medium','open',
    case when v_run.company in('AT4','FR8','SK8') then 'cycle' else 'daily' end,v_amount,null,0,0,
    r->'customerDetails'->'bo'->>'performedBy','ยังไม่พบหลักฐานคู่ STM/PM · ไม่ใช่ความเสียหายที่ยืนยันแล้ว',
    'อ่าน BO ต้นทางแล้ว · เปิดเคสเพื่อแนบหลักฐานและรอตรวจ STM/PM',r->>'boRaw',null,v_run.business_date,
    nullif(r->>'boTime','')::time,coalesce(r->'customerDetails','{}'::jsonb)||jsonb_build_object('waiting_source',true,
      'source_rows',jsonb_build_object('bo',r->'boSource'),'bo_account_label',r->>'account'));
  insert into public.audit_log(actor,action,entity,target,detail,meta)
  values(coalesce(auth.uid()::text,'system:bo-source-review'),'bo_waiting_case_created','exception',v_id::text,
    'เปิดเคส BO รอหลักฐาน · ไม่เปลี่ยนยอด ไม่ปิดเคส ไม่บันทึกความเสียหาย',
    jsonb_build_object('run_id',p_run_id,'file_id',v_file,'source_row',v_row,'company',v_run.company,'business_date',v_run.business_date));
  v_created:=v_created+1;
 end loop;
 if v_created>0 then update public.recon_runs set exception_count=coalesce(exception_count,0)+v_created,
   summary=coalesce(summary,'{}'::jsonb)||jsonb_build_object('bo_source_review_count',coalesce((summary->>'bo_source_review_count')::integer,0)+v_created) where id=p_run_id;end if;
 return jsonb_build_object('created',v_created,'existing',v_existing,'matched',v_matched,'run_id',p_run_id);
end $$;
-- New trusted worker snapshots (or a newly current run) also create eligible
-- review cases automatically. Rows not yet attached to a real run stay pending.
create or replace function public.materialize_bo_waiting_snapshot_cases()
returns trigger language plpgsql security invoker set search_path=public as $$
declare rows_to_create jsonb;
begin
 if new.last_run_id is null or new.is_archived or new.bo_waiting_snapshot is null then return new;end if;
 select coalesce(jsonb_agg(w),'[]'::jsonb) into rows_to_create
 from public.recon_runs rr cross join lateral jsonb_array_elements(coalesce(new.bo_waiting_snapshot->'waiting_bo','[]'::jsonb)) w
 where rr.id=new.last_run_id and rr.company=new.company and rr.business_date=new.business_date
   and w->>'company'=new.company and w->>'boDate'=new.business_date::text
   and nullif(trim(w->>'account'),'') is not null
   and trim(w->>'account') not in('-','—','–','ไม่ระบุ','ไม่ระบุบัญชี','ไม่มีข้อมูล')
   and exists(select 1 from unnest(rr.file_ids) fid where fid::text=w->'boSource'->>'fileId');
 if jsonb_array_length(rows_to_create)>0 then perform public.register_bo_waiting_cases(new.last_run_id,rows_to_create);end if;
 return new;
end $$;
drop trigger if exists bo_waiting_snapshot_cases on public.daily_recon_jobs;
create trigger bo_waiting_snapshot_cases after update of bo_waiting_snapshot,last_run_id on public.daily_recon_jobs
for each row when(new.bo_waiting_snapshot is distinct from old.bo_waiting_snapshot or new.last_run_id is distinct from old.last_run_id)
execute function public.materialize_bo_waiting_snapshot_cases();
revoke all on function public.register_bo_waiting_cases(uuid,jsonb) from public,anon;
grant execute on function public.register_bo_waiting_cases(uuid,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
