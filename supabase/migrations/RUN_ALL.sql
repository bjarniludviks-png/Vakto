-- ============================================================
-- VAKTO — ALLAR migrations samansettar (0001 → 0007).
-- Límdu í Supabase SQL Editor og keyrðu. Örugg endurkeyrsla.
-- ============================================================

-- ////////////////// 0001_init.sql //////////////////
-- ============================================================
-- VAKTO — initial schema (brief §8). Postgres / Supabase.
-- Multi-tenant by company_id. UI language Icelandic.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type user_role as enum ('owner','manager','employee','contractor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pay_type as enum ('hourly','monthly');          -- tímakaup | mánaðarlaun
exception when duplicate_object then null; end $$;

do $$ begin
  create type employee_status as enum ('active','inactive','on_leave','over_ratio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shift_status as enum ('draft','published','open');
exception when duplicate_object then null; end $$;

do $$ begin
  create type punch_source as enum ('kiosk','app','web');
exception when duplicate_object then null; end $$;

do $$ begin
  create type timesheet_status as enum ('pending','approved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_type as enum ('orlof','veikindi','olaunad');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payroll_status as enum ('draft','approved','sent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type integration_status as enum ('connected','available','coming_soon');
exception when duplicate_object then null; end $$;

-- ---------- core tenancy ----------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  currency text not null default 'ISK',
  default_burden numeric not null default 30.2,        -- launatengd gjöld %
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  timezone text not null default 'Atlantic/Reykjavik',
  created_at timestamptz not null default now()
);

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  name text not null                                   -- Eldhús, Sal, Stjórnun
);

create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,                                  -- Kokkur, Þjónn, Bílstjóri
  base_rate numeric
);

-- maps auth.users -> company + system role
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  email text,
  full_name text,
  role user_role not null default 'employee',
  created_at timestamptz not null default now()
);

-- ---------- employees ----------
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  company_id uuid not null references companies(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  position_id uuid references positions(id) on delete set null,
  full_name text not null,
  title text,                                          -- t.d. Vaktstjóri, Rekstrarstjóri
  kennitala text,
  phone text,
  email text,
  bank_account text,
  pay_type pay_type not null default 'hourly',
  rate numeric not null default 2900,                  -- kr/klst eða kr/mán
  employment_ratio numeric not null default 100,       -- starfshlutfall %
  union_agreement text default 'Efling',              -- kjarasamningur
  role user_role not null default 'employee',
  hire_date date,
  photo_url text,
  avatar_color text default '#5b50e6',
  status employee_status not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists employees_company_idx on employees(company_id);

-- ---------- scheduling ----------
create table if not exists shift_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,                                  -- Dagvakt, Kvöldvakt...
  start_time time,
  end_time time,
  premium_pct numeric default 0,                       -- álag %
  premium_label text,
  color text default '#6366f1',
  bg text,
  border text
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  employee_id uuid references employees(id) on delete cascade,
  shift_type_id uuid references shift_types(id) on delete set null,
  date date not null,
  start_time time,
  end_time time,
  status shift_status not null default 'draft',
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shifts_company_date_idx on shifts(company_id, date);

create table if not exists punches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  shift_id uuid references shifts(id) on delete set null,
  clock_in timestamptz,
  clock_out timestamptz,
  source punch_source not null default 'kiosk',
  created_at timestamptz not null default now()
);

create table if not exists timesheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  period text not null,
  planned_hours numeric default 0,
  actual_hours numeric default 0,
  status timesheet_status not null default 'pending'
);

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  type leave_type not null default 'orlof',
  from_date date not null,
  to_date date not null,
  status leave_status not null default 'pending'
);

-- ---------- payroll ----------
create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status payroll_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists payroll_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  hours numeric default 0,
  gross numeric default 0,
  day_pay numeric default 0,
  premiums numeric default 0,
  overtime numeric default 0,
  withholding numeric default 0,                        -- staðgreiðsla
  pension numeric default 0,                            -- lífeyrir
  union_fee numeric default 0,                          -- félagsgjald
  net numeric default 0                                 -- útborgað
);

-- ---------- documents ----------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  name text not null,
  type text,                                            -- ráðningarsamningur, skattkort...
  url text,
  signed_at date,
  created_at timestamptz not null default now()
);

-- ---------- integrations & revenue ----------
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null,                                   -- payday|dk|inventra|pos
  status integration_status not null default 'available'
);

create table if not exists revenue (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  date date not null,
  amount numeric not null default 0,
  source text default 'manual'
);

-- ////////////////// 0002_rls.sql //////////////////
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

