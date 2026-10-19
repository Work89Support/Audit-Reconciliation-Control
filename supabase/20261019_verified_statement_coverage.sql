-- Append-only technical PDF row verification. Not an approval or a rerun.
-- Only the database owner can record an independently inspected statement pair.
-- Head/Admin still confirms the unchanged staged report through normal RPCs.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table if not exists public.manual_statement_coverage_reviews (
 id uuid primary key default gen_random_uuid(),
 recheck_id uuid not null references public.account_recheck_jobs(id),
 prior_primary_id uuid not null references public.manual_primary_results(id),
 company text not null,business_date date not null,
 old_file_id uuid not null,new_file_id uuid not null,
 old_stamp jsonb not null,new_stamp jsonb not null,
 result_hash text not null check(result_hash~'^[0-9a-f]{32}$'),
 old_sha256 text not null check(old_sha256~'^[0-9a-f]{64}$'),
 new_sha256 text not null check(new_sha256~'^[0-9a-f]{64}$'),
 old_rows jsonb not null check(jsonb_typeof(old_rows)='array' and jsonb_array_length(old_rows)>0),
 new_rows jsonb not null check(jsonb_typeof(new_rows)='array' and jsonb_array_length(new_rows)>0),
 note text not null check(length(note)>=20),
 verified_at timestamptz not null default now(),
 verified_by_database text not null default current_user,
 check(old_file_id<>new_file_id),
 unique(recheck_id,old_file_id,new_file_id,result_hash)
);
alter table public.manual_statement_coverage_reviews enable row level security;
drop policy if exists statement_coverage_read on public.manual_statement_coverage_reviews;
create policy statement_coverage_read on public.manual_statement_coverage_reviews for select to authenticated
 using(public.current_user_active() and public.has_company_access(company));
revoke all on public.manual_statement_coverage_reviews from public,anon,authenticated;
grant select on public.manual_statement_coverage_reviews to authenticated;
create or replace function public.guard_statement_coverage_immutable() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin raise exception 'Statement coverage reviews are append-only';end $$;
drop trigger if exists statement_coverage_immutable on public.manual_statement_coverage_reviews;
create trigger statement_coverage_immutable before update or delete on public.manual_statement_coverage_reviews
 for each row execute function public.guard_statement_coverage_immutable();
revoke all on function public.guard_statement_coverage_immutable() from public,anon,authenticated;

