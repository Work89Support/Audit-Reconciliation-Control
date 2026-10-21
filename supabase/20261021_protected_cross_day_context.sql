-- Keep a protected historical manual-primary row as run context without
-- blocking publication of the current day or creating a duplicate old case.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $patch$
declare d text; needle text; replacement text;
begin
 d:=pg_get_functiondef('public.stage_daily_recon_preflight(uuid,jsonb,jsonb)'::regprocedure);
 if position('protected_history_context_v2' in d)=0 then
  needle:='warnings jsonb; draft_id uuid; token text;';
  replacement:='warnings jsonb; draft_id uuid; token text; protected_history_context jsonb:=''[]''; publish_exceptions jsonb:=''[]'';';
  if (length(d)-length(replace(d,needle,'')))/length(needle)<>1 then
   raise exception 'Unreviewed preflight declaration';
  end if;
  d:=replace(d,needle,replacement);

  needle:=$old$
 if exists(select 1 from jsonb_array_elements(p_exceptions) e
  where e->>'business_date' is distinct from j.business_date::text
  and public.worker_primary_scope_protected(j.company,(e->>'business_date')::date)) then
  warnings:=warnings||jsonb_build_array(jsonb_build_object('code','historical_primary_protected',
   'detail','รายการอ้างวันที่มีผลหลักรันมือ ต้องตรวจเคสเดิมก่อน ห้ามสร้างซ้ำหรือแก้ผลย้อนหลัง'));
 end if;
 $old$;
  replacement:=$new$
 -- protected_history_context_v2: these rows already belong to an immutable
 -- manual-primary day. Keep their exact evidence in the new run summary, but
 -- never create a second exception and never stop the current-day run solely
 -- because that contextual row is present.
 select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
 into protected_history_context
 from jsonb_array_elements(p_exceptions) with ordinality x(value,ordinality)
 where x.value->>'business_date' is distinct from j.business_date::text
 and public.worker_primary_scope_protected(j.company,(x.value->>'business_date')::date);
 select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
 into publish_exceptions
 from jsonb_array_elements(p_exceptions) with ordinality x(value,ordinality)
 where not (x.value->>'business_date' is distinct from j.business_date::text
 and public.worker_primary_scope_protected(j.company,(x.value->>'business_date')::date));
 -- A previous attempt may have persisted this warning as a draft. The exact
 -- protected rows are now suppressed above; every other warning remains a
 -- blocking warning and the historical draft itself is left untouched.
 select coalesce(jsonb_agg(w.value),'[]'::jsonb) into warnings
 from jsonb_array_elements(warnings) w(value)
 where w.value->>'code' is distinct from 'historical_primary_protected';
 $new$;
  if (length(d)-length(replace(d,needle,'')))/length(needle)<>1 then
   raise exception 'Unreviewed historical-primary preflight block';
  end if;
  d:=replace(d,needle,replacement);

  needle:='return jsonb_build_object(''proceed'',true,';
  replacement:='return jsonb_build_object(''proceed'',true,''publish_exceptions'',publish_exceptions,''protected_history_context'',protected_history_context,''protected_history_context_count'',jsonb_array_length(protected_history_context),';
  if (length(d)-length(replace(d,needle,'')))/length(needle)<>1 then
   raise exception 'Unreviewed successful preflight receipt';
  end if;
  execute replace(d,needle,replacement);
 end if;
end $patch$;

do $patch$
declare d text; needle text; replacement text;
begin
 d:=pg_get_functiondef('public.stage_daily_recon_preflight(uuid,jsonb,jsonb)'::regprocedure);
 if position('protected_history_worker_capability_v2' in d)=0 then
  needle:='if jsonb_array_length(warnings)=0 then return jsonb_build_object(''proceed'',true,';
  replacement:=$guard$
 -- protected_history_worker_capability_v2: a database-only rollout must fail
 -- closed. The worker may proceed only after it declares that it will publish
 -- publish_exceptions rather than the original unfiltered exception array.
 if jsonb_array_length(protected_history_context)>0 and not coalesce(
  (p_result#>>'{summary,protected_history_context_publish_v2}')::boolean,false) then
  warnings:=warnings||jsonb_build_array(jsonb_build_object('code','historical_worker_upgrade_required',
   'detail','Worker ยังไม่ยืนยันการตัดเคสย้อนหลังออกจากชุดบันทึก จึงพักงานไว้ก่อน'));
 end if;
 if jsonb_array_length(warnings)=0 then return jsonb_build_object('proceed',true,
 $guard$;
  if (length(d)-length(replace(d,needle,'')))/length(needle)<>1 then
   raise exception 'Unreviewed worker capability gate';
  end if;
  execute replace(d,needle,replacement);
 end if;
end $patch$;
notify pgrst,'reload schema';
commit;
