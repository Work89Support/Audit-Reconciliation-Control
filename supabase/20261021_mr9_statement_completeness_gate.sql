-- MR9 must not publish an automatic result without bank-statement intake and
-- BO-derived source coverage. Definitions/config only; existing jobs, runs,
-- cases, amounts, histories and holds are intentionally left untouched.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

insert into public.recon_requirements(company,required_groups,note,updated_at)
values('MR9','[["stm_pdf"],["bo_main","manual_credit","manual_payment"]]'::jsonb,
 'MR9 ต้องมี Statement ธนาคารอย่างน้อยหนึ่งไฟล์และข้อมูล BO ก่อนเริ่มรอบอัตโนมัติ; PM อย่างเดียวไม่แทนการรับไฟล์ธนาคาร',now())
on conflict(company) do update set
 required_groups=excluded.required_groups,note=excluded.note,active=true,updated_at=excluded.updated_at;

create or replace function public.mr9_bo_first_preflight_warnings(p_company text,p_result jsonb)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare coverage jsonb:=p_result#>'{summary,bo_first}'; missing jsonb;
begin
 if p_company<>'MR9' then return '[]'::jsonb;end if;
 if jsonb_typeof(coverage) is distinct from 'object' then
  return jsonb_build_array(jsonb_build_object('code','mr9_bo_first_receipt_missing',
   'detail','MR9 ไม่มีใบรับรองตรวจความครบจาก BO ห้ามใช้ผลอัตโนมัติจนกว่าจะตรวจแหล่งข้อมูลครบ'));
 end if;
 if coverage->>'complete'='true' then return '[]'::jsonb;end if;
 missing:=coalesce(coverage->'missing','[]'::jsonb);
 return jsonb_build_array(jsonb_build_object('code','mr9_bo_first_source_missing',
  'detail','MR9 พบบัญชีหรือช่องทางใน BO แต่ไม่มีข้อมูล STM/PM คู่กัน พักรายงานก่อนสร้างผลหรือเคส',
  'missing',missing,'missing_count',case when jsonb_typeof(missing)='array' then jsonb_array_length(missing) else null end));
end $$;
revoke all on function public.mr9_bo_first_preflight_warnings(text,jsonb) from public,anon,authenticated;
grant execute on function public.mr9_bo_first_preflight_warnings(text,jsonb) to service_role;

do $patch$
declare definition text; needle text;
begin
 definition:=pg_get_functiondef('public.stage_daily_recon_preflight(uuid,jsonb,jsonb)'::regprocedure);
 if position('mr9_bo_first_preflight_warnings' in definition)=0 then
  needle:='warnings:=public.audit_run_preflight_review(j.company,j.business_date)->''warnings'';';
  if position(needle in definition)=0 then raise exception 'Unreviewed preflight warning assignment';end if;
  definition:=replace(definition,needle,needle||chr(10)||
   ' warnings:=warnings||public.mr9_bo_first_preflight_warnings(j.company,p_result);');
  execute definition;
 end if;
end $patch$;

notify pgrst,'reload schema';
commit;
