import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create table manual_primary_case_sets(company text,business_date date);
create table exceptions(id int primary key,company text,business_date date,run_id uuid,lifecycle_key text,status text,amount numeric,proof jsonb);
create function guard_history() returns trigger language plpgsql as $$begin
 if exists(select 1 from manual_primary_case_sets b where b.company=old.company and b.business_date=old.business_date) then raise exception 'HISTORY PROTECTED';end if;return new;end$$;
create trigger unchanged before update on exceptions for each row execute function guard_history();
create function finish_daily_recon_job(p_job_id uuid,p_run_id uuid) returns void language plpgsql as $$
declare v_old_run_id uuid:=p_job_id;begin
 update public.exceptions e set lifecycle_key='new' where e.run_id=p_run_id and e.lifecycle_key is null;
 update public.exceptions e set lifecycle_key='old' where e.run_id=v_old_run_id and e.lifecycle_key is null;
 create temporary table finish_old on commit drop as select e.* from public.exceptions e where e.run_id=v_old_run_id and e.status in ('open','answered');
 update exceptions set status='carried' where id in(select id from finish_old);
end$$;
create function preserve_approved_case_closures(p_run uuid,p_apply boolean,p_cases uuid[]) returns void language plpgsql as $$begin
 if p_apply then update public.exceptions e set status='closed' where e.run_id=p_run and e.status='open';end if;end$$;
create function preserve_native_cross_day_closures(p_run uuid,p_apply boolean,p_cases uuid[]) returns void language plpgsql as $$begin
 if p_apply then update public.exceptions e set status='closed' where e.run_id=p_run and e.status='native';end if;end$$;`);
const patch=fs.readFileSync('supabase/20261019_worker_primary_history_boundary.sql','utf8');
await db.exec(patch);await db.exec(patch);
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
const current='00000000-0000-4000-8000-000000000001',old='00000000-0000-4000-8000-000000000002';
for(const [i,company] of companies.entries()){
 await db.query("insert into manual_primary_case_sets values($1,'2026-10-17')",[company]);
 // A prior-day row inside today's run, plus a historical previous run. Neither
 // the worker's lack of interactive auth nor today's run ID makes it mutable.
 for(const [offset,date,run,status] of [[0,'2026-10-17',current,'open'],[1,'2026-10-17',old,'answered'],[2,'2026-10-18',current,'open'],[3,'2026-10-17',current,'native']]){
  await db.query("insert into exceptions values($1,$2,$3,$4,null,$5,50,'{\"original\":true}')",[i*10+offset,company,date,run,status]);
 }
}
const before=(await db.query("select * from exceptions where business_date='2026-10-17' order by id")).rows;
await db.query('select finish_daily_recon_job($1,$2)',[old,current]);
await db.query('select preserve_approved_case_closures($1,true,null)',[current]);
await db.query('select preserve_native_cross_day_closures($1,true,null)',[current]);
assert.deepEqual((await db.query("select * from exceptions where business_date='2026-10-17' order by id")).rows,before);
assert.equal((await db.query("select count(*)::int n from exceptions where business_date='2026-10-18' and lifecycle_key='new'")).rows[0].n,9);
assert.equal((await db.query('select sum(amount)::int n from exceptions')).rows[0].n,1800);
await assert.rejects(db.exec("update exceptions set status='open' where id=1"),/HISTORY PROTECTED/);
assert.equal((await db.query('select count(*)::int n from exceptions')).rows[0].n,36);
console.log('PASS 9 companies: previous-day rows, old runs, approval/native hooks, immutable history, unchanged amounts/counts, guard retained, idempotent installation');
await db.close();
