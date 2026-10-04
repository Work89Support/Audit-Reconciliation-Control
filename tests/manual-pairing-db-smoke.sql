-- Append INSIDE migration transaction, replacing commit with this and rollback.
-- Synthetic fixture rows and users never commit. No existing cases are updated.
do $qa$
declare u uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); r uuid:=gen_random_uuid();
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid(); f2 uuid:=gen_random_uuid(); result public.manual_case_pairs; blocked boolean;
 e uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid(); p4 uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email) values(u,'pairing-qa-'||u||'@example.invalid'),(l,'pairing-qa-'||l||'@example.invalid');
 insert into public.app_profiles(user_id,email,role,active) values(u,'pairing-qa-'||u||'@example.invalid','monitor',true),(l,'pairing-qa-'||l||'@example.invalid','lead',true)
   on conflict(user_id) do update set role=excluded.role,active=true;
 insert into public.user_company_access(user_id,company) values(u,'FR8');
 insert into public.source_files(id,file_name,storage_path,company,kind,parsed,row_count) values(f,'FR8_BO_2099-01-01.xlsx','qa-rollback/'||f,'FR8','bo_main',true,2);
 insert into public.recon_runs(id,business_date,company,file_ids,summary) values(r,'2099-01-01','FR8',array[f],'{"source_parser_completion":true,"bo_first":{"complete":true}}');
 insert into public.daily_recon_jobs(company,business_date,status,last_run_id) values('FR8','2099-01-01','completed',r);
 insert into public.exceptions(id,run_id,code,company,business_date,direction,account,ex_type,status,system_amount,bank_amount,bo_raw,stm_raw,currency)
 values(a,r,'QA-BO','FR8','2099-01-01','ฝาก','QA-ACCOUNT','missing_stm','open',200,null,'QA-BO-REF-1',null,'THB'),
 (b,r,'QA-STM','FR8','2099-01-01','ฝาก','QA-ACCOUNT','missing_bo','open',null,200.02,null,'QA-STM-REF-1','THB'),
 (c,r,'QA-STM-HIGH','FR8','2099-01-01','ฝาก','QA-ACCOUNT','missing_bo','open',null,205.01,null,'QA-STM-REF-2','THB'),
 (d,r,'QA-BO-COPY','FR8','2099-01-01','ฝาก','QA-ACCOUNT','missing_stm','open',200,null,'QA-BO-REF-1',null,'THB');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 blocked:=false;
 begin perform public.submit_manual_case_pair(gen_random_uuid(),a,c,'same','ผลต่างสูงเกินเพดานทดสอบ',null); exception when others then blocked:=true; end;
 if not blocked then raise exception 'QA failed: 5.01 allowed'; end if;
 result:=public.submit_manual_case_pair(p,a,b,'same','ตรวจต้นทางและอ้างอิงข้อมูลสมมติ',null);
 if result.difference<>0.02 or (select count(*) from public.exceptions where id in(a,b) and status='pair_pending')<>2 then raise exception 'QA failed: pending pair'; end if;
 result:=public.submit_manual_case_pair(p,a,b,'same','ตรวจต้นทางและอ้างอิงข้อมูลสมมติ',null);
 if (select count(*) from public.manual_case_pairs where id=p)<>1 then raise exception 'QA failed: retry duplicate'; end if;
 blocked:=false;
 begin update public.exceptions set status='closed' where id=a; exception when others then blocked:=true; end;
 if not blocked then raise exception 'QA failed: direct close bypass'; end if;
 blocked:=false;
 begin perform public.decide_manual_case_pair(p,'approve','เจ้าหน้าที่พยายามอนุมัติเอง'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'QA failed: monitor approve'; end if;
 perform set_config('request.jwt.claim.sub',l::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',l,'role','authenticated')::text,true);
 result:=public.decide_manual_case_pair(p,'approve','หัวหน้าตรวจทั้งสองรายการแล้ว');
 if result.status<>'approved' or (select count(*) from public.exceptions where id in(a,b) and status='closed' and approved_by=l)<>2 then raise exception 'QA failed: approval atomic'; end if;
 if (select bank_amount from public.exceptions where id=b)<>200.02 then raise exception 'QA failed: original amount changed'; end if;
 if not exists(select 1 from public.manual_pair_members where exception_id=a and released_at is null) then raise exception 'QA failed: reservation released after approval'; end if;
 update public.exceptions set bank_amount=205 where id=c;
 blocked:=false;
 begin perform public.submit_manual_case_pair(gen_random_uuid(),d,c,'same','ทดสอบหลักฐานต้นทางซ้ำ',null); exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'QA failed: source reuse'; end if;
 update public.exceptions set bo_raw='QA-BO-REF-3' where id=d;
 result:=public.submit_manual_case_pair(p2,d,c,'same','หัวหน้าส่งคำขอทดสอบพอดีห้าบาท',null);
 if result.difference<>5 then raise exception 'QA failed: exact five'; end if;
 blocked:=false;
 begin perform public.decide_manual_case_pair(p2,'approve','หัวหน้าพยายามอนุมัติตนเอง'); exception when others then
   if sqlerrm like '%ตนเอง%' then blocked:=true; else raise; end if;
 end;
 if not blocked then raise exception 'QA failed: self approval'; end if;
 update public.app_profiles set role='lead' where user_id=u;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 result:=public.decide_manual_case_pair(p2,'reject','หัวหน้าอีกคนตรวจและไม่อนุมัติ');
 if result.status<>'rejected' or (select count(*) from public.exceptions where id in(c,d) and status='open' and manual_pair_id is null)<>2
   or exists(select 1 from public.manual_pair_members where pair_id=p2 and released_at is null) then raise exception 'QA failed: rejection release'; end if;
 insert into public.exceptions(id,run_id,code,company,business_date,direction,account,ex_type,status,system_amount,bank_amount,bo_raw,stm_raw,currency)
 values(e,r,'QA-AMOUNT-DIFF','FR8','2099-01-01','ฝาก','QA-ACCOUNT','amount_diff','open',24,24.27,'QA-BO-CENTS','QA-STM-CENTS','THB');
 result:=public.submit_manual_case_pair(p3,e,e,'same','ตรวจหลักฐานรายการเดียวกันยอดต่างสตางค์',null);
 if result.difference<>0.27 or result.snapshot->>'review_type'<>'amount_difference'
   or (select count(*) from public.manual_pair_members where pair_id=p3 and secondary_source_key is not null)<>1
   or (select status from public.exceptions where id=e)<>'pair_pending' then raise exception 'QA failed: same case amount difference'; end if;
 result:=public.submit_manual_case_pair(p3,e,e,'same','ตรวจหลักฐานรายการเดียวกันยอดต่างสตางค์',null);
 blocked:=false;
 begin perform public.decide_manual_case_pair(p3,'approve','ทดสอบห้ามอนุมัติคำขอตนเอง'); exception when others then if sqlerrm like '%ตนเอง%' then blocked:=true; else raise; end if; end;
 if not blocked then raise exception 'QA failed: same case self approval'; end if;
 perform set_config('request.jwt.claim.sub',l::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',l,'role','authenticated')::text,true);
 result:=public.decide_manual_case_pair(p3,'reject','ตรวจคืนเคสยอดต่างเพื่อทดสอบใหม่');
 if exists(select 1 from public.manual_pair_members where pair_id=p3 and released_at is null) or (select status from public.exceptions where id=e)<>'open' then raise exception 'QA failed: same case rejection'; end if;
 result:=public.submit_manual_case_pair(p4,e,e,'same','ตรวจรายการเดิมอีกครั้งหลังคืนเคส',null);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 update public.source_files set parsed=false where id=f;
 blocked:=false;
 begin perform public.decide_manual_case_pair(p4,'approve','ต้องปฏิเสธเพราะต้นทางอ่านไม่ครบ'); exception when others then if sqlerrm like '%อ่านไฟล์ครบ%' then blocked:=true; else raise; end if; end;
 if not blocked then raise exception 'QA failed: amount difference parser gate'; end if;
 update public.source_files set parsed=true where id=f;
 blocked:=false;
 begin update public.exceptions set stm_raw='QA-STM-CENTS-CHANGED' where id=e; exception when others then if sqlerrm like '%คู่เคสถูกจองไว้%' then blocked:=true; else raise; end if; end;
 if not blocked then raise exception 'QA failed: amount difference pending source mutation'; end if;
 result:=public.decide_manual_case_pair(p4,'approve','หัวหน้าอีกคนตรวจคู่ยอดต่างแล้ว');
 if result.status<>'approved' or not exists(select 1 from public.exceptions where id=e and status='closed' and system_amount=24 and bank_amount=24.27 and approved_by=u) then raise exception 'QA failed: same case approval preserves amounts'; end if;
 update public.exceptions set stm_raw='QA-STM-CENTS',bank_amount=200 where id=c;
 blocked:=false;
 begin perform public.submit_manual_case_pair(gen_random_uuid(),d,c,'same','ทดสอบห้ามใช้ STM ที่อนุมัติแล้วซ้ำ',null); exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'QA failed: secondary source reuse'; end if;
 blocked:=false;
 begin perform public.validate_manual_pair(e,e,'cross',null); exception when others then blocked:=true; end;
 if not blocked then raise exception 'QA failed: same case cross mode'; end if;
 update public.exceptions set bank_amount=29.01 where id=e;
 blocked:=false;
 begin perform public.validate_manual_pair(e,e,'same',null); exception when others then if sqlerrm like '%5 บาท%' then blocked:=true; else raise; end if; end;
 if not blocked then raise exception 'QA failed: same case 5.01 allowed'; end if;
 insert into public.source_files(id,file_name,storage_path,company,kind,parsed,row_count) values(f2,'3XB_BO_2099-01-01.xlsx','qa-rollback/'||f2,'3XB','bo_main',true,1);
 insert into public.recon_runs(id,business_date,company,file_ids,summary) values(r2,'2099-01-01','3XB',array[f2],'{"source_parser_completion":true,"bo_first":{"complete":true}}');
 insert into public.daily_recon_jobs(company,business_date,status,last_run_id) values('3XB','2099-01-01','completed',r2);
 update public.exceptions set company='3XB',run_id=r2 where id=d;
 blocked:=false;
 begin perform public.submit_manual_case_pair(gen_random_uuid(),d,c,'cross','ข้ามบริษัทแต่ไม่มีหลักฐานทดสอบ',null); exception when others then
   if sqlerrm like '%หลักฐาน%' then blocked:=true; else raise; end if;
 end;
 if not blocked then raise exception 'QA failed: cross evidence'; end if;
end $qa$;
select 'DB smoke passed: same-case 24/24.27 review, pending/approve/reject, preserved amounts, secondary source reservation, parser/snapshot guards; legacy 0.02 pair, 5 cap, retry, source reuse, direct close, roles, cross evidence. All synthetic users/cases rolled back.' as test_result;
rollback;
