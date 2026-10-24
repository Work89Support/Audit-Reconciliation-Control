import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=await PGlite.create();
const migration=fs.readFileSync('supabase/20261014_waiting_evidence_uuid_lookup.sql','utf8');
const permissionRepair=fs.readFileSync('supabase/20261024_restore_waiting_evidence_execute.sql','utf8');
await db.exec(`create role authenticated;create schema auth;create schema storage;
create function auth.uid() returns uuid language sql stable as $$select current_setting('app.user')::uuid$$;
create function current_user_active() returns boolean language sql stable as $$select current_setting('app.active')='true'$$;
create function has_company_access(c text) returns boolean language sql stable as $$select c=current_setting('app.company')$$;
create table exceptions(id uuid primary key,company text,status text);
alter table exceptions enable row level security;
create policy scoped on exceptions for select to authenticated using(current_user_active() and has_company_access(company));
create function can_attach_waiting_cross_day_evidence(c uuid) returns boolean language sql stable security definer as $$
select current_user_active() and current_setting('app.role') in ('monitor','lead','admin')
and exists(select 1 from exceptions where id=c and status='pending_next_day' and has_company_access(company))$$;
revoke all on function can_attach_waiting_cross_day_evidence(uuid) from public,authenticated;
create table storage.objects(bucket_id text,name text unique);
alter table storage.objects enable row level security;
create policy waiting_cross_day_object_insert on storage.objects for insert to authenticated with check(
bucket_id='audit-files' and split_part(name,'/',1)='case-evidence'
and split_part(name,'/',3)=auth.uid()::text and array_length(string_to_array(name,'/'),1)=4
and exists(select 1 from exceptions e where e.id::text=split_part(objects.name,'/',2) and can_attach_waiting_cross_day_evidence(e.id)));
grant usage on schema auth,storage to authenticated;grant select on exceptions to authenticated;grant insert on storage.objects to authenticated;`);
const user='abcdefab-0000-4000-8000-000000000001';
const id='abcdefab-0000-4000-8000-000000000002';
await db.query("insert into exceptions values($1,'FR8','pending_next_day')",[id]);
const original=(await db.query("select with_check from pg_policies where policyname='waiting_cross_day_object_insert'")).rows[0].with_check;
assert.equal((await db.query("select has_function_privilege('authenticated','can_attach_waiting_cross_day_evidence(uuid)','execute') ok")).rows[0].ok,false);
await db.exec(migration);await db.exec(migration);await db.exec(permissionRepair);await db.exec(permissionRepair);
assert.equal((await db.query("select has_function_privilege('authenticated','can_attach_waiting_cross_day_evidence(uuid)','execute') ok")).rows[0].ok,true);
const patched=(await db.query("select with_check from pg_policies where policyname='waiting_cross_day_object_insert'")).rows[0].with_check;
assert.match(patched,/e.id =\s+CASE/);assert.doesNotMatch(patched,/\(e.id\)::text/);
const path=`case-evidence/${id}/${user}/abcdefab-0000-4000-8000-000000000003`;
const actor=async(role='monitor',company='FR8',active='true')=>{
await db.exec('reset role');await db.query("select set_config('app.user',$1,false),set_config('app.role',$2,false),set_config('app.company',$3,false),set_config('app.active',$4,false)",[user,role,company,active]);await db.exec('set role authenticated');};
const upload=(name=path,bucket='audit-files')=>db.query('insert into storage.objects values($1,$2)',[bucket,name]);
await actor();await upload();await assert.rejects(upload(),/duplicate/);
await assert.rejects(upload(path.replace(id,id.toUpperCase())),/row-level security/);
await assert.rejects(upload(path.replace(id,'invalid-uuid')),/row-level security/);
await assert.rejects(upload(path.replace(user,id)),/row-level security/);
await assert.rejects(upload(path+'/extra'),/row-level security/);
await assert.rejects(upload(path,'other-bucket'),/row-level security/);
await actor('shift_lead');await assert.rejects(upload(path+'4'),/row-level security/);
await actor('monitor','OTHER');await assert.rejects(upload(path+'4'),/row-level security/);
await actor('monitor','FR8','false');await assert.rejects(upload(path+'4'),/row-level security/);
await db.exec('reset role');await db.exec("update exceptions set status='closed'");await actor();await assert.rejects(upload(path+'4'),/row-level security/);
await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
assert.ok(original.includes('can_attach_waiting_cross_day_evidence') && patched.includes('can_attach_waiting_cross_day_evidence'));
await db.close();
console.log('PASS lookup-only repair: idempotent migration, valid upload, duplicate refusal, role/company/active/status/owner/path/bucket denials. Synthetic database only.');
