-- Read-only executive reporting. No UPDATE/INSERT/DELETE of operational data.
begin;
set local lock_timeout='5s';

create or replace function public.finance_reporting_companies() returns text[]
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result text[];
begin
 if auth.uid() is null or not coalesce(public.current_user_active(),false)
 or coalesce(public.current_app_role(),'') not in ('lead','exec','admin') then
  raise exception 'ไม่มีสิทธิ์รายงานการเงิน' using errcode='42501';
 end if;
 select coalesce(array_agg(c.code order by c.code),'{}') into result from public.audit_companies c
 where c.active and (public.current_app_role()='admin' or exists(
  select 1 from public.user_company_access a where a.user_id=auth.uid() and upper(a.company) in (upper(c.code),'*')));
 return result;
end $$;

create or replace function public.finance_report_number(p text) returns numeric
language sql immutable as $$
 select case when length(p)<=25 and p ~ '^[0-9]+([.][0-9]{1,2})?$' then p::numeric end
$$;

-- Reconstruct only source-identifiable BO rows, not amounts guessed from STM.
create or replace function public.finance_bo_aggregate(p_summary jsonb,p_exceptions jsonb,p_date date,p_expected integer)
returns jsonb language sql immutable as $$
 with raw as (
 select m->'bo' as src,coalesce(m->>'boAmount',m->>'amount') as amount,m->>'direction' as direction,
 m->>'account' as account,coalesce(m->'bo'->>'date',p_date::text) as date,m->'bo'->>'sec' as sec
 from jsonb_array_elements(coalesce(p_summary->'match_evidence','[]')) m
 union all
 select coalesce(nullif(e->'boSource','null'),e#>'{customer_details,source_rows,bo}'),
 coalesce(e->>'system_amount',e->>'systemAmount'),e->>'direction',e->>'account',
 coalesce(nullif(e->>'bo_date',''),nullif(e->>'boDate',''),p_date::text),
 case when coalesce(e->>'bo_time',e->>'boTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
 then (extract(epoch from coalesce(e->>'bo_time',e->>'boTime')::time))::text end
 from jsonb_array_elements(coalesce(p_exceptions,'[]')) e
 union all
 select w->'boSource',coalesce(w->>'systemAmount',w->>'system_amount'),w->>'direction',w->>'account',
 coalesce(nullif(w->>'boDate',''),w->>'date',p_date::text),
 case when w->>'boTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
 then (extract(epoch from (w->>'boTime')::time))::text end
 from jsonb_array_elements(coalesce(p_summary->'waiting_bo','[]')) w
 ), normalized as (
 select (src->>'fileId')||':'||(src->>'row') as key,
 public.finance_report_number(amount) as amount,
 case direction when 'ฝาก' then 'deposit' when 'ถอน' then 'withdraw' else direction end as direction,
 coalesce(nullif(account,''),'ไม่ระบุช่องทาง') as account,date,
 case when sec ~ '^[0-9]+([.][0-9]+)?$' and length(sec)<12 then floor(sec::numeric/3600)::int end as hour
 from raw where src is not null and src<>'null'::jsonb
 ), valid as (
 select * from normalized where key ~* '^[0-9a-f-]{36}:[0-9]+$' and amount is not null
 and direction in ('deposit','withdraw') and date=p_date::text
 ), grouped as (
 select key,min(amount) as amount,min(direction) as direction,min(account) as account,min(hour) as hour,
 (count(distinct (amount,direction,account,date))>1 or count(distinct hour)>1) as conflict from valid group by key
 ), totals as (
 select count(*)::int n,count(*) filter(where conflict)::int conflicts,
 coalesce(sum(amount) filter(where direction='deposit'),0) deposit,
 coalesce(sum(amount) filter(where direction='withdraw'),0) withdraw,
 count(*) filter(where direction='deposit')::int deposits,
 count(*) filter(where direction='withdraw')::int withdrawals from grouped
 ) select jsonb_build_object('count',n,'expected',p_expected,'deposit',deposit,'withdraw',withdraw,
 'deposits',deposits,'withdrawals',withdrawals,'conflicts',conflicts,
 'complete',n=p_expected and conflicts=0 and not exists(select 1 from normalized where
  key is null or key !~* '^[0-9a-f-]{36}:[0-9]+$' or amount is null or coalesce(direction,'') not in ('deposit','withdraw') or date is null or date<>p_date::text),
 'channels',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from
  (select account,sum(amount) as amount,count(*)::int as count from grouped where direction='deposit' group by account order by account) x),
 'source_ids',(select coalesce(jsonb_agg(distinct split_part(key,':',1)),'[]') from grouped),
 'hours',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from
  (select hour,count(*)::int as count from grouped where hour between 0 and 23 group by hour order by hour) x)) from totals
$$;

