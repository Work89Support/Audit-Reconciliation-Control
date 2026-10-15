-- Read-only analytics, except a private random salt used only to avoid exposing customer IDs.
begin;
set local lock_timeout='5s';
create table if not exists public.finance_analytics_private(id boolean primary key default true check(id),salt text not null);
insert into public.finance_analytics_private(id,salt) values(true,gen_random_uuid()::text||gen_random_uuid()::text) on conflict(id) do nothing;
alter table public.finance_analytics_private enable row level security;
revoke all on public.finance_analytics_private from public,anon,authenticated;

create or replace function public.finance_bo_aggregate(p_summary jsonb,p_exceptions jsonb,p_date date,p_expected integer)
returns jsonb language sql immutable as $$
 with raw as (
 select m->'bo' src,coalesce(m->>'boAmount',m->>'amount') amount,m->>'direction' direction,m->>'account' account,
 coalesce(m->'bo'->>'date',p_date::text) date,m->'bo'->>'sec' sec,m#>>'{customer,bo,user}' customer_user
 from jsonb_array_elements(coalesce(p_summary->'match_evidence','[]')) m
 union all
 select coalesce(nullif(e->'boSource','null'),e#>'{customer_details,source_rows,bo}'),coalesce(e->>'system_amount',e->>'systemAmount'),e->>'direction',e->>'account',
 coalesce(nullif(e->>'bo_date',''),nullif(e->>'boDate',''),p_date::text),
 case when coalesce(e->>'bo_time',e->>'boTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$' then extract(epoch from coalesce(e->>'bo_time',e->>'boTime')::time)::text end,
 coalesce(e->>'customer_user',e#>>'{customer_details,bo,user}',e#>>'{customerDetails,bo,user}')
 from jsonb_array_elements(coalesce(p_exceptions,'[]')) e
 union all
 select w->'boSource',coalesce(w->>'systemAmount',w->>'system_amount'),w->>'direction',w->>'account',coalesce(nullif(w->>'boDate',''),w->>'date',p_date::text),
 case when w->>'boTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$' then extract(epoch from (w->>'boTime')::time)::text end,
 coalesce(w#>>'{customerDetails,bo,user}',w#>>'{customer_details,bo,user}',w#>>'{customer,bo,user}',w->>'memberCode')
 from jsonb_array_elements(coalesce(p_summary->'waiting_bo','[]')) w
 ), normalized as (
 select (src->>'fileId')||':'||(src->>'row') key,public.finance_report_number(amount) amount,
 case direction when 'ฝาก' then 'deposit' when 'ถอน' then 'withdraw' else direction end direction,
 coalesce(nullif(account,''),'ไม่ระบุช่องทาง') account,date,
 case when sec ~ '^[0-9]+([.][0-9]+)?$' and length(sec)<12 then floor(sec::numeric/3600)::int end as hour,
 case when length(btrim(customer_user)) between 1 and 200 and lower(btrim(customer_user)) not in ('-','—','null','undefined','ไม่ระบุ','unknown') then btrim(customer_user) end customer_user
 from raw where src is not null and src<>'null'::jsonb
 ), valid as (
 select * from normalized where key ~* '^[0-9a-f-]{36}:[0-9]+$' and amount is not null and direction in ('deposit','withdraw') and date=p_date::text
 ), grouped as (
 select key,min(amount) amount,min(direction) direction,min(account) account,min(hour) as hour,
 count(distinct (amount,direction,account,date))>1 or count(distinct hour)>1 conflict,
 count(distinct customer_user)>1 user_conflict,case when count(distinct customer_user)=1 then min(customer_user) end customer_user
 from valid group by key
 ), clean as (select * from grouped where not conflict), totals as (
 select count(*)::int n,coalesce(sum(amount) filter(where direction='deposit'),0) deposit,coalesce(sum(amount) filter(where direction='withdraw'),0) withdraw,
 count(*) filter(where direction='deposit')::int deposits,count(*) filter(where direction='withdraw')::int withdrawals,
 count(*) filter(where customer_user is not null)::int identified_rows from clean
 ) select jsonb_build_object('count',n,'expected',p_expected,'deposit',deposit,'withdraw',withdraw,'deposits',deposits,'withdrawals',withdrawals,
 'identified_rows',identified_rows,'user_conflicts',(select count(*) from grouped where user_conflict),
 'conflicts',(select count(*) from grouped where conflict),
 'complete',n=p_expected and not exists(select 1 from grouped where conflict) and not exists(select 1 from normalized where key is null or key !~* '^[0-9a-f-]{36}:[0-9]+$' or amount is null or coalesce(direction,'') not in ('deposit','withdraw') or date is null or date<>p_date::text),
 'channels',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select account,coalesce(sum(amount) filter(where direction='deposit'),0) amount,coalesce(sum(amount) filter(where direction='withdraw'),0) withdraw,count(*)::int count,count(*) filter(where direction='deposit')::int deposits,count(*) filter(where direction='withdraw')::int withdrawals from clean group by account order by account) x),
 'source_ids',(select coalesce(jsonb_agg(distinct split_part(key,':',1)),'[]') from clean),
 'hours',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select hour,count(*)::int count,coalesce(sum(amount) filter(where direction='deposit'),0) deposit,coalesce(sum(amount) filter(where direction='withdraw'),0) withdraw from clean where hour between 0 and 23 group by hour order by hour) x),
 'users',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select customer_user as identity,count(*)::int count,count(*) filter(where direction='deposit')::int deposits,count(*) filter(where direction='withdraw')::int withdrawals from clean where customer_user is not null group by customer_user) x)
 ) from totals