-- ////////////////// 0003_seed.sql //////////////////
-- ============================================================
-- VAKTO — demo seed matching the prototype (Kaffi Krónan).
-- Run in the Supabase SQL editor (service role bypasses RLS).
-- Idempotent: safe to re-run.
-- ============================================================

-- company
insert into companies (id, name, location, currency, default_burden) values
  ('00000000-0000-0000-0000-0000000000c0', 'Kaffi Krónan', 'Reykjavík', 'ISK', 30.2)
on conflict (id) do nothing;

-- locations
insert into locations (id, company_id, name, timezone) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c0', 'Reykjavík Asian', 'Atlantic/Reykjavik'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c0', 'Hotel Umi', 'Atlantic/Reykjavik')
on conflict (id) do nothing;

-- departments (under Reykjavík Asian)
insert into departments (id, location_id, name) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'Eldhús'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', 'Sal'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', 'Stjórnun')
on conflict (id) do nothing;

-- positions
insert into positions (id, company_id, name, base_rate) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c0', 'Kokkur', 2900),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c0', 'Þjónn / Sal', 2750),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c0', 'Bílstjóri', 2650)
on conflict (id) do nothing;

-- shift types (vaktategundir)
insert into shift_types (id, company_id, name, start_time, end_time, premium_pct, premium_label, color, bg, border) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c0','Dagvakt',   '08:00','16:00', 0,  'Dagvinna',          '#4338ca','#eef0ff','#e0e2fb'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c0','Morgunvakt','07:00','13:00', 33, '+33% fyrir 07:00',  '#1f9d6b','#e7f6ef','#cdeede'),
  ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000c0','Kvöldvakt', '16:00','24:00', 33, '+33% álag',          '#b06a12','#fff2e2','#fbe2c4'),
  ('00000000-0000-0000-0000-0000000000b4','00000000-0000-0000-0000-0000000000c0','Helgarvakt','12:00','20:00', 45, '+45% helgarálag',    '#c0392b','#fde9e6','#f8d2cb')
on conflict (id) do nothing;

-- employees (12, matching the prototype)
insert into employees
  (id, company_id, location_id, department_id, position_id, full_name, title, pay_type, rate, employment_ratio, union_agreement, role, avatar_color, status)
values
  ('00000000-0000-0000-0000-0000000e0001','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','Mína Huong','Vaktstjóri','hourly',2900,118,'Efling','employee','#5b50e6','active'),
  ('00000000-0000-0000-0000-0000000e0002','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000f2','Bach Luu',null,'hourly',2900,100,'Efling','employee','#1fb6a6','active'),
  ('00000000-0000-0000-0000-0000000e0003','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','Phong Ha',null,'hourly',2900,98,'Efling','employee','#18a06a','active'),
  ('00000000-0000-0000-0000-0000000e0004','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d3',null,'Jón G.','Rekstrarstjóri','monthly',560000,100,'VR','manager','#8b7bff','active'),
  ('00000000-0000-0000-0000-0000000e0005','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000f2','Ómar S.',null,'hourly',2900,130,'Efling','employee','#e0533f','over_ratio'),
  ('00000000-0000-0000-0000-0000000e0006','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','Ha Vu',null,'hourly',2900,83,'Efling','employee','#0891b2','active'),
  ('00000000-0000-0000-0000-0000000e0007','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','Truong Vu',null,'hourly',2900,100,'Efling','employee','#0f766e','active'),
  ('00000000-0000-0000-0000-0000000e0008','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000f2','Moon M.',null,'hourly',2900,90,'Efling','employee','#2563eb','active'),
  ('00000000-0000-0000-0000-0000000e0009','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','Ngoan Thi',null,'hourly',2900,95,'Efling','employee','#16a34a','active'),
  ('00000000-0000-0000-0000-0000000e0010','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000f2','Dalya R.',null,'hourly',2900,80,'Efling','employee','#ca8a04','active'),
  ('00000000-0000-0000-0000-0000000e0011','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d3',null,'Fannar F.',null,'hourly',2900,100,'VR','employee','#9333ea','active'),
  ('00000000-0000-0000-0000-0000000e0012','00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000f2','Lóa',null,'hourly',2900,70,'Efling','employee','#e11d48','active')
on conflict (id) do nothing;

-- integrations
insert into integrations (id, company_id, kind, status) values
  ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-0000000000c0','payday','connected'),
  ('00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-0000000000c0','inventra','connected'),
  ('00000000-0000-0000-0000-00000000a003','00000000-0000-0000-0000-0000000000c0','pos','available')
on conflict (id) do nothing;

-- ////////////////// 0004_audit.sql //////////////////
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

-- ////////////////// 0005_requests.sql //////////////////
-- ============================================================
-- VAKTO — shift swaps + availability, and employee self-service RLS.
-- Run after 0001–0004.
-- ============================================================

