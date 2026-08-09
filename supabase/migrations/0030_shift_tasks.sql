-- 0030 — shift tasks (checklists on a shift, Sling-parity).
-- Keyed by employee+date (NOT shift id) so republishing a week — which
-- replaces shifts rows — never wipes the checklist.

create table if not exists shift_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists shift_tasks_day_idx on shift_tasks(company_id, date);
create index if not exists shift_tasks_emp_idx on shift_tasks(employee_id, date);

alter table shift_tasks enable row level security;

-- managers/owners (users row) see + manage the company's tasks;
-- employees see their own and may tick them off.
drop policy if exists shift_tasks_select on shift_tasks;
create policy shift_tasks_select on shift_tasks for select
  using (company_id = public.auth_company_id() or employee_id = public.auth_employee_id());
drop policy if exists shift_tasks_insert on shift_tasks;
create policy shift_tasks_insert on shift_tasks for insert
  with check (company_id = public.auth_company_id());
drop policy if exists shift_tasks_update on shift_tasks;
create policy shift_tasks_update on shift_tasks for update
  using (company_id = public.auth_company_id() or employee_id = public.auth_employee_id());
drop policy if exists shift_tasks_delete on shift_tasks;
create policy shift_tasks_delete on shift_tasks for delete
  using (company_id = public.auth_company_id());
