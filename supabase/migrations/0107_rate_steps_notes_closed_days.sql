-- 0107 — Taxtahækkanir, athugasemdir stjórnenda, lokaðir dagar og veikindi utan launahlutfalls.
-- Run after 0106. Allt viðbót (if not exists) — engum gögnum breytt.
--
-- 1) employees.rate_steps: fyrirfram skráðar taxtahækkanir („verður 17 ára“, „12 mán. í starfi“,
--    „frá dags.“). Dagleg keyrsla (/api/cron/punch-check → lib/rate-steps.server.ts) hækkar taxtann
--    sjálf (mode 'auto') eða lætur stjórnendur vita (mode 'notify'). Starfsmaður getur ekki breytt
--    dálkinum sjálfur (guard_employee_self_update í 0076 hleypir aðeins samskiptadálkum í gegn).
--    Form: [{ id, kind: 'age'|'service'|'date', at?: number, date?: 'YYYY-MM-DD', rate: number,
--             mode: 'auto'|'notify', label?: text, doneAt?: timestamptz }]
alter table public.employees add column if not exists rate_steps jsonb not null default '[]'::jsonb;

-- 2) companies.labor_excl_sick: samþykkt veikindi mánaðarlaunafólks teljast ekki í launahlutfalli
--    (laun % af veltu). Tímakaupsfólk í veikindum stimplar ekki og telst því þegar ekki með.
alter table public.companies add column if not exists labor_excl_sick boolean not null default false;

-- 3) employee_notes: athugasemdir um starfsmann sem AÐEINS stjórnendur sjá. Sér tafla — ekki
--    dálkur á employees, því starfsmaður les eigin employees-röð (employees_self_read, 0041).
create table if not exists public.employee_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  author_id uuid references public.users(id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);
create index if not exists employee_notes_emp_idx on public.employee_notes (employee_id, created_at desc);
alter table public.employee_notes enable row level security;
drop policy if exists employee_notes_manager on public.employee_notes;
create policy employee_notes_manager on public.employee_notes for all
  using (company_id = auth_company_id() and is_manager())
  with check (company_id = auth_company_id() and is_manager());

-- 4) closed_days: dagar sem fyrirtæki (location_id null) eða einn staður er lokaður — t.d. jól.
--    Engar vaktir má setja á lokaðan dag; triggerinn hér að neðan er öryggisnetið fyrir ALLAR
--    skrifleiðir (vefur, app, AI, MCP). Vaktir sem voru til fyrir lokun haldast (aðeins ný vakt
--    eða vakt sem er færð á lokaðan dag er stöðvuð) — skjárinn bendir á þær.
create table if not exists public.closed_days (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  label text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date and to_date - from_date <= 366)
);
create index if not exists closed_days_company_idx on public.closed_days (company_id, from_date);
alter table public.closed_days enable row level security;
drop policy if exists closed_days_read on public.closed_days;
create policy closed_days_read on public.closed_days for select using (company_id = auth_company_id());
drop policy if exists closed_days_manager on public.closed_days;
create policy closed_days_manager on public.closed_days for all
  using (company_id = auth_company_id() and is_manager())
  with check (company_id = auth_company_id() and is_manager());

-- Staður vaktar = shifts.location_id, annars staður starfsmannsins. Lokun á fyrirtækið (location_id
-- null) gildir um allar vaktir; lokun á stað gildir um vaktir þess staðar.
create or replace function public.guard_closed_day() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  loc uuid;
  hit record;
begin
  -- Breyting á vakt sem er þegar til (skipti, úthlutun, útgáfa) er aðeins stöðvuð ef hún er FÆRÐ á annan dag.
  if tg_op = 'UPDATE' and new.date = old.date then
    return new;
  end if;
  loc := new.location_id;
  if loc is null and new.employee_id is not null then
    select location_id into loc from public.employees where id = new.employee_id;
  end if;
  select label, from_date into hit from public.closed_days c
   where c.company_id = new.company_id
     and new.date between c.from_date and c.to_date
     and (c.location_id is null or c.location_id = loc)
   limit 1;
  if found then
    raise exception 'Lokað er % (%) — ekki hægt að setja vakt á þann dag.',
      to_char(new.date, 'FMDD.FMMM.YYYY'), coalesce(nullif(hit.label, ''), 'lokaður dagur')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists shifts_closed_day_guard on public.shifts;
create trigger shifts_closed_day_guard before insert or update on public.shifts
  for each row execute function public.guard_closed_day();

-- Sömu varnir og aðrar töflur: opið demo er lesaðgangur, starfsfólk sem er hætt skrifar ekki.
do $$
declare t text;
begin
  foreach t in array array['employee_notes', 'closed_days'] loop
    execute format('drop policy if exists demo_readonly_insert on public.%I', t);
    execute format('create policy demo_readonly_insert on public.%I as restrictive for insert to authenticated with check (not (select is_demo_user()))', t);
    execute format('drop policy if exists demo_readonly_update on public.%I', t);
    execute format('create policy demo_readonly_update on public.%I as restrictive for update to authenticated using (not (select is_demo_user())) with check (not (select is_demo_user()))', t);
    execute format('drop policy if exists demo_readonly_delete on public.%I', t);
    execute format('create policy demo_readonly_delete on public.%I as restrictive for delete to authenticated using (not (select is_demo_user()))', t);
    execute format('drop policy if exists offboarded_select on public.%I', t);
    execute format('create policy offboarded_select on public.%I as restrictive for select to authenticated using ((select auth_offboard_state()) = ''active'')', t);
    execute format('drop policy if exists offboarded_insert on public.%I', t);
    execute format('create policy offboarded_insert on public.%I as restrictive for insert to authenticated with check (not (select auth_is_offboarded()))', t);
    execute format('drop policy if exists offboarded_update on public.%I', t);
    execute format('create policy offboarded_update on public.%I as restrictive for update to authenticated using (not (select auth_is_offboarded())) with check (not (select auth_is_offboarded()))', t);
    execute format('drop policy if exists offboarded_delete on public.%I', t);
    execute format('create policy offboarded_delete on public.%I as restrictive for delete to authenticated using (not (select auth_is_offboarded()))', t);
    execute format('drop trigger if exists demo_readonly_guard on public.%I', t);
    execute format('create trigger demo_readonly_guard before insert or delete or update on public.%I for each statement execute function demo_readonly_guard()', t);
    execute format('drop trigger if exists offboarded_guard on public.%I', t);
    execute format('create trigger offboarded_guard before insert or delete or update on public.%I for each statement execute function offboarded_guard()', t);
  end loop;
end $$;
