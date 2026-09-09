-- Independent, append-only Audit confirmations. Never closes exceptions.
begin;
set local lock_timeout='5s';
create table if not exists public.pair_audit_confirmations (
  run_id uuid not null references public.recon_runs(id),
  pair_index integer not null check(pair_index>=0),
  company text not null,
  evidence_hash text not null,
  confirmed_by uuid not null,
  confirmed_at timestamptz not null default now(),
  note text not null check(length(trim(note))>0),
  primary key(run_id,pair_index)
);
alter table public.pair_audit_confirmations enable row level security;
create policy pair_audit_read on public.pair_audit_confirmations for select to authenticated
using(public.current_user_active() and public.has_company_access(company));
revoke all on public.pair_audit_confirmations from authenticated,anon;
grant select on public.pair_audit_confirmations to authenticated;
create or replace function public.confirm_audit_pairs(p_run_id uuid,p_indices integer[],p_note text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.daily_recon_jobs; ev jsonb; item jsonb; i integer; saved integer:=0; n integer;
begin
  if auth.uid() is null or not public.current_user_active() or public.current_app_role() not in ('monitor','lead','admin') then
    raise exception 'ไม่มีสิทธิ์ยืนยัน Audit';
  end if;
  if coalesce(cardinality(p_indices),0) not between 1 and 100 or length(trim(coalesce(p_note,'')))=0 then
    raise exception 'เลือก 1–100 รายการและระบุเหตุผล';
  end if;
  select * into j from public.daily_recon_jobs where last_run_id=p_run_id and not is_archived for share;
  if not found or j.status<>'completed' or not public.has_company_access(j.company) then
    raise exception 'งานยังไม่เสร็จ หรือผลรอบนี้ไม่ใช่รอบปัจจุบัน กรุณารีเฟรช';
  end if;
  select summary->'match_evidence' into ev from public.recon_runs where id=p_run_id for share;
  foreach i in array p_indices loop
    if i is null or i<0 or i>=coalesce(jsonb_array_length(ev),0) then raise exception 'ไม่พบหลักฐานรายการ'; end if;
    item:=ev->i;
    if coalesce((item->>'manualReview')::boolean,false) then raise exception 'เติมมือต้องตรวจหลักฐานผ่านเคส'; end if;
    insert into public.pair_audit_confirmations(run_id,pair_index,company,evidence_hash,confirmed_by,note)
    values(p_run_id,i,j.company,md5(item::text),auth.uid(),trim(p_note)) on conflict do nothing;
    get diagnostics n=row_count; saved:=saved+n;
  end loop;
  return saved;
end $$;
revoke all on function public.confirm_audit_pairs(uuid,integer[],text) from public,anon;
grant execute on function public.confirm_audit_pairs(uuid,integer[],text) to authenticated;
notify pgrst,'reload schema';
commit;
