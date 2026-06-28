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
