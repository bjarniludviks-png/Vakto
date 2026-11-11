-- 0112 — Sjálfvirk stimplun (geofence í appinu) + sjálfvirk útstimplun eftir X klst. Run after 0110.
--
-- 1) Sjálfvirk stimplun — fyrirtæki velur (companies.auto_punch_mode):
--      'off'     — sjálfgefið; appið fylgist ekki með neinu
--      'suggest' — síminn tekur eftir komu/brottför á vinnustað og býr til TILLÖGU sem starfsmaður staðfestir
--      'auto'    — síminn stimplar beint inn/út (merkt „sjálfvirk“ í Tímaskráningu)
--    Starfsmaður verður SJÁLFUR að kveikja í appinu (auto_punch_consents) — stjórnandi getur ekki kveikt fyrir hann.
--    Staðsetning er aðeins notuð á stimplunarstund (svæðismörk í stýrikerfinu), aldrei samfelld rakning.
--    auto_punch_unscheduled: má stimpla sjálfkrafa á degi án vaktar (sjálfgefið nei).
--    Appið skrifar ekki sjálft: /api/app/auto-punch (þjónustulykill) metur reglurnar og skrifar.
--
-- 2) Sjálfvirk útstimplun — companies.auto_clockout_hours (null = slökkt, 4–24). Opin stimplun sem er eldri
--    en X klst. er lokuð á clock_in + X (cron /api/cron/auto-clockout á 15 mín. fresti) og merkt
--    auto_out = 'limit' svo stjórnandi fari yfir hana. Aðeins stimplanir sem hófust EFTIR að kveikt var
--    (auto_clockout_since). Áminningar til starfsmanns 4 og 2 klst. fyrr (12 og 14 klst. við 16).
--
-- punches.source fær gildið 'auto' (sjálfvirk innstimplun). punches.auto_out: 'geofence' (síminn fór af
-- svæðinu) | 'limit' (hámarkslengd). Örugg endurkeyrsla.

alter type punch_source add value if not exists 'auto';

alter table public.companies add column if not exists auto_punch_mode text not null default 'off';
do $$ begin
  alter table public.companies add constraint companies_auto_punch_mode_chk check (auto_punch_mode in ('off', 'suggest', 'auto'));
exception when duplicate_object then null; end $$;
alter table public.companies add column if not exists auto_punch_unscheduled boolean not null default false;
alter table public.companies add column if not exists auto_clockout_hours smallint;
do $$ begin
  alter table public.companies add constraint companies_auto_clockout_hours_chk check (auto_clockout_hours is null or auto_clockout_hours between 4 and 24);
exception when duplicate_object then null; end $$;
alter table public.companies add column if not exists auto_clockout_since timestamptz;

alter table public.punches add column if not exists auto_out text;
do $$ begin
  alter table public.punches add constraint punches_auto_out_chk check (auto_out is null or auto_out in ('geofence', 'limit'));
exception when duplicate_object then null; end $$;
-- Áminningar fyrir sjálfvirka útstimplun: 0 = engin, 1 = fyrri (X−4), 2 = seinni (X−2).
alter table public.punches add column if not exists auto_reminded smallint not null default 0;
create index if not exists punches_open_idx on public.punches (company_id, clock_in) where clock_out is null;

-- Samþykki starfsmanns. Aðeins þjónninn skrifar (eftir að hafa staðfest innskráðan notanda);
-- starfsmaður les eigin röð, stjórnendur sjá hverjir hafa kveikt.
create table if not exists public.auto_punch_consents (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.auto_punch_consents enable row level security;
drop policy if exists auto_punch_consents_read on public.auto_punch_consents;
create policy auto_punch_consents_read on public.auto_punch_consents for select
  using (user_id = auth.uid() or (company_id = auth_company_id() and is_manager()));

-- Tillögur (suggest-hamur, eða ef sjálfvirk innstimplun á ekki við). Aðeins þjónninn skrifar.
create table if not exists public.punch_suggestions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  at timestamptz not null,                                   -- hvenær síminn kom/fór (staðfest af þjóni ±15 mín.)
  location_id uuid references public.locations(id) on delete set null,
  lat double precision,
  lng double precision,
  acc integer,
  punch_id uuid references public.punches(id) on delete set null, -- útstimplun: stimplunin sem á að loka; staðfest: stimplunin
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'expired')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists punch_suggestions_emp_idx on public.punch_suggestions (employee_id, status, at desc);
alter table public.punch_suggestions enable row level security;
drop policy if exists punch_suggestions_read on public.punch_suggestions;
create policy punch_suggestions_read on public.punch_suggestions for select
  using (employee_id = auth_employee_id() or (company_id = auth_company_id() and is_manager()));

-- Geofence-triggerinn (0055) metur nú líka sjálfvirkar stimplanir ('auto') og sjálfvirka útstimplun af
-- svæði — staðsetningin á stimplunarstund er geymd þótt geofence_mode sé 'off', því hún ER ástæða stimplunarinnar.
create or replace function public.punches_geofence()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mode text;
  loc record;
  tol double precision;
  verdict text;
  is_auto boolean;
