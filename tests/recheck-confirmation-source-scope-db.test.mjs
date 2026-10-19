import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const baseline=fs.readFileSync('tests/all-company-primary-handoff-db.test.mjs','utf8');
const setup=baseline.slice(baseline.indexOf('const db='),baseline.indexOf('const companies='));
const {db,id}=await new (Object.getPrototypeOf(async function(){}).constructor)('PGlite','fs',setup+';return {db,id};')(PGlite,fs);
// Compile the production confirmation body against isolated fixture columns.
await db.exec(`alter table account_recheck_jobs add column confirmed_by uuid,add column confirmed_at timestamptz,add column confirmation_reason text,add column updated_at timestamptz;
create function account_recheck_snapshot(text,date) returns jsonb language sql as $$select '{}'::jsonb$$;`);
const original=fs.readFileSync('supabase/20261013_manual_run_readiness.sql','utf8');
await db.exec(original.slice(original.indexOf('create or replace function public.confirm_account_recheck'),original.indexOf('create or replace function public.list_account_rechecks')));
const patch=fs.readFileSync('supabase/20261019_recheck_confirmation_source_scope.sql','utf8');await db.exec(patch);await db.exec(patch);
const old={job:{id:id(1)},cases:[{id:id(2),status:'closed',amount:2}],evidence:[{id:id(3)}],effective_files:[{id:id(4),physical_source_file_id:id(5),checksum:'original'},{id:id(6),excluded:true}],files:[{id:id(4),kind:'pm_statement',size:100},{id:id(5),kind:'pm_statement',size:100},{id:id(7),kind:'pm_statement',date:'unused-next-day'}]};
const same=async(a,b,chosen=[id(4)])=>(await db.query('select account_recheck_snapshots_equal($1,$2,$3) yes',[JSON.stringify(a),JSON.stringify(b),chosen])).rows[0].yes;
const fresh=structuredClone(old);fresh.files.pop();assert.equal(await same(old,fresh),true);
for(const change of [x=>x.cases[0].status='open',x=>x.cases[0].amount=3,x=>x.evidence=[],x=>x.job.id=id(8),x=>x.effective_files[0].checksum='changed',x=>x.effective_files.push({id:id(9)}),x=>x.files[0].size=101,x=>x.files[1].size=101,x=>x.files.splice(1,1)]){
 const modified=structuredClone(fresh);change(modified);assert.equal(await same(old,modified),false);
}
assert.equal(await same(old,fresh,[]),false);assert.equal(await same(old,fresh,[id(4),id(4)]),false);assert.equal(await same(old,fresh,[id(99)]),false);
assert.equal(await same(old,old),true);
const d=(await db.query("select pg_get_functiondef('confirm_account_recheck(uuid,integer,text,boolean)'::regprocedure) d")).rows[0].d;
for(const gate of ["q.result->>'quality'","q.revision<>p_expected_revision","public.current_app_role()","public.has_company_access(q.company)","j.last_run_id is distinct from q.base_run_id","p_reviewed","for update"])assert(d.includes(gate));
console.log('PASS unused raw-window change only; full effective manifest/selected logical+physical bytes/quality/revision/roles/job/cases/evidence remain guarded; no snapshot rewrite or re-run.');await db.close();
