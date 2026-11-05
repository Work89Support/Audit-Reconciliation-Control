-- A corrected manual report may change a placeholder bank amount on an
-- untouched BO-only case. Keep the old row as history and create one current
-- successor; never carry a decision or rewrite an existing amount.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $patch$
declare d text; old_fragment text; new_fragment text; pattern text; hit_count integer;
begin
 d:=pg_get_functiondef('public.activate_manual_primary_cases(uuid,text,text,boolean)'::regprocedure);
 if position('manual-primary-unworked-successor-v1' in d)>0 then return; end if;
 pattern:='if not found then raise exception ''แถวเดิมมีขอบเขตหรือยอดเปลี่ยน ห้ามสร้างเคสซ้ำ'';end if;[[:space:]]*n:=n\+1;reused:=reused\+1;[[:space:]]*insert into public\.manual_primary_case_items values\(v\.id,item\.kind,item\.idx,k,eid\);[[:space:]]*continue;[[:space:]]*end if;[[:space:]]*eid:=gen_random_uuid\(\);n:=n\+1;';
 select count(*),min(m[1]) into hit_count,old_fragment
 from regexp_matches(d,'('||pattern||')','g') as m;
 new_fragment:=$new$
  if found then
   n:=n+1;reused:=reused+1;
   insert into public.manual_primary_case_items values(v.id,item.kind,item.idx,k,eid);
   continue;
  end if;
  -- manual-primary-unworked-successor-v1. Only a BO-only, unworked case
  -- whose old amount was a placeholder may get a current successor.
  perform 1 from public.exceptions e where e.id=eid
   and e.company=v.company and e.business_date=v.business_date
   and e.account=r->>'account'
   and e.direction=case when r->>'direction' in ('deposit','ฝาก') then 'ฝาก' else 'ถอน' end
   and e.system_amount is not distinct from (r->>'system_amount')::numeric
   and e.status='open' and e.superseded_by_exception_id is null
   and e.ex_type in ('cross_day','missing_stm')
   and r->>'ex_type' in ('cross_day','missing_stm')
   and coalesce(e.customer_details#>'{source_rows,stm}','null'::jsonb)='null'::jsonb
   and coalesce(r->'customer_details'#>'{source_rows,stm}','null'::jsonb)='null'::jsonb
   and ((e.bank_amount is null and (r->>'bank_amount')::numeric=e.system_amount)
     or (e.bank_amount=e.system_amount and r->>'bank_amount' is null))
   and not exists(select 1 from public.manual_primary_case_items x where x.exception_id=e.id)
   and not exists(select 1 from public.case_evidence x where x.exception_id=e.id)
   and not exists(select 1 from public.case_clarification_returns x where x.exception_id=e.id)
   and not exists(select 1 from public.case_closure_requests x where x.exception_id=e.id)
   and not exists(select 1 from public.cross_day_pair_requests x where x.exception_id=e.id)
   and not exists(select 1 from public.cross_day_image_reviews x where x.exception_id=e.id)
   and not exists(select 1 from public.manual_pair_members x where x.exception_id=e.id)
   and not exists(select 1 from public.damages x where x.exception_id=e.id)
   and not exists(select 1 from public.finance_action_events x where x.exception_id=e.id)
   and not exists(select 1 from public.account_review_hold_items x where x.exception_id=e.id)
   for update;
  if not found then raise exception 'แถวเดิมมีขอบเขตหรือยอดเปลี่ยน ห้ามสร้างเคสซ้ำ';end if;
  r:=jsonb_set(r,'{customer_details}',coalesce(r->'customer_details','{}'::jsonb)
   ||jsonb_build_object('replaces_unworked_case_id',eid),true);
  -- Continue to the existing INSERT below. The previous case remains
  -- unchanged and becomes history when this primary version is accepted.
  end if;
  eid:=gen_random_uuid();n:=n+1;
 $new$;
 if hit_count<>1
 or position('manual-primary-exact-candidate-v1' in d)=0
 or position('manual-primary-exact-case-reuse-v2' in d)=0
 or position('eid:=gen_random_uuid();n:=n+1;' in d)=0
 then raise exception 'Activation definition changed; stop';end if;
 execute replace(d,old_fragment,new_fragment);
end $patch$;
notify pgrst,'reload schema';
commit;
