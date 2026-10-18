import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const fixture=fs.readFileSync('tests/pending-cross-day-actions-db.test.mjs','utf8');
const setup=fixture.slice(0,fixture.indexOf('const stamp='));
const tests=String.raw`
await db.exec('create function manual_primary_report_projection(jsonb) returns jsonb language sql immutable as $$select $1$$');
let guard=(await query("select pg_get_functiondef('cross_day_current_manual_case(exceptions)'::regprocedure) d")).rows[0].d;
guard=guard.replace('v.base_run_id=e.run_id','v.base_run_id is not distinct from e.run_id').replace('j.last_run_id=v.base_run_id','j.last_run_id is not distinct from v.base_run_id').replace('q.result=v.report','public.manual_primary_report_projection(q.result)=v.report');
await db.exec(guard);
const patch=fs.readFileSync('supabase/20261018_manual_cross_day_source_parity.sql','utf8');
for(const [index,company] of ['3XB','MC8','MR9','PS8','UR9','AT4','FR8','SK8','UFABET7M'].entries()){
 const k=100+index*10,bo=id(k),stm=id(k+1),batch=id(k+2),job=id(k+3),recheck=id(k+4),primary=id(k+5),caseId=id(k+6),request=id(k+7);
 const stamp=[{id:bo}],report={quality:'passed'};
 await actor(1,'monitor',company);
 await query("select set_config('test.sources',$1,false)",[JSON.stringify(stamp)]);
 await query("insert into mail_batches values($1,$2,'2026-10-17')",[batch,company]);
 await query("insert into source_files(id,company,kind,storage_path,file_name,batch_id) values($1,$3,'bo_main',$4,'BO.xlsx',$6),($2,$3,'stm_pdf',$5,'STM.pdf',$6)",[bo,stm,company,company+'/bo',company+'/stm',batch]);
 await query("insert into storage.objects values('audit-files',$1,'{\"eTag\":\"bo\"}',null),('audit-files',$2,'{\"eTag\":\"stm\"}',null)",[company+'/bo',company+'/stm']);
 await query("insert into daily_recon_jobs values($1,$2,'2026-10-16',null,false,'failed')",[job,company]);
 await query("insert into account_recheck_jobs values($1,'confirmed',$2,'ALL','all')",[recheck,report]);
 await query("insert into manual_primary_results values($1,$2,'2026-10-16',$3,null,$4,$5,now())",[primary,company,recheck,report,stamp]);
 await query("insert into exceptions(id,run_id,company,business_date,occurred_at,direction,account,currency,system_amount,bo_raw,customer_details,ex_type,status) values($1,null,$2,'2026-10-16','23:46','ฝาก','5292894087','THB',200,'BO actual row',$3,'cross_day','pending_next_day')",[caseId,company,{manual_primary_id:primary,bo:{account:'1234567890'},source_rows:{bo:{fileId:bo,row:295}}}]);
 await query('insert into manual_primary_case_items values($1,$2)',[primary,caseId]);
 if(index===0){
  assert.equal((await query("select jsonb_array_length(cross_day_workbench($1,'2026-10-16','2026-10-17')->'cases') n",[company])).rows[0].n,0);
  await assert.rejects(query("select submit_cross_day_image_review($1,$2,$3,1,'ตรวจภาพต้นฉบับแล้ว')",[request,caseId,stm]),/ผลรันเปลี่ยน/);
  await db.exec(patch);await db.exec(patch);
 }
 assert.equal((await query('select cross_day_case_source_ready(e) ok from exceptions e where id=$1',[caseId])).rows[0].ok,true);
 assert.equal((await query("select jsonb_array_length(cross_day_workbench($1,'2026-10-16','2026-10-17')->'cases') n",[company])).rows[0].n,1);
 await query("select set_config('test.sources','[]',false)");
 assert.equal((await query('select cross_day_case_source_ready(e) ok from exceptions e where id=$1',[caseId])).rows[0].ok,false);
 await assert.rejects(query("select submit_cross_day_image_review($1,$2,$3,1,'ตรวจภาพต้นฉบับแล้ว')",[request,caseId,stm]));
 await query("select set_config('test.sources',$1,false)",[JSON.stringify(stamp)]);
 await actor(1,'monitor','NO_ACCESS');
 await assert.rejects(query("select cross_day_workbench($1,'2026-10-16','2026-10-17')",[company]));
 await actor(1,'monitor',company);
 await query("select submit_cross_day_image_review($1,$2,$3,1,'ตรวจภาพต้นฉบับแล้ว')",[request,caseId,stm]);
 await query("select submit_cross_day_image_review($1,$2,$3,1,'ตรวจภาพต้นฉบับแล้ว')",[request,caseId,stm]);
 await assert.rejects(query("select decide_cross_day_image_review($1,'approve','ตรวจแล้ว')",[request]));
 await actor(2,'lead',company);
 await query("select set_config('test.sources','[]',false)");
 await assert.rejects(query("select decide_cross_day_image_review($1,'approve','ตรวจแล้ว')",[request]));
 await query("select set_config('test.sources',$1,false)",[JSON.stringify(stamp)]);
 await query("select decide_cross_day_image_review($1,'approve','ตรวจภาพแล้ว')",[request]);
 assert.equal((await query('select system_amount from exceptions where id=$1',[caseId])).rows[0].system_amount,'200');
 assert.equal((await query('select count(*) n from cross_day_image_reviews where exception_id=$1',[caseId])).rows[0].n,1);
}
console.log('PASS nine companies: NULL-base accepted manual cases listed, image submit/decision parity, idempotent retry, stale-source and foreign-company rejection, head-only approval, amounts unchanged. Synthetic isolated DB only; no live requests or closure.');
await db.close();
`;
process.argv[2]=pathToFileURL(process.argv[2]).href;
await import('data:text/javascript;base64,'+Buffer.from(setup+tests).toString('base64'));
