-- ============================================================
-- VAKTO — Row Level Security. Tenant isolation by company_id.
-- ============================================================

-- Current user's company (security definer to avoid RLS recursion on users).
create or replace function public.auth_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.users where id = auth.uid();
$$;

create or replace function public.auth_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('owner','manager'), false);
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'owner', false);
$$;

-- Auto-provision a public.users row when an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'owner')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- enable RLS ----------
alter table companies      enable row level security;
alter table locations      enable row level security;
alter table departments    enable row level security;
alter table positions      enable row level security;
alter table users          enable row level security;
alter table employees      enable row level security;
alter table shift_types    enable row level security;
alter table shifts         enable row level security;
alter table punches        enable row level security;
alter table timesheets     enable row level security;
alter table leave_requests enable row level security;
alter table payroll_runs   enable row level security;
alter table payroll_lines  enable row level security;
alter table documents      enable row level security;
alter table integrations   enable row level security;
alter table revenue        enable row level security;

-- ---------- users ----------
drop policy if exists users_self_read on users;
create policy users_self_read on users for select
  using (id = auth.uid() or company_id = public.auth_company_id());

drop policy if exists users_self_update on users;
create policy users_self_update on users for update
  using (id = auth.uid());

-- ---------- companies ----------
drop policy if exists companies_read on companies;
create policy companies_read on companies for select
  using (id = public.auth_company_id());

drop policy if exists companies_owner_write on companies;
create policy companies_owner_write on companies for all
  using (id = public.auth_company_id() and public.is_owner())
  with check (id = public.auth_company_id() and public.is_owner());

-- ---------- generic company-scoped tables ----------
-- read for everyone in the company, write for managers/owners.
do $$
declare t text;
begin
  foreach t in array array[
    'locations','positions','shift_types','shifts','punches',
    'timesheets','leave_requests','documents','integrations'
  ]
  loop
    execute format('drop policy if exists %1$s_read on %1$s;', t);
    execute format(
      'create policy %1$s_read on %1$s for select using (company_id = public.auth_company_id());', t);
    execute format('drop policy if exists %1$s_write on %1$s;', t);
    execute format(
      'create policy %1$s_write on %1$s for all using (company_id = public.auth_company_id() and public.is_manager()) with check (company_id = public.auth_company_id() and public.is_manager());', t);
  end loop;
end $$;

-- departments: scoped via its location's company
drop policy if exists departments_read on departments;
create policy departments_read on departments for select
  using (exists (select 1 from locations l where l.id = location_id and l.company_id = public.auth_company_id()));
drop policy if exists departments_write on departments;
create policy departments_write on departments for all
  using (public.is_manager() and exists (select 1 from locations l where l.id = location_id and l.company_id = public.auth_company_id()))
  with check (public.is_manager() and exists (select 1 from locations l where l.id = location_id and l.company_id = public.auth_company_id()));

-- employees: company members read; managers write; employees see own row
drop policy if exists employees_read on employees;
create policy employees_read on employees for select
  using (company_id = public.auth_company_id());
drop policy if exists employees_write on employees;
create policy employees_write on employees for all
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());

-- payroll: owner only
drop policy if exists payroll_runs_owner on payroll_runs;
create policy payroll_runs_owner on payroll_runs for all
  using (company_id = public.auth_company_id() and public.is_owner())
  with check (company_id = public.auth_company_id() and public.is_owner());
drop policy if exists payroll_lines_owner on payroll_lines;
create policy payroll_lines_owner on payroll_lines for all
  using (exists (select 1 from payroll_runs r where r.id = run_id and r.company_id = public.auth_company_id() and public.is_owner()))
  with check (exists (select 1 from payroll_runs r where r.id = run_id and r.company_id = public.auth_company_id() and public.is_owner()));

-- revenue: scoped via location's company
drop policy if exists revenue_read on revenue;
create policy revenue_read on revenue for select
  using (exists (select 1 from locations l where l.id = location_id and l.company_id = public.auth_company_id()));
drop policy if exists revenue_write on revenue;
create policy revenue_write on revenue for all
  using (public.is_manager() and exists (select 1 from locations l where l.id = location_id and l.company_id = public.auth_company_id()))
  with check (public.is_manager() and exists (select 1 from locations l where l.id = location_id and l.company_id = public.auth_company_id()));
