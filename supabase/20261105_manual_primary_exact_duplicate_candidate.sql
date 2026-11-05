-- Resolve historical cases sharing a physical source row only when one
-- candidate matches the new report's account, direction and both amounts.
-- Never rewrite or reopen historical cases; remain fail-closed on ambiguity.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $patch$
declare d text; old_fragment text; new_fragment text;
begin
 d:=pg_get_functiondef('public.activate_manual_primary_cases(uuid,text,text,boolean)'::regprocedure);
 if position('manual-primary-exact-candidate-v1' in d)>0 then return; end if;
 old_fragment:='if coalesce(cardinality(candidates),0)>1 then raise exception ''มีหลายเคสอ้างแถวเดียวกัน ต้องตรวจประวัติก่อนยืนยัน'';end if;';
 new_fragment:=$new$
 -- manual-primary-exact-candidate-v1: compare existing cases before judging
 -- an ambiguous physical source. Historical nonmatching cases stay untouched.
 if coalesce(cardinality(candidates),0)>1 then
  select array_agg(e.id order by e.id) into candidates
  from public.exceptions e
  where e.id=any(candidates)
   and e.account=r->>'account'
   and e.direction=case when r->>'direction' in ('deposit','ฝาก') then 'ฝาก' else 'ถอน' end
   and e.system_amount is not distinct from (r->>'system_amount')::numeric
   and e.bank_amount is not distinct from (r->>'bank_amount')::numeric
   and e.superseded_by_exception_id is null;
  if coalesce(cardinality(candidates),0)=0 then
   raise exception 'แถวเดิมมีขอบเขตหรือยอดเปลี่ยน ห้ามสร้างเคสซ้ำ';
  end if;
 end if;
 if coalesce(cardinality(candidates),0)>1 then
  raise exception 'มีหลายเคสอ้างแถวเดียวกัน ต้องตรวจประวัติก่อนยืนยัน';
 end if;
 $new$;
 if (length(d)-length(replace(d,old_fragment,'')))<>length(old_fragment)
    or position('manual-primary-exact-case-reuse-v2' in d)=0
    or position('public.manual_primary_cases_preview(p_id)' in d)=0
 then raise exception 'Activation definition changed; stop'; end if;
 execute replace(d,old_fragment,new_fragment);
end $patch$;
notify pgrst,'reload schema';
commit;