-- Current user's own employee row (security definer to avoid recursion).
create or replace function public.auth_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid() limit 1;
$$;

-- ---------- shift swaps (vaktaskipti) ----------
create table if not exists shift_swaps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  requester_id uuid not null references employees(id) on delete cascade,
  requestee_id uuid references employees(id) on delete set null,
  requester_shift_id uuid references shifts(id) on delete set null,
  requestee_shift_id uuid references shifts(id) on delete set null,
  note text,                                           -- t.d. "laugardagur 12–20"
  status leave_status not null default 'pending',      -- pending|approved|rejected
  created_at timestamptz not null default now()
);
create index if not exists shift_swaps_company_idx on shift_swaps(company_id);

-- ---------- availability / unavailability (framboð / óframboð) ----------
create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  available boolean not null default true,             -- true = framboð, false = óframboð
  weekdays int[] default '{}',                         -- 0=Mán … 6=Sun
  from_date date,
  to_date date,
  reason text,                                         -- "getur ekki unnið fimmtudaga í júlí"
  created_at timestamptz not null default now()
);
create index if not exists availability_company_idx on availability(company_id);

-- ---------- RLS ----------
alter table shift_swaps  enable row level security;
alter table availability enable row level security;

-- Read: anyone in the company. Managers may write anything.
do $$
declare t text;
begin
  foreach t in array array['shift_swaps','availability']
  loop
    execute format('drop policy if exists %1$s_read on %1$s;', t);
    execute format(
      'create policy %1$s_read on %1$s for select using (company_id = public.auth_company_id());', t);
    execute format('drop policy if exists %1$s_mgr_write on %1$s;', t);
    execute format(
      'create policy %1$s_mgr_write on %1$s for all using (company_id = public.auth_company_id() and public.is_manager()) with check (company_id = public.auth_company_id() and public.is_manager());', t);
  end loop;
end $$;

-- Employees may create their own requests (and read covered by *_read above).
drop policy if exists shift_swaps_self_insert on shift_swaps;
create policy shift_swaps_self_insert on shift_swaps for insert
  with check (company_id = public.auth_company_id() and requester_id = public.auth_employee_id());

drop policy if exists availability_self_insert on availability;
create policy availability_self_insert on availability for insert
  with check (company_id = public.auth_company_id() and employee_id = public.auth_employee_id());

-- Employees may submit their own leave requests (manager write already exists from 0002).
drop policy if exists leave_requests_self_insert on leave_requests;
create policy leave_requests_self_insert on leave_requests for insert
  with check (company_id = public.auth_company_id() and employee_id = public.auth_employee_id());

-- Employees may update their own employee row (e.g. photo_url) — managers already can.
drop policy if exists employees_self_update on employees;
create policy employees_self_update on employees for update
  using (company_id = public.auth_company_id() and id = public.auth_employee_id())
  with check (company_id = public.auth_company_id() and id = public.auth_employee_id());

-- ////////////////// 0006_storage.sql //////////////////
-- ============================================================
-- VAKTO — Supabase Storage buckets for employee documents & photos.
-- Path convention: <company_id>/<employee_id>/<filename>
-- Run after 0005. Storage RLS lives on storage.objects.
-- ============================================================

-- Buckets: documents is private (signed URLs), avatars is public.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- ---------- documents (private): managers in the company ----------
drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select
  using (
    bucket_id = 'documents'
    and public.is_manager()
    and (storage.foldername(name))[1] = public.auth_company_id()::text
  );

drop policy if exists documents_write on storage.objects;
create policy documents_write on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and public.is_manager()
    and (storage.foldername(name))[1] = public.auth_company_id()::text
  );

drop policy if exists documents_delete on storage.objects;
create policy documents_delete on storage.objects for delete
  using (
    bucket_id = 'documents'
    and public.is_manager()
    and (storage.foldername(name))[1] = public.auth_company_id()::text
  );

-- ---------- avatars (public read): self or managers may write ----------
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.auth_company_id()::text
    and (
      public.is_manager()
      or (storage.foldername(name))[2] = public.auth_employee_id()::text
    )
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.auth_company_id()::text
    and (
      public.is_manager()
      or (storage.foldername(name))[2] = public.auth_employee_id()::text
    )
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.auth_company_id()::text
    and (
      public.is_manager()
      or (storage.foldername(name))[2] = public.auth_employee_id()::text
    )
  );

-- ////////////////// 0007_payrules.sql //////////////////
-- ============================================================
-- VAKTO — pay rules (kjarasamninga álag/yfirvinna/stórhátíð) + monthly hours.
-- Defaults live in code (src/lib/payrules.ts); this table stores per-company
-- overrides + confirmation. Rates are UNCONFIRMED until verified against the
-- real agreements (Efling/VR). Run after 0001–0006.
-- ============================================================

