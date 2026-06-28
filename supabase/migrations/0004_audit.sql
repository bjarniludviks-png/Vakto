-- ============================================================
-- VAKTO — audit log (brief §8). Records key mutations per company.
-- ============================================================

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,        -- t.d. employee.create, payroll.run
  entity text,                 -- t.d. employee, payroll_run
  entity_id text,
  detail text,                 -- mannlæsileg lýsing
  at timestamptz not null default now()
);
create index if not exists audit_log_company_at_idx on audit_log(company_id, at desc);

alter table audit_log enable row level security;

-- Anyone in the company can append; only managers/owners can read.
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert
  with check (company_id = public.auth_company_id());

drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select
  using (company_id = public.auth_company_id() and public.is_manager());
