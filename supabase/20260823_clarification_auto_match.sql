begin;

-- Inbound clarification evidence is kept separately from clarify_docs, which is
-- reserved for documents issued by the audit team. One source file is processed
-- once so retries from n8n are safe.
create table if not exists public.clarification_matches (
  id                    uuid primary key default gen_random_uuid(),
  file_id               uuid not null unique references public.source_files(id) on delete cascade,
  batch_id              uuid references public.mail_batches(id) on delete set null,
  business_date         date,
  company               text,
  extracted_text        text,
  matched_exception_ids uuid[] not null default '{}',
  confidence            integer not null default 0 check (confidence between 0 and 100),
  outcome               text not null check (outcome in ('pending','answered','auto_closed','ambiguous','no_match','error')),
  reason                text,
  processed_by          text,
  processed_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists clarification_matches_date_company_idx
  on public.clarification_matches (business_date desc, company, outcome);
create index if not exists clarification_matches_outcome_idx
  on public.clarification_matches (outcome, processed_at desc);

alter table public.exceptions add column if not exists clarification_file_id uuid references public.source_files(id) on delete set null;
alter table public.exceptions add column if not exists auto_closed boolean not null default false;
alter table public.exceptions add column if not exists resolution_note text;
alter table public.exceptions add column if not exists resolved_at timestamptz;
alter table public.exceptions add column if not exists resolved_by text;
alter table public.exceptions add column if not exists match_confidence integer;
create index if not exists exceptions_clarification_file_idx on public.exceptions (clarification_file_id);

drop trigger if exists clarification_matches_touch on public.clarification_matches;
create trigger clarification_matches_touch before update on public.clarification_matches
  for each row execute function public.touch_updated_at();

alter table public.clarification_matches enable row level security;
drop policy if exists clarification_matches_auth_read on public.clarification_matches;
create policy clarification_matches_auth_read on public.clarification_matches
  for select to authenticated using (true);
drop policy if exists clarification_matches_auth_write on public.clarification_matches;
create policy clarification_matches_auth_write on public.clarification_matches
  for insert to authenticated with check (true);
drop policy if exists clarification_matches_auth_update on public.clarification_matches;
create policy clarification_matches_auth_update on public.clarification_matches
  for update to authenticated using (true) with check (true);

create or replace function public.pending_clarification_files(p_limit integer default 20)
returns table (
  id uuid, batch_id uuid, file_name text, mime_type text, storage_path text,
  company text, business_date date, subject text
)
language sql
security definer
set search_path = public
as $$
  select f.id, f.batch_id, f.file_name, f.mime_type, f.storage_path,
         upper(coalesce(nullif(f.company,''), nullif(b.company,''))) as company,
         b.business_date, b.subject
  from public.source_files f
  join public.mail_batches b on b.id = f.batch_id
  left join public.clarification_matches m on m.file_id = f.id
  where f.kind = 'doc_clarify' and m.id is null
  order by b.received_at asc, f.created_at asc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Match one clarification file against only the current exception set for the
-- same company and business date. A case is auto-closed only when the evidence
-- contains an explicit completion phrase and the best match is unique.
create or replace function public.apply_clarification_match(
  p_file_id uuid,
  p_extracted_text text default '',
  p_actor text default 'n8n-clarification-matcher'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file public.source_files%rowtype;
  v_batch public.mail_batches%rowtype;
  v_existing public.clarification_matches%rowtype;
  v_company text;
  v_date date;
  v_blob text;
  v_plain text;
  v_has_resolution boolean;
  v_has_negative boolean;
  v_best record;
  v_ties integer := 0;
  v_outcome text;
  v_reason text;
  v_confidence integer := 0;
  v_ids uuid[] := '{}';
begin
  select * into v_existing from public.clarification_matches where file_id = p_file_id;
  if found then
    return jsonb_build_object(
      'file_id', v_existing.file_id, 'outcome', v_existing.outcome,
      'confidence', v_existing.confidence, 'matched_exception_ids', v_existing.matched_exception_ids,
      'reason', v_existing.reason, 'idempotent', true
    );
  end if;

  select * into v_file from public.source_files where id = p_file_id;
  if not found then raise exception 'source file % not found', p_file_id; end if;
  if v_file.kind <> 'doc_clarify' then raise exception 'source file % is not doc_clarify', p_file_id; end if;
  select * into v_batch from public.mail_batches where id = v_file.batch_id;

  v_company := upper(coalesce(nullif(v_file.company, ''), nullif(v_batch.company, '')));
  v_date := v_batch.business_date;
  v_blob := lower(concat_ws(' ', v_batch.subject, v_file.file_name, left(coalesce(p_extracted_text, ''), 100000)));
  v_plain := regexp_replace(v_blob, '[^[:alnum:]]+', '', 'g');
  v_has_negative := v_blob ~ '(ยังไม่เรียบร้อย|ยังไม่สำเร็จ|แก้ไขไม่ได้|รอตรวจ|รอดำเนินการ|pending|failed|reject)';
  v_has_resolution := not v_has_negative and v_blob ~ '(ดำเนินการเรียบร้อย|แก้ไขเรียบร้อย|ปรับยอดแล้ว|คืนยอดแล้ว|ปิดเคส|ไม่มีความเสียหาย|ตรวจสอบเรียบร้อย|resolved|completed|success)';

  if v_company is null or v_date is null then
    v_outcome := 'no_match';
    v_reason := 'ไฟล์ไม่มีบริษัทหรือวันที่ตรวจ จึงไม่อนุญาตให้ปิดเคสอัตโนมัติ';
  else
    with candidates as (
      select e.*,
        (case when e.code is not null and position(lower(regexp_replace(e.code, '[^[:alnum:]]+', '', 'g')) in v_plain) > 0 then 100 else 0 end) +
        (case when length(regexp_replace(coalesce(e.account,''), '\\D', '', 'g')) >= 6
                   and position(regexp_replace(e.account, '\\D', '', 'g') in regexp_replace(v_blob, '\\D', '', 'g')) > 0 then 35 else 0 end) +
        (case when length(regexp_replace(coalesce(e.member_code,''), '[^[:alnum:]]+', '', 'g')) >= 4
                   and position(lower(regexp_replace(e.member_code, '[^[:alnum:]]+', '', 'g')) in v_plain) > 0 then 30 else 0 end) +
        (case when e.system_amount is not null and (
                   position(to_char(e.system_amount, 'FM9999999990D00') in replace(v_blob, ',', '')) > 0 or
                   position(to_char(e.system_amount, 'FM9999999990') in replace(v_blob, ',', '')) > 0
                 ) then 25 else 0 end) +
        (case when e.occurred_at is not null and position(to_char(e.occurred_at, 'HH24:MI') in v_blob) > 0 then 15 else 0 end) as score,
        (case when e.code is not null and position(lower(regexp_replace(e.code, '[^[:alnum:]]+', '', 'g')) in v_plain) > 0 then 1 else 0 end) +
        (case when length(regexp_replace(coalesce(e.account,''), '\\D', '', 'g')) >= 6
                   and position(regexp_replace(e.account, '\\D', '', 'g') in regexp_replace(v_blob, '\\D', '', 'g')) > 0 then 1 else 0 end) +
        (case when length(regexp_replace(coalesce(e.member_code,''), '[^[:alnum:]]+', '', 'g')) >= 4
                   and position(lower(regexp_replace(e.member_code, '[^[:alnum:]]+', '', 'g')) in v_plain) > 0 then 1 else 0 end) +
        (case when e.system_amount is not null and position(to_char(e.system_amount, 'FM9999999990D00') in replace(v_blob, ',', '')) > 0 then 1 else 0 end) as signals
      from public.v_current_exceptions e
      where e.business_date = v_date
        and upper(coalesce(e.company, '')) = v_company
        and coalesce(e.status, 'open') not in ('closed','approved','damage')
    ), ranked as (
      select * from candidates where score >= 80 and (signals >= 2 or score >= 100) order by score desc, created_at desc
    )
    select r.*, (select count(*) from ranked x where x.score = r.score) as tie_count
      into v_best from ranked r limit 1;

    if not found then
      v_outcome := 'no_match';
      v_reason := 'ไม่พบเคสที่ตรงอย่างน้อย 2 จุด (บริษัท/วันที่บังคับ และเลขเคส/บัญชี/สมาชิก/ยอด)';
    elsif v_best.tie_count > 1 then
      v_outcome := 'ambiguous';
      v_reason := 'พบหลายเคสที่ได้คะแนนเท่ากัน ระบบไม่ปิดเคสอัตโนมัติ';
      v_confidence := least(100, v_best.score);
    else
      v_ids := array[v_best.id];
      v_confidence := least(100, v_best.score);
      if v_has_resolution then
        v_outcome := 'auto_closed';
        v_reason := 'ตรงเคสเดียวและเอกสารระบุว่าแก้ไขเรียบร้อย';
        update public.exceptions set
          status = 'closed', clarification_file_id = p_file_id, auto_closed = true,
          resolution_note = v_reason, resolved_at = now(), resolved_by = p_actor,
          match_confidence = v_confidence
        where id = v_best.id;
      else
        v_outcome := 'answered';
        v_reason := case when v_has_negative
          then 'จับคู่เคสได้ แต่เอกสารระบุว่ายังไม่เรียบร้อย จึงรอตรวจ'
          else 'จับคู่เคสได้ แต่ไม่พบข้อความยืนยันการแก้ไข จึงรอ Audit อนุมัติ' end;
        update public.exceptions set
          status = 'answered', clarification_file_id = p_file_id, auto_closed = false,
          resolution_note = v_reason, resolved_by = p_actor, match_confidence = v_confidence
        where id = v_best.id;
      end if;
    end if;
  end if;

  insert into public.clarification_matches(
    file_id, batch_id, business_date, company, extracted_text,
    matched_exception_ids, confidence, outcome, reason, processed_by
  ) values (
    p_file_id, v_file.batch_id, v_date, v_company, left(coalesce(p_extracted_text, ''), 100000),
    v_ids, v_confidence, v_outcome, v_reason, p_actor
  );

  insert into public.audit_log(actor, action, entity, target, detail, meta)
  values (
    p_actor,
    case v_outcome when 'auto_closed' then 'clarification_auto_close' when 'answered' then 'clarification_matched' else 'clarification_review_required' end,
    'source_file', p_file_id::text, v_reason,
    jsonb_build_object('outcome', v_outcome, 'confidence', v_confidence, 'exception_ids', v_ids, 'file_name', v_file.file_name)
  );

  return jsonb_build_object(
    'file_id', p_file_id, 'outcome', v_outcome, 'confidence', v_confidence,
    'matched_exception_ids', v_ids, 'reason', v_reason, 'idempotent', false
  );
exception when others then
  insert into public.clarification_matches(file_id, batch_id, business_date, company, extracted_text, outcome, reason, processed_by)
  values (p_file_id, v_file.batch_id, v_date, v_company, left(coalesce(p_extracted_text, ''), 100000), 'error', sqlerrm, p_actor)
  on conflict (file_id) do nothing;
  raise;
end $$;

revoke all on function public.apply_clarification_match(uuid,text,text) from public;
grant execute on function public.apply_clarification_match(uuid,text,text) to authenticated, service_role;
revoke all on function public.pending_clarification_files(integer) from public;
grant execute on function public.pending_clarification_files(integer) to authenticated, service_role;
grant select on public.clarification_matches to authenticated;

commit;