-- Desired contracted hours per month, per employee (for time-bank / analytics).
alter table employees add column if not exists monthly_hours numeric;

create table if not exists pay_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,                       -- dagvinna | alag_kvold | alag_helgi | yfirvinna | storhatid
  label text not null,
  kind text not null default 'premium',     -- premium | overtime | holiday
  pct numeric not null default 0,           -- premium % over base rate
  confirmed boolean not null default false, -- verified against the real agreement?
  sort int not null default 0,
  unique (company_id, code)
);
create index if not exists pay_rules_company_idx on pay_rules(company_id);

alter table pay_rules enable row level security;

drop policy if exists pay_rules_read on pay_rules;
create policy pay_rules_read on pay_rules for select
  using (company_id = public.auth_company_id());

drop policy if exists pay_rules_write on pay_rules;
create policy pay_rules_write on pay_rules for all
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());


-- ===== 0008 — punch approval =====
alter table punches add column if not exists approved boolean not null default false;
alter table punches add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table punches add column if not exists approved_at timestamptz;
create index if not exists punches_approved_idx on punches (company_id, approved);

-- ===== 0009 — company kennitala =====
alter table companies add column if not exists kennitala text;

-- ===== 0010 — punch corrections =====
create table if not exists punch_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  punch_id uuid references punches(id) on delete set null,
  date date not null, requested_in time, requested_out time, reason text,
  status text not null default 'pending', created_at timestamptz not null default now()
);
create index if not exists punch_corrections_company_idx on punch_corrections (company_id, status);
alter table punch_corrections enable row level security;
drop policy if exists punch_corrections_read on punch_corrections;
create policy punch_corrections_read on punch_corrections for select using (company_id = public.auth_company_id());
drop policy if exists punch_corrections_ins on punch_corrections;
create policy punch_corrections_ins on punch_corrections for insert with check (company_id = public.auth_company_id() and (public.is_manager() or employee_id = public.auth_employee_id()));
drop policy if exists punch_corrections_upd on punch_corrections;
create policy punch_corrections_upd on punch_corrections for update using (company_id = public.auth_company_id() and public.is_manager()) with check (company_id = public.auth_company_id() and public.is_manager());

-- ===== 0011 — staffing need =====
alter table companies add column if not exists staffing_targets jsonb;

-- ===== 0012 — chat =====
create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null, kind text not null default 'group',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (channel_id, user_id)
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  body text not null, created_at timestamptz not null default now()
);
create index if not exists messages_channel_idx on messages (channel_id, created_at);
alter table channels enable row level security;
alter table channel_members enable row level security;
alter table messages enable row level security;
drop policy if exists channels_rw on channels;
create policy channels_rw on channels for all using (company_id = public.auth_company_id()) with check (company_id = public.auth_company_id());
drop policy if exists messages_read on messages;
create policy messages_read on messages for select using (company_id = public.auth_company_id());
drop policy if exists messages_ins on messages;
create policy messages_ins on messages for insert with check (company_id = public.auth_company_id() and sender_id = auth.uid());
drop policy if exists channel_members_rw on channel_members;
create policy channel_members_rw on channel_members for all using (exists (select 1 from channels c where c.id = channel_id and c.company_id = public.auth_company_id())) with check (exists (select 1 from channels c where c.id = channel_id and c.company_id = public.auth_company_id()));

-- ===== 0013 — employee custom pay-rule =====
alter table employees add column if not exists pay_rule jsonb;

-- ===== 0014 — chat v2 (media, DMs, privacy, bucket) =====
alter table messages add column if not exists kind text not null default 'text';
alter table messages add column if not exists attachment_url text;
drop policy if exists channels_rw on channels;
drop policy if exists channels_read on channels;
create policy channels_read on channels for select using (company_id = public.auth_company_id() and (kind = 'general' or created_by = auth.uid() or exists (select 1 from channel_members m where m.channel_id = id and m.user_id = auth.uid())));
drop policy if exists channels_ins on channels;
create policy channels_ins on channels for insert with check (company_id = public.auth_company_id());
drop policy if exists channels_upd on channels;
create policy channels_upd on channels for update using (company_id = public.auth_company_id() and (created_by = auth.uid() or public.is_manager())) with check (company_id = public.auth_company_id());
drop policy if exists channels_del on channels;
create policy channels_del on channels for delete using (company_id = public.auth_company_id() and (created_by = auth.uid() or public.is_manager()));
drop policy if exists messages_read on messages;
create policy messages_read on messages for select using (company_id = public.auth_company_id() and exists (select 1 from channels c where c.id = channel_id and (c.kind = 'general' or c.created_by = auth.uid() or exists (select 1 from channel_members m where m.channel_id = c.id and m.user_id = auth.uid()))));
insert into storage.buckets (id, name, public) values ('chat','chat', true) on conflict (id) do update set public = true;
drop policy if exists chat_read on storage.objects;
create policy chat_read on storage.objects for select using (bucket_id = 'chat');
drop policy if exists chat_write on storage.objects;
create policy chat_write on storage.objects for insert to authenticated with check (bucket_id = 'chat');

