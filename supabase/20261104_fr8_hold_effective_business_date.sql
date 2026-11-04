-- FR8 SCB 4102050696: the hold was registered on 4 Nov for the 3 Nov
-- reconciliation. Keep registration time and every case/amount unchanged.
begin;
set local lock_timeout = '5s';

do $$
declare
  changed integer;
  affected_cases integer;
begin
  select count(*) into affected_cases
  from public.exceptions e
  where e.company = 'FR8'
    and e.business_date = date '2026-11-03'
    and regexp_replace(coalesce(e.account, ''), '[^0-9]', '', 'g') = '4102050696'
    and e.superseded_by_exception_id is null
    and e.status = 'open';
  if affected_cases <> 74 then
    raise exception 'FR8 hold scope changed: expected 74 open cases, found %', affected_cases;
  end if;

  update public.account_review_holds
     set business_date = date '2026-11-03'
   where id = 'a95f0221-2b37-4e1a-8c24-dd24dd556ffc'::uuid
     and company = 'FR8'
     and account = '4102050696'
     and business_date = date '2026-11-04'
     and exists (
       select 1 from public.account_review_hold_continuations c
       where c.hold_id = public.account_review_holds.id
         and c.effective_end_date is null
     );
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'Expected one active FR8 hold to update; found %', changed;
  end if;

  insert into public.audit_log(actor, action, entity, target, company, detail, meta)
  values (
    'production-scope-correction', 'account_hold_effective_date_corrected',
    'account_review_hold', 'a95f0221-2b37-4e1a-8c24-dd24dd556ffc', 'FR8',
    'Account hold recorded 4 Nov must cover 3 Nov reconciliation; case and financial values unchanged',
    jsonb_build_object('account', '4102050696', 'old_business_date', '2026-11-04',
                       'new_business_date', '2026-11-03', 'open_cases', affected_cases)
  );
end $$;

commit;
