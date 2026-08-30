-- A daily PM statement is the STM-side evidence for PM-to-BO reconciliation.
-- Bank statement PDFs remain accepted, but are not required when provider
-- deposit/withdraw reports are present.

begin;

update public.recon_requirements
set required_groups='[["stm_pdf","pm_statement"],["bo_main","manual_credit","manual_payment"]]'::jsonb,
    note='ต้องมีข้อมูลฝั่ง STM/PM อย่างน้อยหนึ่งไฟล์ และข้อมูลฝั่ง BO อย่างน้อยหนึ่งไฟล์ก่อนเริ่มกระทบยอด',
    updated_at=now()
where company='*';

-- Re-evaluate operational jobs immediately after changing the gate.
select public.refresh_daily_recon_jobs(
  (select operational_start_date from public.audit_runtime_settings where id=true),
  current_date
);

commit;