-- ===== 0015 — chat RLS recursion fix =====
create or replace function public.is_channel_member(cid uuid) returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from channel_members m where m.channel_id = cid and m.user_id = auth.uid()) $$;
create or replace function public.channel_company(cid uuid) returns uuid language sql security definer stable set search_path = public as
$$ select company_id from channels where id = cid $$;
create or replace function public.channel_visible(cid uuid) returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from channels c where c.id = cid and c.company_id = public.auth_company_id() and (c.kind = 'general' or c.created_by = auth.uid() or exists (select 1 from channel_members m where m.channel_id = cid and m.user_id = auth.uid()))) $$;
drop policy if exists channels_read on channels;
create policy channels_read on channels for select using (company_id = public.auth_company_id() and (kind = 'general' or created_by = auth.uid() or public.is_channel_member(id)));
drop policy if exists channel_members_rw on channel_members;
drop policy if exists channel_members_read on channel_members;
drop policy if exists channel_members_write on channel_members;
create policy channel_members_read on channel_members for select using (public.channel_company(channel_id) = public.auth_company_id());
create policy channel_members_write on channel_members for all using (public.channel_company(channel_id) = public.auth_company_id()) with check (public.channel_company(channel_id) = public.auth_company_id());
drop policy if exists messages_read on messages;
create policy messages_read on messages for select using (company_id = public.auth_company_id() and public.channel_visible(channel_id));

-- ===== 0016 — permissions + benefits =====
alter table employees add column if not exists permissions jsonb;
alter table employees add column if not exists benefits jsonb;

-- ===== 0017 — desember-/orlofsuppbót line on payroll =====
alter table payroll_lines add column if not exists uppbot numeric not null default 0;

-- ===== 0018 — average revenue per weekday (laun% estimation) =====
alter table companies add column if not exists weekday_revenue jsonb;

-- ===== 0019 — web push subscriptions =====
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on push_subscriptions(user_id);
alter table push_subscriptions enable row level security;
drop policy if exists push_own on push_subscriptions;
create policy push_own on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== 0020 — company subscription plan + trial =====
alter table companies add column if not exists plan text;
alter table companies add column if not exists trial_ends_at timestamptz;

-- ===== 0021 — per-employee orlof (vacation) handling =====
alter table employees add column if not exists orlof jsonb;

-- ===== 0022 — company country (gates Icelandic-specific modules) =====
alter table companies add column if not exists country text default 'IS';

-- ===== 0024 — per-employee clock token (Wallet ID card QR) =====
alter table employees add column if not exists clock_token text unique;
update employees set clock_token = replace(gen_random_uuid()::text, '-', '') where clock_token is null;

-- ===== 0023 — multi-company memberships (switch between companies) =====
create table if not exists company_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role user_role not null default 'employee',
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);
create index if not exists company_members_user on company_members(user_id);
alter table company_members enable row level security;
drop policy if exists company_members_own on company_members;
create policy company_members_own on company_members for select using (user_id = auth.uid());
insert into company_members (user_id, company_id, role)
  select id, company_id, role from public.users where company_id is not null
  on conflict (user_id, company_id) do nothing;

-- ===== 0026 — company contact/info fields (Stillingar → Fyrirtæki) =====
alter table companies add column if not exists address text;
alter table companies add column if not exists phone text;
alter table companies add column if not exists email text;

-- ===== 0025 — managers scoped to overseen departments (names; null = all) =====
alter table employees add column if not exists oversees_departments text[];

-- ===== 0027 — manual billing status per company (VAKTO admin) =====
alter table companies add column if not exists billing_status text;

-- ===== 0028 — universal core (rule templates, contracts, patterns) =====
-- ---------- rule templates ----------
create table if not exists rule_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  country text,                                -- free text (e.g. "Ísland", "Danmark")
  region text,                                 -- region/town, free text
  industry text,                               -- free text
  union_name text,                             -- union/agreement, free text
  rules jsonb not null default '{}'::jsonb,    -- RuleSet — see src/lib/rules.ts
  source text not null default 'manual',       -- manual | preset | ai
  approved boolean not null default true,      -- AI suggestions require approval
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rule_templates_company_idx on rule_templates(company_id);

