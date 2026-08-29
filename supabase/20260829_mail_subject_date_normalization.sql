-- Normalize the business date from Gmail subjects before every insert/update.
-- Supports both ISO (2026-08-27) and Thai team format (27-08-69 / 27-08-2569).

create or replace function public.normalize_mail_batch_business_date()
returns trigger
language plpgsql
as $$
declare
  m text[];
  y integer;
begin
  m := regexp_match(
    coalesce(new.subject, ''),
    '(?<![0-9])((?:19|20)[0-9]{2})[-/]([0-9]{1,2})[-/]([0-9]{1,2})(?![0-9])'
  );

  if m is not null then
    new.business_date := make_date(m[1]::integer, m[2]::integer, m[3]::integer);
    return new;
  end if;

  m := regexp_match(
    coalesce(new.subject, ''),
    '(?<![0-9])([0-9]{1,2})[-/]([0-9]{1,2})[-/]([0-9]{2}|[0-9]{4})(?![0-9])'
  );

  if m is not null then
    y := m[3]::integer;
    if y < 100 then
      y := y + 1957;
    elsif y > 2400 then
      y := y - 543;
    end if;
    new.business_date := make_date(y, m[2]::integer, m[1]::integer);
  end if;

  return new;
exception
  when datetime_field_overflow or invalid_datetime_format then
    return new;
end;
$$;

drop trigger if exists mail_batches_normalize_business_date on public.mail_batches;
create trigger mail_batches_normalize_business_date
before insert or update of subject, business_date on public.mail_batches
for each row execute function public.normalize_mail_batch_business_date();

-- Repair rows received since production collection started.
update public.mail_batches
set business_date = business_date,
    updated_at = now()
where received_at >= (date '2026-08-27'::timestamp at time zone 'Asia/Bangkok');

select public.refresh_daily_recon_jobs(date '2026-08-27', current_date);
