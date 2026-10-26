-- Keep cached clients compatible while the process-error close form switches
-- to the canonical five-argument RPC. This wrapper does not weaken validation.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.close_process_error_case(
  p_id uuid,
  p_case uuid,
  p_outcome text,
  p_amount numeric,
  p_reason text,
  p_category text,
  p_employee text,
  p_shift text
) returns public.case_closure_requests
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_outcome is distinct from 'process_error'
   or p_amount is distinct from 0
   or p_category is not null
 then raise exception 'ทางนี้ใช้ได้เฉพาะความเสียหาย 0 บาท แต่มีการทำงานผิดพลาด'; end if;
 return public.close_process_error_case(p_id,p_case,p_reason,p_employee,p_shift);
end $$;

revoke all on function public.close_process_error_case(uuid,uuid,text,numeric,text,text,text,text) from public,anon;
grant execute on function public.close_process_error_case(uuid,uuid,text,numeric,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