$$;
create or replace function public.finance_bo_window(p_company text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scope text[];j record;r public.recon_runs;v jsonb;s jsonb;ex jsonb;days jsonb:='[]';a jsonb;ok boolean;d date;files jsonb;private_salt text;quality_ok boolean;fresh_ok boolean;sources_ok boolean;issues text[];
begin
 scope:=public.finance_reporting_companies();
 select salt into private_salt from public.finance_analytics_private where id=true;
 if not coalesce(p_company=any(scope),false) then raise exception 'ไม่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>6 then raise exception 'อ่าน BO ได้ครั้งละไม่เกิน 7 วัน';end if;
 for d in select generate_series(p_from,p_to,interval '1 day')::date loop
  quality_ok:=false;fresh_ok:=false;issues:='{}';
  select * into j from public.daily_recon_jobs where company=p_company and business_date=d and not is_archived;
  if j.id is null then days:=days||jsonb_build_array(jsonb_build_object('company',p_company,'date',d,'complete',false,'reason','ยังไม่มีผลหลัก'));continue;end if;
  select * into r from public.recon_runs where id=j.last_run_id and company=p_company and business_date=d;
  files:=public.effective_audit_source_files(p_company,d);
  v:=public.read_manual_primary(p_company,d);
  if coalesce((v->>'stale')::boolean,false) then
   days:=days||jsonb_build_array(jsonb_build_object('company',p_company,'date',d,'complete',false,'reason','ไฟล์หรือรอบเปลี่ยน ผลตรวจมือต้องทบทวน'));continue;
  end if;
  if v is not null then
   s:=coalesce(v->'report'->'summary','{}')||jsonb_build_object('match_evidence',coalesce(v->'report'->'match_evidence','[]'));
   ex:=v->'report'->'exceptions';
   a:=public.finance_bo_aggregate(s,ex,d,(v->'report'->>'bo_count')::int);
   quality_ok:=v->'report'->>'quality'='passed';fresh_ok:=true;
  elsif r.id is not null then
   s:=r.summary;
   select coalesce(jsonb_agg(jsonb_build_object('boSource',e.customer_details#>'{source_rows,bo}',
    'system_amount',e.system_amount,'direction',e.direction,'account',e.account,'bo_date',e.bo_date,'bo_time',e.bo_time,'customer_user',e.customer_details#>>'{bo,user}')),'[]') into ex
   from public.exceptions e where e.run_id=r.id and e.company=p_company and e.business_date=d;
   a:=public.finance_bo_aggregate(s,ex,d,r.bo_count);
   quality_ok:=j.status='completed' and s->>'source_parser_completion'='true' and s#>>'{bo_first,complete}'='true';
   fresh_ok:=r.created_at is not null and not exists(select 1 from jsonb_array_elements(files) f
     where f->>'kind' in ('bo_main','stm_pdf','pm_statement') and not coalesce((f->>'excluded')::boolean,false)
     and (not coalesce((f->>'id')::uuid=any(r.file_ids),false) or coalesce(f->>'revision','1')<>'1'
      or (f->>'storage_object_version')::timestamptz>r.created_at
      or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(f->'source_file_ocr')='array' then f->'source_file_ocr' else '[]'::jsonb end) o
        where coalesce(o->>'updated_at',o->>'created_at')::timestamptz>r.created_at)));
  else a:=jsonb_build_object('complete',false);ok:=false;
  end if;
  ok:=coalesce(quality_ok,false) and coalesce(fresh_ok,false) and coalesce((a->>'complete')::boolean,false);
  sources_ok:=exists(select 1 from jsonb_array_elements(files) f where f->>'kind'='bo_main' and not coalesce((f->>'excluded')::boolean,false))
   and not exists(select 1 from jsonb_array_elements_text(coalesce(a->'source_ids','[]')) sid
    where not exists(select 1 from jsonb_array_elements(files) f where f->>'kind'='bo_main' and not coalesce((f->>'excluded')::boolean,false)
     and sid in (f->>'id',f->>'physical_source_file_id')));
  ok:=ok and coalesce(sources_ok,false);
  if not coalesce((a->>'complete')::boolean,false) then issues:=array_append(issues,'แถว BO ที่อ่านย้อนกลับได้ไม่ครบ/ข้อมูลต้นทางขัดกัน');end if;
  if not coalesce(quality_ok,false) then issues:=array_append(issues,'เกณฑ์ผลหลักหรือ parser ยังไม่ผ่านครบ');end if;
  if not coalesce(fresh_ok,false) then issues:=array_append(issues,'ชุดไฟล์/เวอร์ชัน/OCR ต้องทบทวนกับผลหลัก');end if;
  if not coalesce(sources_ok,false) then issues:=array_append(issues,'แหล่ง BO ไม่ตรงชุดไฟล์ที่ใช้งาน');end if;
  a:=(a-'users')||jsonb_build_object('user_keys',(select coalesce(jsonb_agg((u-'identity')||jsonb_build_object('key',md5(p_company||'/'||private_salt||'/'||(u->>'identity')))),'[]') from jsonb_array_elements(coalesce(a->'users','[]')) u),
   'user_complete',ok and coalesce((a->>'identified_rows')::int,-1)=coalesce((a->>'count')::int,-2) and coalesce((a->>'user_conflicts')::int,0)=0);
  days:=days||jsonb_build_array(a||jsonb_build_object('company',p_company,'date',d,'complete',ok,
   'run_id',r.id,'primary_id',v->>'id','reason',case when ok then 'ตรวจจำนวน BO กับผลหลักครบ' else array_to_string(issues,' · ') end));
 end loop;
 return jsonb_build_object('company',p_company,'from',p_from,'to',p_to,'days',days);
end $$;


revoke all on function public.finance_bo_aggregate(jsonb,jsonb,date,integer) from public,anon,authenticated;
revoke all on function public.finance_bo_window(text,date,date) from public,anon;
grant execute on function public.finance_bo_window(text,date,date) to authenticated;
notify pgrst,'reload schema';
commit;