alter table rule_templates enable row level security;
drop policy if exists rule_templates_read on rule_templates;
create policy rule_templates_read on rule_templates for select
  using (company_id = public.auth_company_id());
drop policy if exists rule_templates_write on rule_templates;
create policy rule_templates_write on rule_templates for all
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());

-- ---------- employees: universal fields ----------
-- union becomes free text (any union anywhere); template + contract + pattern.
alter table employees add column if not exists union_name text;
alter table employees add column if not exists rule_template_id uuid references rule_templates(id) on delete set null;
alter table employees add column if not exists contract_type text;      -- fulltime | parttime | temporary | contractor | custom…
alter table employees add column if not exists schedule_pattern jsonb;  -- {kind, days, hours…} — see src/lib/rules.ts

-- ---------- employment contracts ----------
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  template text,                               -- template key used to generate
  title text not null default 'Ráðningarsamningur',
  content text not null,                       -- generated text (markdown), editable
  status text not null default 'draft',        -- draft | sent | signed | void
  sent_at timestamptz,
  signed_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists contracts_company_idx on contracts(company_id);
create index if not exists contracts_employee_idx on contracts(employee_id);

alter table contracts enable row level security;
drop policy if exists contracts_manager on contracts;
create policy contracts_manager on contracts for all
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());
drop policy if exists contracts_own_read on contracts;
create policy contracts_own_read on contracts for select
  using (employee_id = public.auth_employee_id());

-- ===== 0041_mobile_employee_access.sql =====
-- 0041: Mobile app employee access
-- The Expo app talks to Supabase directly with the anon key (no Next.js server
-- actions), so employees need RLS for the flows the web routes through
-- service-role code today:
--   1. employees can read their OWN employee row even when users.company_id
--      is not set (the web falls back to the admin client for this)
--   2. employees can clock in/out from the app (punches self insert + update
--      of their own open punch) — kiosk stays service-role
--   3. employees can read company-shared documents and their own folder in
--      the private `documents` storage bucket (needed for createSignedUrl)

-- 1) employees: self-read by auth link
drop policy if exists employees_self_read on public.employees;
create policy employees_self_read on public.employees
  for select using (user_id = auth.uid());

-- 2) punches: self clock-in / clock-out
drop policy if exists punches_self_insert on public.punches;
create policy punches_self_insert on public.punches
  for insert with check (
    employee_id = public.auth_employee_id()
    and company_id = (
      select e.company_id from public.employees e
      where e.id = public.auth_employee_id()
    )
  );

drop policy if exists punches_self_update on public.punches;
create policy punches_self_update on public.punches
  for update using (employee_id = public.auth_employee_id())
  with check (employee_id = public.auth_employee_id());

-- 3) storage: employees read shared company docs + their own folder
--    (path convention: <company_id>/shared/<file> and <company_id>/<employee_id>/<file>)
drop policy if exists "documents employee read" on storage.objects;
create policy "documents employee read" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (
      select e.company_id::text from public.employees e
      where e.id = public.auth_employee_id()
    )
    and (
      (storage.foldername(name))[2] = 'shared'
      or (storage.foldername(name))[2] = public.auth_employee_id()::text
    )
  );

-- ===== 0042_messenger.sql =====
-- 0042: Messenger-style chat upgrades
--   1. channels.photo_url — group photo (any member of a group may update
--      name/photo, like Messenger; creator/manager policy stays for the rest)
--   2. messages.reply_to — reply-to-message threading
--   3. message_reactions — one emoji reaction per user per message
--   4. employees may delete their OWN messages

alter table channels add column if not exists photo_url text;

alter table messages add column if not exists reply_to uuid references messages(id) on delete set null;

create table if not exists message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  emoji text not null default '❤️',
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table message_reactions enable row level security;

drop policy if exists message_reactions_read on message_reactions;
create policy message_reactions_read on message_reactions
  for select using (company_id = public.auth_company_id());

drop policy if exists message_reactions_own on message_reactions;
create policy message_reactions_own on message_reactions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and company_id = public.auth_company_id());

-- group members may rename / set photo on their group channels
drop policy if exists channels_member_update on channels;
create policy channels_member_update on channels
  for update using (kind = 'group' and public.is_channel_member(id))
  with check (kind = 'group' and public.is_channel_member(id));

-- unsend: delete your own message
drop policy if exists messages_own_delete on messages;
create policy messages_own_delete on messages
  for delete using (sender_id = auth.uid());

-- ===== 0043_realtime_chat.sql =====
-- 0043: Realtime for chat — messages (and channel renames/photos) stream to
-- clients instantly instead of 4s polling. RLS still governs what each
-- subscriber may see (postgres_changes respects policies).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.channels;
exception when duplicate_object then null;
end $$;

