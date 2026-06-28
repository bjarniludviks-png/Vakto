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