begin
  -- Verdict columns are never client-writable: keep what was there.
  if tg_op = 'UPDATE' then
    new.in_lat := old.in_lat; new.in_lng := old.in_lng; new.in_acc := old.in_acc;
    new.in_geo := old.in_geo; new.in_dist := old.in_dist; new.in_location_id := old.in_location_id;
    -- Stimplun opnuð aftur (t.d. sjálfvirk útstimplun afturkölluð vegna GPS-flökts): útstaðsetningin fer.
    if old.clock_out is not null and new.clock_out is null then
      new.out_lat := null; new.out_lng := null; new.out_acc := null;
      new.out_geo := null; new.out_dist := null; new.out_location_id := null;
      return new;
    end if;
    if not (old.clock_out is null and new.clock_out is not null) then
      new.out_lat := old.out_lat; new.out_lng := old.out_lng; new.out_acc := old.out_acc;
      new.out_geo := old.out_geo; new.out_dist := old.out_dist; new.out_location_id := old.out_location_id;
      return new;
    end if;
  else
    new.out_geo := null; new.out_dist := null; new.out_location_id := null;
  end if;

  is_auto := (tg_op = 'INSERT' and new.source::text = 'auto') or (tg_op = 'UPDATE' and new.auto_out = 'geofence');
  select geofence_mode into mode from companies where id = new.company_id;
  mode := coalesce(mode, 'off');
  if is_auto and mode = 'off' then mode := 'flag'; end if;
  if mode = 'off' or (new.source::text not in ('app', 'auto') and not is_auto) then
    -- Not in use: don't keep a position the company never asked for.
    if tg_op = 'INSERT' then
      new.in_lat := null; new.in_lng := null; new.in_acc := null; new.in_geo := null; new.in_dist := null; new.in_location_id := null;
    end if;
    new.out_lat := null; new.out_lng := null; new.out_acc := null;
    return new;
  end if;

  if not exists (select 1 from locations where company_id = new.company_id and lat is not null and lng is not null) then
    return new; -- no workplace pinned yet → nothing to compare against
  end if;

  if tg_op = 'INSERT' then
    if new.in_lat is null or new.in_lng is null then
      if mode = 'block' then raise exception 'GEOFENCE_MISSING'; end if;
      new.in_geo := 'missing';
      return new;
    end if;
    select l.id, l.geofence_radius, geo_distance_m(new.in_lat, new.in_lng, l.lat, l.lng) as d into loc
      from locations l where l.company_id = new.company_id and l.lat is not null and l.lng is not null
      order by geo_distance_m(new.in_lat, new.in_lng, l.lat, l.lng) limit 1;
    tol := least(coalesce(new.in_acc, 0), 100);  -- give back up to 100 m of GPS uncertainty
    -- Sjálfvirk: stýrikerfið hefur þegar staðfest komu á svæðið; staðsetningin er síðasta þekkta
    -- staðsetning símans og getur verið aðeins á eftir → 500 m svigrúm.
    if is_auto then tol := tol + 500; end if;
    verdict := case when loc.d - tol > loc.geofence_radius then 'outside' else 'ok' end;
    if verdict = 'outside' and mode = 'block' then
      raise exception 'GEOFENCE_OUTSIDE:%', round(loc.d)::int;
    end if;
    new.in_geo := verdict; new.in_dist := round(loc.d)::int; new.in_location_id := loc.id;
  else
    -- Only the employee's own clock-out is judged; a manager closing a
    -- forgotten punch (or the kiosk, or the auto clock-out cron) is not "missing location".
    if new.out_lat is null and (is_auto is false) and (select user_id from employees where id = new.employee_id) is distinct from auth.uid() then
      return new;
    end if;
    if new.out_lat is null and new.auto_out = 'limit' then
      return new;
    end if;
    if new.out_lat is null or new.out_lng is null then
      new.out_geo := 'missing';
      return new;
    end if;
    select l.id, l.geofence_radius, geo_distance_m(new.out_lat, new.out_lng, l.lat, l.lng) as d into loc
      from locations l where l.company_id = new.company_id and l.lat is not null and l.lng is not null
      order by geo_distance_m(new.out_lat, new.out_lng, l.lat, l.lng) limit 1;
    tol := least(coalesce(new.out_acc, 0), 100);
    -- Sjálfvirk útstimplun af svæði: síminn er rétt kominn út fyrir mörkin þegar atburðurinn kemur
    -- (stýrikerfið bætir við nokkur hundruð metrum) → ekki merkja það sem „utan svæðis“.
    if is_auto then tol := tol + 500; end if;
    new.out_geo := case when loc.d - tol > loc.geofence_radius then 'outside' else 'ok' end;
    new.out_dist := round(loc.d)::int; new.out_location_id := loc.id;
  end if;
  return new;
end $$;
revoke all on function public.punches_geofence() from public, anon, authenticated;

-- Starfsmaður getur ekki sjálfur merkt stimplun sjálfvirka né breytt auto_out/auto_reminded
-- (guard_punch_self_write leyfir aðeins clock_out + out_* við útstimplun; source 'auto' við INSERT er hafnað hér).
create or replace function public.guard_punch_auto_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_manager() then return new; end if;
  if tg_op = 'INSERT' then
    if new.source::text = 'auto' or new.auto_out is not null or new.auto_reminded <> 0 then
      raise exception 'PUNCH_TIME_FORBIDDEN: sjálfvirk stimplun fer um þjóninn' using errcode = '42501';
    end if;
  elsif new.auto_out is distinct from old.auto_out or new.auto_reminded is distinct from old.auto_reminded then
    raise exception 'PUNCH_TIME_FORBIDDEN: sjálfvirk stimplun fer um þjóninn' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_punch_auto_fields() from public, anon, authenticated;
drop trigger if exists punches_auto_fields_guard on public.punches;
create trigger punches_auto_fields_guard before insert or update on public.punches
  for each row execute function public.guard_punch_auto_fields();

-- Sömu varnir og aðrar töflur: opið demo er lesaðgangur, starfsfólk sem er hætt skrifar ekki.
do $$
declare t text;
begin
  foreach t in array array['auto_punch_consents', 'punch_suggestions'] loop
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
