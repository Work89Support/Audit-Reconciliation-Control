import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const baseline=fs.readFileSync('tests/all-company-primary-handoff-db.test.mjs','utf8');
const setup=baseline.slice(baseline.indexOf('const db='),baseline.indexOf('const companies='));
const {db,id}=await new (Object.getPrototypeOf(async function(){}).constructor)('PGlite','fs',setup+';return {db,id};')(PGlite,fs);
await db.exec(`alter table exceptions add column superseded_by_exception_id uuid;
create schema storage;create table storage.objects(bucket_id text,name text);
create table source_files(id uuid,company text,kind text,storage_path text,is_archived boolean);
create function manual_primary_report_projection(j jsonb) returns jsonb language sql immutable as $$select j$$;`);
const guard=fs.readFileSync('supabase/20261014_pending_cross_day_actions.sql','utf8');
await db.exec(guard.slice(guard.indexOf('create or replace function public.cross_day_current_manual_case'),guard.indexOf('revoke all on function public.cross_day_current_manual_case'))
 .replace('v.base_run_id=e.run_id','v.base_run_id is not distinct from e.run_id')
 .replace('j.last_run_id=v.base_run_id','j.last_run_id is not distinct from v.base_run_id')
 .replace('q.result=v.report','public.manual_primary_report_projection(q.result)=v.report'));
