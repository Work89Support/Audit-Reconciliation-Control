import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create role anon;create role authenticated;
create table app_profiles(id uuid,active boolean);create table user_company_access(id uuid,company text);
create function current_user_active() returns boolean language sql stable security definer as $$select coalesce((select active from app_profiles where id=current_setting('test.actor')::uuid),false)$$;
create function has_company_access(c text) returns boolean language sql stable security definer as $$select exists(select 1 from user_company_access where id=current_setting('test.actor')::uuid and company=c)$$;
create table daily_recon_jobs(company text,business_date date,last_run_id uuid,status text,error_count integer,is_archived boolean);
create table recon_runs(id uuid,company text,business_date date);
create table manual_primary_results(id uuid primary key,company text,business_date date,base_run_id uuid,accepted_at timestamptz);
create table exceptions(id uuid primary key,company text,business_date date,run_id uuid,occurred_at time,status text,requested_at timestamptz,customer_details jsonb,superseded_by_exception_id uuid,amount_diff numeric);
create table manual_primary_case_items(primary_id uuid,exception_id uuid,unique(primary_id,exception_id));
create table account_review_holds(id uuid,detail text);insert into account_review_holds values('${id(99)}','preserve');
insert into app_profiles values('${id(1)}',true),('${id(2)}',true),('${id(3)}',false);
grant select on all tables in schema public to authenticated;`);
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
for(const [index,c] of companies.entries()){
 const n=100+index*10;
 await db.query('insert into user_company_access values($1,$2),($3,$2)',[id(1),c,id(3)]);
 await db.query("insert into daily_recon_jobs values($1,'2026-10-16',null,'error',1,false)",[c]);
 await db.query("insert into manual_primary_results values($1,$2,'2026-10-16',null,now())",[id(n),c]);
 for(const [j,status] of ['clarifying','pending_next_day','open'].entries()){
  await db.query("insert into exceptions values($1,$2,'2026-10-16',null,'12:00',$3,$4,$5,null,100)",[id(n+j+1),c,status,j===0?'2026-10-17T00:00Z':null,JSON.stringify({manual_primary_id:id(n)})]);
  await db.query('insert into manual_primary_case_items values($1,$2)',[id(n),id(n+j+1)]);
 }
 // A historical null-run row is not a member of the accepted primary.
 await db.query("insert into exceptions values($1,$2,'2026-10-16',null,'13:00','clarifying',now(),'{}',null,900)",[id(n+4),c]);
}
await db.query("insert into user_company_access values($1,'FR8')",[id(2)]);
for(const table of ['exceptions','daily_recon_jobs','manual_primary_results'])await db.exec(`alter table ${table} enable row level security;create policy scoped_read on ${table} for select to authenticated using(current_user_active() and has_company_access(company));`);
await db.exec('alter table manual_primary_case_items enable row level security;create policy scoped_items on manual_primary_case_items for select to authenticated using(exists(select 1 from manual_primary_results p where p.id=primary_id));');
const migration=fs.readFileSync('supabase/20261017_manual_primary_scoped_queue.sql','utf8');
assert.doesNotMatch(migration,/security definer|update public|insert into|delete from|alter policy/i);
await db.exec(migration);await db.exec(migration);
const fingerprint=async()=>JSON.stringify((await db.query(`select (select jsonb_agg(to_jsonb(e) order by id) from exceptions e) cases,(select jsonb_agg(to_jsonb(p) order by id) from manual_primary_results p) primaries,(select jsonb_agg(to_jsonb(h)) from account_review_holds h) holds`)).rows);
const before=await fingerprint();
const actor=async n=>{await db.exec('reset role');await db.query("select set_config('test.actor',$1,false)",[id(n)]);await db.exec('set role authenticated');};
const read=async(c='ALL',offset=0,limit=1000)=>(await db.query("select * from audit_current_cases_scoped('2026-10-16','2026-10-16',$1,$2,$3)",[c,limit,offset])).rows;
await actor(1);let rows=await read();assert.equal(rows.length,27);assert.equal(new Set(rows.map(r=>r.id)).size,27);
assert.equal(rows.filter(r=>r.requested_at&&r.status==='clarifying').length,9,'all nine manual sent cases reach the responder input');
for(const c of companies)assert.equal((await read(c)).length,3,c);
const pages=[];for(let offset=0;offset<27;offset+=4)pages.push(...await read('ALL',offset,4));assert.deepEqual(pages.map(r=>r.id),rows.map(r=>r.id));
assert.equal((await db.query("select * from audit_current_cases_scoped('2026-10-15','2026-10-15','ALL')")).rows.length,0);
await actor(2);assert.equal((await read()).length,3);assert.equal((await read('PS8')).length,0,'no cross-company access');
await actor(3);await assert.rejects(read(),/Active authenticated/);
await db.exec('reset role;set role anon');await assert.rejects(read(),/permission denied/);
await db.exec('reset role');assert.equal(await fingerprint(),before,'reads preserve cases, amounts, primaries and holds');
// Old primary versions and archived scopes are not current.
await db.query("insert into manual_primary_results values($1,'FR8','2026-10-16',null,now()+interval '1 second')",[id(500)]);
await actor(1);assert.equal((await read('FR8')).length,0,'old manual version excluded');
await db.exec("reset role;update daily_recon_jobs set is_archived=true where company='PS8'");await actor(1);assert.equal((await read('PS8')).length,0);
// A newer valid system result supersedes manual; error/running does not leak it.
await db.exec('reset role');await db.query("insert into recon_runs values($1,'UR9','2026-10-16')",[id(600)]);
await db.query("insert into exceptions values($1,'UR9','2026-10-16',$2,'14:00','clarifying',now(),'{}',null,200)",[id(601),id(600)]);
await db.query("update daily_recon_jobs set last_run_id=$1,status='running',error_count=0 where company='UR9'",[id(600)]);
await actor(1);assert.equal((await read('UR9')).length,0);
await db.exec("reset role;update daily_recon_jobs set status='completed' where company='UR9'");await actor(1);assert.deepEqual((await read('UR9')).map(r=>r.id),[id(601)]);
await db.exec("reset role;update daily_recon_jobs set error_count=1 where company='UR9'");await actor(1);assert.equal((await read('UR9')).length,0);
// No manual primary: retain needs_review system visibility.
await db.exec("reset role;delete from manual_primary_results where company='UR9';update daily_recon_jobs set status='needs_review' where company='UR9'");await actor(1);assert.equal((await read('UR9')).length,1);
await db.close();console.log('PASS scoped queue DB: nine null-base manual companies, exact membership, sent filter, pagination, history, holds, RLS, inactive/anon, archive and newer-system gates. Synthetic data only.');
