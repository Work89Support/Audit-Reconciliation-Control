import assert from 'node:assert/strict';
import fs from 'node:fs';

const {PGlite}=await import(process.argv[2]);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query=(sql,args=[])=>db.query(sql,args);

await db.exec(`
create role anon;create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create function current_user_active() returns boolean language sql as $$select coalesce(current_setting('test.active',true),'true')='true'$$;
create function has_company_access(c text) returns boolean language sql as $$select c=current_setting('test.company',true)$$;
create table exceptions(
 id uuid primary key,run_id uuid,company text,business_date date,occurred_at time,bo_time time,direction text,account text,
 currency text,system_amount numeric,bank_amount numeric,bo_raw text,stm_raw text,customer_details jsonb default '{}',
 ex_type text,status text,superseded_by_exception_id uuid,cross_day_request_id uuid,manual_pair_id uuid,
 case_closure_request_id uuid,governance_request_id uuid
);
create function cross_day_actionable_case(e exceptions) returns boolean language sql stable as
$$select e.ex_type in ('cross_day','missing_stm') and e.system_amount>0$$;
create function cross_day_case_source_ready(e exceptions) returns boolean language sql stable as
$$select coalesce((e.customer_details->>'ready')::boolean,true)$$;
create table mail_batches(id uuid primary key,company text,business_date date);
create table source_files(id uuid primary key,company text,kind text,storage_path text,file_name text,is_archived boolean default false,batch_id uuid);
create table verified_rows(source_file_id uuid,row_data jsonb);
create function cross_day_verified_rows(p_file uuid) returns setof jsonb language sql stable as
$$select row_data from verified_rows where source_file_id=p_file$$;
`);
await db.exec(fs.readFileSync('supabase/20261022_scoped_cross_day_workbench.sql','utf8'));
await query(`select set_config('test.user',$1,false),set_config('test.company','3XB',false)`,[id(1)]);
const details={ready:true};
for(const [n,account,time,ready] of [[10,'5034633029','23:10',true],[11,'5034633029','23:58',true],[12,'5034633029','22:59',true],[13,'OTHER','23:30',true],[14,'5034633029','23:40',false]]){
 await query(`insert into exceptions(id,run_id,company,business_date,occurred_at,bo_time,direction,account,currency,system_amount,customer_details,ex_type,status)
 values($1,$2,'3XB','2026-10-21',$3,$3,'ฝาก',$4,'THB',100,$5,'cross_day','open')`,[id(n),id(2),time,account,{...details,ready}]);
}
await query(`insert into mail_batches values($1,'3XB','2026-10-22'),($2,'3XB','2026-10-30')`,[id(20),id(21)]);
await query(`insert into source_files values($1,'3XB','stm_pdf','near.pdf','near.pdf',false,$3),($2,'3XB','stm_pdf','far.pdf','far.pdf',false,$4)`,[id(30),id(31),id(20),id(21)]);
await query(`insert into verified_rows values($1,$2),($1,$3),($1,$4)`,[id(30),
 {rowNo:1,account:'5034633029',date:'2026-10-21',sec:85500,amount:100},
 {rowNo:2,account:'OTHER',date:'2026-10-21',sec:85510,amount:100},
 {rowNo:3,account:'5034633029',date:'2026-10-21',sec:82000,amount:100}]);
const result=(await query(`select cross_day_workbench_for_case($1) result`,[id(10)])).rows[0].result;
assert.equal(result.version,2);
assert.equal(result.scope.account,'5034633029');
assert.deepEqual(result.cases.map(row=>row.id),[id(10),id(11)]);
assert.equal(result.files.length,1);
assert.equal(result.files[0].file_name,'near.pdf');
assert.deepEqual(result.files[0].rows.map(row=>row.rowNo),[1]);
await query(`select set_config('test.company','FR8',false)`);
await assert.rejects(query(`select cross_day_workbench_for_case($1)`,[id(10)]));
console.log('Synthetic PostgreSQL: exact case/company/account/day scope and adjacent STM row filtering passed; no production writes.');
await db.close();