const patch=fs.readFileSync('supabase/20261019_manual_primary_reuse_cases.sql','utf8');
await db.exec(patch);await db.exec(patch);
const read=async(q,args=[])=>(await db.query(q,args)).rows;
const counts=async()=>read('select (select count(*) from exceptions)::int cases,(select count(*) from manual_primary_results)::int versions,(select count(*) from manual_primary_case_items)::int links');
const accept=async request=>{
 const p=(await read('select manual_primary_preview($1) p',[request]))[0].p;assert.equal(p.allowed,true,JSON.stringify(p.problems));
 return (await read("select accept_manual_primary_with_cases($1,$2,'Reviewed exact source lineage and preserved original case state',true) r",[request,p.token]))[0].r;
};
for(const [idx,company] of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'].entries()){
 const n=100+idx*30,date='2026-10-17',run=id(n),bo=id(n+1),req=id(n+2),req2=id(n+3);
 const files=[{id:bo,physical_source_file_id:bo,company,business_date:date,kind:'bo_main',checksum:'same-file'}];
 const ex=row=>({company,business_date:date,account:'BBL',direction:'ถอน',ex_type:'cross_day',system_amount:row===4?2:100,bank_amount:null,amount_diff:0,risk_amount:0,
 customer_details:{source_rows:{bo:{fileId:bo,row,date},stm:null}}});
 const waiting=row=>({account:'OTHER',direction:'withdraw',systemAmount:200,bankAmount:null,amountDiff:0,riskAmount:0,boDate:date,boTime:'23:00:00',boSource:{fileId:bo,row,date}});
 const report={quality:'passed',company,date,account:'ALL',direction:'all',bo_count:5,stm_count:0,matched:0,match_evidence:[],exceptions:[ex(1),ex(2),ex(3),ex(4)],summary:{waiting_bo:[waiting(5)]}};
 await db.query('insert into test_manifest values($1,$2)',[company,JSON.stringify(files)]);
 await db.query("insert into daily_recon_jobs(id,company,business_date,last_run_id,status) values($1,$2,$3,$4,'completed')",[id(n+4),company,date,run]);
 await db.query('insert into recon_runs values($1,$2,$3,0,6,0,4)',[run,company,date]);
 const job=async(r,body)=>db.query("insert into account_recheck_jobs values($1,$2,$3,'ALL','all','account','confirmed',1,$4,$5,$6,$7)",[r,company,date,run,JSON.stringify({effective_files:files}),[bo],JSON.stringify(body)]);
 await job(req,report);const first=await accept(req);assert.equal(first.case_set.created,5);
 // Changes below prepare isolated fixtures, never production.
 await db.query("update exceptions set status=case customer_details->>'manual_primary_row_index' when '0' then 'closed' when '1' then 'answered' when '2' then 'clarifying' else status end where company=$1",[company]);
 await db.query("update exceptions set status='closed' where company=$1 and customer_details->>'manual_primary_row_kind'='waiting'",[company]);
 const before=await read('select * from exceptions where company=$1 order by id',[company]);
 const newer=structuredClone(report);newer.exceptions=newer.exceptions.filter(x=>x.system_amount!==2);
 newer.stm_count=1;newer.matched=1;newer.match_evidence=[{amount:2,bo:{fileId:bo,row:4},stm:{fileId:bo,row:33}}];
 // Row kind/index and harmless metadata change do not change physical lineage.
 newer.exceptions.reverse();for(const x of newer.exceptions)delete x.customer_details.source_rows.bo.date;
 await job(req2,newer);const second=await accept(req2);
 assert.equal(second.case_set.created,0);assert.equal(second.case_set.reused,4);assert.equal(second.case_set.case_count,4);
 assert.deepEqual(await read('select * from exceptions where company=$1 order by id',[company]),before);
 const links=await read('select i.*,e.status from manual_primary_case_items i join exceptions e on e.id=i.exception_id where primary_id=$1',[second.id]);
 assert.equal(links.length,4);assert.equal(links.filter(x=>x.status==='closed').length,2);
 assert.equal(new Set(links.map(x=>x.exception_id)).size,4);
 assert.equal((await read('select read_manual_primary_case_set($1) r',[second.id]))[0].r.closed_count,2);
 assert.equal((await accept(req2)).case_set.replayed,true);
 assert.equal((await read('select count(*)::int n from exceptions where company=$1',[company]))[0].n,5);
 assert.equal((await read('select count(*)::int n from active_audit_exceptions where company=$1',[company]))[0].n,4);
 const two=before.find(x=>x.system_amount==='2');assert.equal((await read('select primary_case_is_current($1) yes',[two.id]))[0].yes,false);
 // Fresh source/storage proof grants reused open cases normal manual authority.
 await db.query("insert into source_files values($1,$2,'bo_main',$3,false)",[bo,company,company+'.xlsx']);
 await db.query("insert into storage.objects values('audit-files',$1)",[company+'.xlsx']);
 const reusedOpen=links.find(x=>x.status==='answered');
 assert.equal((await read('select cross_day_current_manual_case(e) yes from exceptions e where id=$1',[reusedOpen.exception_id]))[0].yes,true);
 await db.query("update account_recheck_jobs set status='ready' where id=$1",[req2]);
 assert.equal((await read('select cross_day_current_manual_case(e) yes from exceptions e where id=$1',[reusedOpen.exception_id]))[0].yes,false);
 await db.query("update account_recheck_jobs set status='confirmed' where id=$1",[req2]);
 // Same amount with a DIFFERENT row must create a separate case, never merge.
 const distinct=structuredClone(newer);distinct.exceptions.push(ex(6));distinct.bo_count=6;await job(id(n+5),distinct);
 assert.equal((await accept(id(n+5))).case_set.created,1);
 // Same row but changed amount must roll back acceptance, not create a duplicate.
 const conflict=structuredClone(newer);conflict.exceptions[0].system_amount=999;await job(id(n+6),conflict);
 const pre=await counts();await assert.rejects(accept(id(n+6)),/ยอดเปลี่ยน/);assert.deepEqual(await counts(),pre);
 // Ambiguous existing lineage, invalid provenance and duplicate report rows fail closed.
 const duplicate=structuredClone(newer);duplicate.exceptions.push(duplicate.exceptions[0]);await job(id(n+7),duplicate);
 await assert.rejects(accept(id(n+7)));assert.deepEqual(await counts(),pre);
 const invalid=structuredClone(newer);invalid.exceptions[0].customer_details.source_rows.bo.row=0;await job(id(n+8),invalid);
 await assert.rejects(accept(id(n+8)),/ต้นทาง/);assert.deepEqual(await counts(),pre);
 // Existing system case (without manual metadata) also keeps its original ID/state.
 const systemEx=ex(7),systemId=id(n+10);
 await db.query("insert into exceptions(id,run_id,code,company,business_date,account,direction,status,system_amount,bank_amount,customer_details) values($1,$2,'system-original',$3,$4,'BBL','ถอน','closed',100,null,$5)",[systemId,run,company,date,JSON.stringify(systemEx.customer_details)]);
 const fromSystem=structuredClone(newer);fromSystem.exceptions.push(systemEx);fromSystem.bo_count=6;await job(id(n+9),fromSystem);
 const systemResult=await accept(id(n+9));assert.equal(systemResult.case_set.created,0);assert.equal(systemResult.case_set.reused,5);
 assert.equal((await read('select status from exceptions where id=$1',[systemId]))[0].status,'closed');
 const duplicateId=id(n+11);
 await db.query("insert into exceptions(id,company,business_date,account,direction,status,system_amount,bank_amount,customer_details) values($1,$2,$3,'BBL','ถอน','closed',100,null,$4)",[duplicateId,company,date,JSON.stringify(systemEx.customer_details)]);
 await job(id(n+12),fromSystem);const ambiguousBefore=await counts();
 await assert.rejects(accept(id(n+12)),/หลายเคส/);assert.deepEqual(await counts(),ambiguousBefore);
}
await db.exec("set test.actor='00000000-0000-4000-8000-000000000003'");
await assert.rejects(db.query("select activate_manual_primary_cases($1,'invalid','Unauthorized synthetic acceptance',true)",[id(1)]),/หัวหน้า/);
assert.doesNotMatch(patch,/^\s*update public\.(exceptions|account_review_holds|audit_run_holds)|disable.*trigger/im);
console.log('PASS exact-case reuse: 9 companies; manual versions; closed/answered/clarifying states untouched; physical lineage; changed row/amount; duplicate rows; rollback; idempotency; current-source guards; no closure/hold writes.');
await db.close();
