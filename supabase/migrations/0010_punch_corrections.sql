-- 0010 — employee-requested punch corrections (forgot to clock in/out, wrong time).
-- Run after 0001–0009.

create table if not exists punch_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  punch_id uuid references punches(id) on delete set null,
  date date not null,
  requested_in time,
  requested_out time,
  reason text,
  status text not null default 'pending', -- pending | approved | rejected
  created_at timestamptz not null default now()
);

create index if not exists punch_corrections_company_idx on punch_corrections (company_id, status);

alter table punch_corrections enable row level security;

-- Read: anyone in the company. Manager writes (approve/reject). Employee inserts own.
drop policy if exists punch_corrections_read on punch_corrections;
create policy punch_corrections_read on punch_corrections for select
  using (company_id = public.auth_company_id());

drop policy if exists punch_corrections_ins on punch_corrections;
create policy punch_corrections_ins on punch_corrections for insert
  with check (company_id = public.auth_company_id() and (public.is_manager() or employee_id = public.auth_employee_id()));

drop policy if exists punch_corrections_upd on punch_corrections;
create policy punch_corrections_upd on punch_corrections for update
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());