-- ===== 0044_security.sql =====
-- 0044 — öryggislagfæringar fyrir sölu (WASTE-listi D1–D3)
--
-- D1  chat-bucket: lestur var opinn öllum innskráðum notendum þvert á fyrirtæki.
--     Slóðin er "<company_id>/…" (sjá spjall/actions.ts uploadChatMedia) → afmarka við eigið fyrirtæki.
-- D2  kiosk: fyrirtækis-UUID í URL nægði til að sjá starfsfólk og hver er á vakt.
--     Nýr leynilykill companies.kiosk_token; kiosk-slóðin verður /kiosk?k=<token>.
-- D3  auth-trigger gaf nýjum notendum sjálfgefið hlutverkið owner. Sjálfgefið verður employee;
--     nýskráning eiganda sendir role=owner í metadata (nyskraning/actions.ts) og boð senda sitt hlutverk.

-- ---------- D1: chat storage ----------
drop policy if exists chat_read on storage.objects;
create policy chat_read on storage.objects for select to authenticated using (
  bucket_id = 'chat'
  and (storage.foldername(name))[1] = auth_company_id()::text
);
drop policy if exists chat_write on storage.objects;
create policy chat_write on storage.objects for insert to authenticated with check (
  bucket_id = 'chat'
  and (storage.foldername(name))[1] = auth_company_id()::text
);

-- ---------- D2: kiosk token ----------
create extension if not exists pgcrypto;
alter table companies add column if not exists kiosk_token text;
update companies set kiosk_token = encode(gen_random_bytes(16), 'hex') where kiosk_token is null;
alter table companies alter column kiosk_token set not null;
alter table companies alter column kiosk_token set default encode(gen_random_bytes(16), 'hex');
create unique index if not exists companies_kiosk_token_idx on companies(kiosk_token);

-- ---------- D3: default role ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee')
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ===== 0045_labor_target.sql =====
-- 0045 — per-company target for laun % af veltu (the dashboard's traffic light:
-- green ≤ target, yellow ≤ target + 3, red above). Was hardcoded 30 in three
-- places; now one setting read by src/lib/labor.ts getLaborTarget(). Run after 0044.
alter table companies add column if not exists labor_target numeric default 30;

-- ===== 0046_chat_messenger.sql =====
-- 0046: Messenger-grade chat. Run after 0045.
--   1. channel_reads — per-user "last read" cursor per channel → real unread
--      counts (server-side) + read receipts ("Séð").
--   2. chat_unread_counts() — RPC that counts unread messages per channel for
--      the caller (security invoker → messages RLS decides what is visible).
--   3. channels.auto_key — 'dept:<id>' | 'loc:<id>' marks the automatic team
--      channels per department / location (kept in sync from the app).
--   4. channel_reads joins the realtime publication so read receipts update live.
-- The web chat tolerates this migration being absent (counts fall back to 0,
-- receipts/team channels simply do not appear).

-- ---------- 1) channel_reads ----------
create table if not exists public.channel_reads (
  channel_id   uuid not null references public.channels(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists channel_reads_user_idx on public.channel_reads (user_id);

alter table public.channel_reads enable row level security;

-- Members of a channel may SEE each other's cursors (read receipts) …
drop policy if exists channel_reads_read on public.channel_reads;
create policy channel_reads_read on public.channel_reads
  for select using (public.channel_visible(channel_id));

-- … but only ever WRITE their own row.
drop policy if exists channel_reads_own on public.channel_reads;
create policy channel_reads_own on public.channel_reads
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.channel_visible(channel_id));

-- ---------- 2) unread counts ----------
-- Messages newer than my cursor, sent by someone else, in channels I can see.
-- A channel with no cursor row counts everything (first visit clears it).
create or replace function public.chat_unread_counts()
returns table (channel_id uuid, n bigint)
language sql stable security invoker set search_path = public as $$
  select m.channel_id, count(*)::bigint as n
  from public.messages m
  left join public.channel_reads r
    on r.channel_id = m.channel_id and r.user_id = auth.uid()
  where m.sender_id is distinct from auth.uid()
    and m.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz)
  group by m.channel_id
$$;
grant execute on function public.chat_unread_counts() to authenticated;

-- ---------- 3) automatic team channels ----------
alter table public.channels add column if not exists auto_key text;
-- Plain (non-partial) unique index: NULLs are distinct, so manual channels never
-- collide, and PostgREST's `on_conflict=auto_key` upsert can infer it.
create unique index if not exists channels_auto_key_uidx on public.channels (auto_key);