create or replace function public.manual_statement_covered(q public.account_recheck_jobs,f jsonb,stamps jsonb)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(exists(
 select 1 from public.manual_statement_coverage_reviews r
 join public.manual_primary_results prior on prior.id=r.prior_primary_id
 where q.status='confirmed' and q.result->>'quality'='passed' and q.account='ALL' and q.direction='all'
 and r.recheck_id=q.id and r.result_hash=md5(q.result::text)
 and r.company=q.company and r.business_date=q.business_date
 and prior.company=q.company and prior.business_date=q.business_date
 and r.old_file_id::text=f->>'id' and r.old_stamp=f
 and f->>'kind'='stm_pdf' and r.new_stamp->>'kind'='stm_pdf'
 and f->>'company'=q.company and r.new_stamp->>'company'=q.company
 and not r.old_file_id=any(q.selected_file_ids) and r.new_file_id=any(q.selected_file_ids)
 and r.new_stamp->>'id'=r.new_file_id::text
 and r.new_stamp is not distinct from (select s from jsonb_array_elements(stamps)s where s->>'id'=r.new_file_id::text)
 and nullif(f->>'etag','') is not null and nullif(r.new_stamp->>'etag','') is not null
 and f->>'physical' is distinct from r.new_stamp->>'physical'
 and jsonb_array_length(r.new_rows)>=jsonb_array_length(r.old_rows)
 -- Check every physical transaction, including multiplicity and running balance.
 and not exists(select x-'row' from jsonb_array_elements(r.old_rows)x
  except all select x-'row' from jsonb_array_elements(r.new_rows)x)
 and not exists(select 1 from jsonb_array_elements(r.old_rows||r.new_rows)x where
  coalesce(x->>'row','')!~'^[1-9][0-9]*$' or coalesce(x->>'date','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  or coalesce(x->>'account','')='' or coalesce(x->>'direction','') not in ('deposit','withdraw')
  or jsonb_typeof(x->'amount') is distinct from 'number' or jsonb_typeof(x->'balance') is distinct from 'number'
  or nullif(x->>'detail','') is null or nullif(x->>'via','') is null)
 and jsonb_array_length(r.old_rows)=(select count(distinct x->>'row') from jsonb_array_elements(r.old_rows)x)
 and jsonb_array_length(r.new_rows)=(select count(distinct x->>'row') from jsonb_array_elements(r.new_rows)x)
 and (select count(distinct x->>'account') from jsonb_array_elements(r.old_rows||r.new_rows)x)=1
 and not exists(select 1 from (values(r.old_rows),(r.new_rows)) docs(rows)
  cross join lateral (select x,lag((x->>'balance')::numeric) over(order by (x->>'row')::numeric) previous
   from jsonb_array_elements(docs.rows)x) tx
  where previous is not null and round(previous+case when x->>'direction'='deposit' then (x->>'amount')::numeric else -(x->>'amount')::numeric end,2)<>(x->>'balance')::numeric)
 -- Every selected statement row for this business day must already be a unique
 -- real matched pointer in the staged result. Unmatched or ambiguous data blocks.
 and (select count(*) from jsonb_array_elements(r.new_rows)x where x->>'date'=q.business_date::text)>0
 and (select count(*) from jsonb_array_elements(r.new_rows)x where x->>'date'=q.business_date::text)
  =(select count(*) from jsonb_array_elements(q.result->'match_evidence')p where p#>>'{stm,fileId}'=r.new_stamp->>'physical')
 and not exists(select 1 from jsonb_array_elements(r.new_rows)x where x->>'date'=q.business_date::text and
  1<>(select count(*) from jsonb_array_elements(q.result->'match_evidence')p
  where p#>>'{stm,fileId}'=r.new_stamp->>'physical' and p#>>'{stm,row}'=x->>'row'
  and p#>>'{stm,date}'=x->>'date' and p->>'account'=x->>'account' and p->>'direction'=x->>'direction'
  and coalesce(p->'stmAmount',p->'amount')=x->'amount'))
 -- Bind old-day row coverage to the prior accepted statement, not just totals.
 and exists(select 1 from jsonb_array_elements(prior.source_stamp)p where p=f)
 and (select count(*) from jsonb_array_elements(r.old_rows)x where x->>'date'=q.business_date::text)
  =(select count(*) from jsonb_array_elements(prior.report->'match_evidence')p where p#>>'{stm,fileId}'=f->>'physical')
 and not exists(select 1 from jsonb_array_elements(r.old_rows)x where x->>'date'=q.business_date::text and
  1<>(select count(*) from jsonb_array_elements(prior.report->'match_evidence')p
  where p#>>'{stm,fileId}'=f->>'physical' and p#>>'{stm,row}'=x->>'row'
  and p#>>'{stm,date}'=x->>'date' and p->>'account'=x->>'account' and p->>'direction'=x->>'direction'
  and coalesce(p->'stmAmount',p->'amount')=x->'amount'))
 ),false)
$$;
revoke all on function public.manual_statement_covered(public.account_recheck_jobs,jsonb,jsonb) from public,anon,authenticated;
do $patch$
declare d text;a text;b text;
begin
 d:=pg_get_functiondef('public.manual_primary_preview(uuid)'::regprocedure);
 if position('public.manual_statement_covered(q,f,stamp)' in d)>0 then return;end if;
 a:=$old$exists(select 1 from jsonb_array_elements(stamp) f where not (f->>'id')::uuid=any(coalesce(q.selected_file_ids,'{}')))$old$;
 b:=$new$exists(select 1 from jsonb_array_elements(stamp) f where not (f->>'id')::uuid=any(coalesce(q.selected_file_ids,'{}')) and not public.manual_statement_covered(q,f,stamp))$new$;
 if (length(d)-length(replace(d,a,'')))<>length(a)
 or position('stamp<>public.manual_primary_sources(q.snapshot->''effective_files'')' in d)=0
 or position('q.result->>''quality''' in d)=0
 or position('public.current_app_role()' in d)=0
 then raise exception 'Unexpected primary coverage definition';end if;
 d:=replace(d,a,b);
 a:=$old$'already_applied',exists(select 1 from public.manual_primary_results where recheck_id=q.id)$old$;
 b:=$new$'selected_file_count',cardinality(q.selected_file_ids),
 'statement_coverage',(select coalesce(jsonb_agg(jsonb_build_object(
 'old_file',r.old_stamp->>'name','new_file',r.new_stamp->>'name',
 'old_rows',jsonb_array_length(r.old_rows),'new_rows',jsonb_array_length(r.new_rows),
 'old_day_rows',(select count(*) from jsonb_array_elements(r.old_rows)x where x->>'date'=q.business_date::text),
 'new_day_rows',(select count(*) from jsonb_array_elements(r.new_rows)x where x->>'date'=q.business_date::text))), '[]')
 from public.manual_statement_coverage_reviews r where r.recheck_id=q.id and public.manual_statement_covered(q,r.old_stamp,stamp)),
 'already_applied',exists(select 1 from public.manual_primary_results where recheck_id=q.id)$new$;
 if (length(d)-length(replace(d,a,'')))<>length(a) then raise exception 'Unexpected primary preview receipt';end if;
 execute replace(d,a,b);
end $patch$;
notify pgrst,'reload schema';
commit;