create or replace function public.finance_bo_window(p_company text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scope text[];j record;r public.recon_runs;v jsonb;s jsonb;ex jsonb;days jsonb:='[]';a jsonb;ok boolean;d date;files jsonb;
begin
 scope:=public.finance_reporting_companies();
 if not coalesce(p_company=any(scope),false) then raise exception 'ไม่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>6 then raise exception 'อ่าน BO ได้ครั้งละไม่เกิน 7 วัน';end if;
 for d in select generate_series(p_from,p_to,interval '1 day')::date loop
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
   ok:=v->'report'->>'quality'='passed';
  elsif r.id is not null then
   s:=r.summary;
   select coalesce(jsonb_agg(to_jsonb(e)),'[]') into ex from public.exceptions e where e.run_id=r.id and e.company=p_company and e.business_date=d;
   a:=public.finance_bo_aggregate(s,ex,d,r.bo_count);
   ok:=j.status='completed' and s->>'source_parser_completion'='true' and s#>>'{bo_first,complete}'='true'
    and r.created_at is not null and not exists(select 1 from jsonb_array_elements(files) f
     where f->>'kind' in ('bo_main','stm_pdf','pm_statement') and not coalesce((f->>'excluded')::boolean,false)
     and (not coalesce((f->>'id')::uuid=any(r.file_ids),false) or coalesce(f->>'revision','1')<>'1'
      or (f->>'storage_object_version')::timestamptz>r.created_at
      or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(f->'source_file_ocr')='array' then f->'source_file_ocr' else '[]'::jsonb end) o
        where coalesce(o->>'updated_at',o->>'created_at')::timestamptz>r.created_at)));
  else a:=jsonb_build_object('complete',false);ok:=false;
  end if;
  ok:=coalesce(ok,false) and coalesce((a->>'complete')::boolean,false);
  ok:=ok and exists(select 1 from jsonb_array_elements(files) f where f->>'kind'='bo_main' and not coalesce((f->>'excluded')::boolean,false))
   and not exists(select 1 from jsonb_array_elements_text(coalesce(a->'source_ids','[]')) sid
    where not exists(select 1 from jsonb_array_elements(files) f where f->>'kind'='bo_main' and not coalesce((f->>'excluded')::boolean,false)
     and sid in (f->>'id',f->>'physical_source_file_id')));
  days:=days||jsonb_build_array(a||jsonb_build_object('company',p_company,'date',d,'complete',ok,
   'run_id',r.id,'primary_id',v->>'id','reason',case when ok then 'ตรวจจำนวน BO กับผลหลักครบ' else 'ข้อมูลบางส่วน / รออ่าน BO ให้ครบ ห้ามสรุปยอดเต็ม' end));
 end loop;
 return jsonb_build_object('company',p_company,'from',p_from,'to',p_to,'days',days);
end $$;

create or replace function public.finance_case_report(p_company text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scope text[];losses jsonb;risks jsonb;ledger jsonb;receipts jsonb;
begin
 scope:=public.finance_reporting_companies();
 if not coalesce(p_company=any(scope),false) then raise exception 'ไม่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>365 then raise exception 'ช่วงรายงานไม่เกิน 366 วัน';end if;
 if (select count(*) from public.damages where company=p_company and business_date<=p_to)>10000 then raise exception 'ทะเบียนมากเกินขอบเขต ให้แบ่งช่วงรายงาน';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'exception_id',d.exception_id,
 'company',d.company,'date',d.business_date,'amount',coalesce(d.amount_thb,case when d.currency='THB' then d.amount end),
 'cause',d.cause,'employee',d.employee,'shift',d.shift,'has_evidence',d.has_evidence,
 'finance_status',d.finance_status,'hr_status',d.hr_status,'created_at',d.created_at,
 'case_status',e.status,'owner_id',e.assigned_to,'due_at',e.document_due_at,
 'resolved_at',e.resolved_at,'resolution_note',e.resolution_note) order by d.business_date desc,d.id),'[]') into losses
 from public.damages d left join public.exceptions e on e.id=d.exception_id and e.company=d.company
 where d.company=p_company and d.business_date<=p_to;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]') into ledger from public.damage_collections c
 join public.damages d on d.id=c.damage_id and d.company=c.company where d.company=p_company and d.business_date<=p_to;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into receipts from public.damage_receipts r
 join public.damages d on d.id=r.damage_id and d.company=r.company
 where d.company=p_company and d.business_date<=p_to;
 if (select count(*) from public.exceptions e where e.company=p_company and e.business_date<=p_to and e.status not in ('closed','approved')
 and public.primary_case_is_current(e.id) and e.superseded_by_exception_id is null and e.risk_amount>0)>10000 then raise exception 'เคสเสี่ยงมากเกินขอบเขต';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'code',e.code,'company',e.company,'date',e.business_date,
 'amount',e.risk_amount,'currency',e.currency,'fx_rate',e.fx_rate,'status',e.status,'type',e.type_name,
 'owner_id',e.assigned_to,'due_at',e.document_due_at,'has_evidence',e.clarification_file_id is not null) order by e.business_date,e.id),'[]') into risks
 from public.exceptions e join public.daily_recon_jobs j on j.company=e.company and j.business_date=e.business_date and j.last_run_id=e.run_id and not j.is_archived
 where e.company=p_company and e.business_date<=p_to and e.status not in ('closed','approved')
 and public.primary_case_is_current(e.id) and e.superseded_by_exception_id is null and e.risk_amount>0
 and not exists(select 1 from public.damages d where d.exception_id=e.id);
 return jsonb_build_object('company',p_company,'from',p_from,'to',p_to,'as_of',now(),
 'damages',losses,'risks',risks,'collections',ledger,'receipts',receipts);
end $$;
revoke all on function public.finance_report_number(text),public.finance_bo_aggregate(jsonb,jsonb,date,integer) from public,anon,authenticated;
revoke all on function public.finance_reporting_companies(),public.finance_bo_window(text,date,date),public.finance_case_report(text,date,date) from public,anon;
grant execute on function public.finance_reporting_companies(),public.finance_bo_window(text,date,date),public.finance_case_report(text,date,date) to authenticated;
notify pgrst,'reload schema';
commit;