-- ---------- 4) realtime ----------
do $$
begin
  alter publication supabase_realtime add table public.channel_reads;
exception when duplicate_object then null;
end $$;

-- ===== 0047_platform_admin.sql =====
-- 0047 — VAKTO platform admin (the SaaS owner's /admin): a platform-wide audit
-- trail of everything the owner does across tenants, plus a free-text admin
-- note per company (billing/sales context until Stripe/Teya exists).
-- Run after 0046 (staging first, prod at release).

-- Every admin action: billing change, trial extension, suspension,
-- impersonation start/end, note, login-link send. Written ONLY through the
-- service-role client from src/app/admin/actions.ts — never by tenants.
create table if not exists platform_audit (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,                                   -- who (allowlisted VAKTO_ADMIN_EMAILS)
  action text not null,                                        -- billing.set | trial.extend | suspend | unsuspend |
                                                               -- impersonate.start | impersonate.end | note.save | login_link.send
  company_id uuid references companies(id) on delete set null, -- which tenant (null = platform-level)
  target text,                                                 -- e.g. the user email acted on
  detail text,                                                 -- human-readable description
  at timestamptz not null default now()
);
create index if not exists platform_audit_at_idx on platform_audit(at desc);
create index if not exists platform_audit_company_at_idx on platform_audit(company_id, at desc);

-- Deny-all RLS: no policies at all, so anon/authenticated can neither read nor
-- write. The service role bypasses RLS and is the only writer/reader.
alter table platform_audit enable row level security;
revoke all on table platform_audit from anon, authenticated;

-- Free-text note the admin keeps per company ("Athugasemd" in /admin):
-- who they are, what was agreed, when to follow up on payment, etc.
alter table companies add column if not exists admin_note text;

-- ===== 0048_comment_replies.sql =====
-- 0048 — svör við athugasemdum í fréttaveitu (eitt þrep, eins og á Facebook).
alter table post_comments add column if not exists parent_id uuid references post_comments(id) on delete cascade;
create index if not exists post_comments_parent_idx on post_comments(parent_id);

-- ===== 0049_support_chat.sql =====
-- Spjallgaurinn á heimasíðunni: samtöl gesta (bot + eigandi tekur við).
-- Service-role eingöngu — RLS kveikt án stefna, vefþjónninn les/skrifar með admin-lykli.
create table if not exists support_threads (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text,
  email text,
  lang text not null default 'is',
  status text not null default 'bot' check (status in ('bot','human','closed')),
  page text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_seen_at timestamptz
);
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references support_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','owner')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_thread_idx on support_messages(thread_id, created_at);
create index if not exists support_threads_updated_idx on support_threads(updated_at desc);
alter table support_threads enable row level security;
alter table support_messages enable row level security;

-- ===== 0050_billing.sql =====
-- Áskrift og greiðslur gegnum Straum (kort skráð við nýskráningu, tekið af því eftir prufu).
-- Allt skrifað með service-role úr vefþjóni/webhook; RLS leyfir fyrirtækinu að LESA sín gögn.
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null default 'straumur',
  token text not null,
  card_summary text,          -- síðustu 4
  card_brand text,            -- VI / MC ...
  card_expiry text,           -- MM/yyyy
  checkout_reference text,
  payfac_reference text,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now()
);
create index if not exists payment_methods_company_idx on payment_methods(company_id, status);
create unique index if not exists payment_methods_token_idx on payment_methods(provider, token);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  users_count int not null default 0,
  base_amount int not null,       -- kr án VSK
  extra_amount int not null default 0,
  vat_amount int not null default 0,
  total_amount int not null,      -- kr með VSK (það sem er tekið af korti)
  currency text not null default 'ISK',
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','void')),
  reference text not null unique, -- merchantReference hjá Straumi: inv:<id>
  payfac_reference text,
  attempts int not null default 0,
  last_error text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invoices_company_idx on invoices(company_id, period_start desc);

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  event_type text not null,
  payfac_reference text,
  merchant_reference text,
  success boolean,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create unique index if not exists billing_events_dedup on billing_events(event_type, payfac_reference, merchant_reference);

alter table companies add column if not exists billing_anchor date;           -- fyrsti gjalddagi (= lok prufu)
alter table companies add column if not exists trial_reminder_sent_at timestamptz;
alter table companies add column if not exists trial_expired_sent_at timestamptz;

alter table payment_methods enable row level security;
alter table invoices enable row level security;
alter table billing_events enable row level security;
drop policy if exists payment_methods_read on payment_methods;
create policy payment_methods_read on payment_methods for select using (company_id = auth_company_id());
drop policy if exists invoices_read on invoices;
create policy invoices_read on invoices for select using (company_id = auth_company_id());
