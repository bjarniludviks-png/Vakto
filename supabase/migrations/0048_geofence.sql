-- 0048 — Staðsetning við stimplun (geofence). Run after 0047.
--
-- A company opts in (companies.geofence_mode):
--   'off'   — default; no location is asked for or stored
--   'flag'  — the app sends one position when clocking in/out; punches away
--             from every workplace are stored and flagged in Tímaskráning
--   'block' — as 'flag', but clock-IN away from a workplace (or without a
--             position) is refused. Clock-OUT is never refused: someone who
--             forgot must still be able to stop the clock.
-- Each location gets a pin (lat/lng) and a radius. Only locations with a pin
-- count; with no pinned location the check is skipped entirely.
-- Evaluated here, in a trigger, so the web and the mobile app (which writes
-- punches directly under RLS) follow one rule and the employee can't write
-- the verdict columns themselves. Kiosk ('kiosk') and manager edits ('web')
-- are skipped — the kiosk sits on-site and managers correct after the fact.

alter table locations add column if not exists lat double precision;
alter table locations add column if not exists lng double precision;
alter table locations add column if not exists geofence_radius integer not null default 150;

alter table companies add column if not exists geofence_mode text not null default 'off';
do $$ begin
  alter table companies add constraint companies_geofence_mode_chk check (geofence_mode in ('off','flag','block'));
exception when duplicate_object then null; end $$;

-- One position per punch edge. *_geo: 'ok' | 'outside' | 'missing' (null = not checked).
alter table punches add column if not exists in_lat double precision;
alter table punches add column if not exists in_lng double precision;
alter table punches add column if not exists in_acc integer;
alter table punches add column if not exists in_geo text;
alter table punches add column if not exists in_dist integer;
alter table punches add column if not exists in_location_id uuid references locations(id) on delete set null;
alter table punches add column if not exists out_lat double precision;
alter table punches add column if not exists out_lng double precision;
alter table punches add column if not exists out_acc integer;
alter table punches add column if not exists out_geo text;
alter table punches add column if not exists out_dist integer;
alter table punches add column if not exists out_location_id uuid references locations(id) on delete set null;

-- Great-circle distance in metres.
create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- The signed-in employee's company mode — the app asks before requesting a
-- position, so nothing is collected while the company has it off.
create or replace function public.my_geofence_mode()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(c.geofence_mode, 'off')
  from employees e join companies c on c.id = e.company_id
  where e.user_id = auth.uid()
  limit 1
$$;
grant execute on function public.my_geofence_mode() to authenticated;

create or replace function public.punches_geofence()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mode text;
  loc record;
  tol double precision;
  verdict text;
begin
  -- Verdict columns are never client-writable: keep what was there.
  if tg_op = 'UPDATE' then
    new.in_lat := old.in_lat; new.in_lng := old.in_lng; new.in_acc := old.in_acc;
    new.in_geo := old.in_geo; new.in_dist := old.in_dist; new.in_location_id := old.in_location_id;
    if not (old.clock_out is null and new.clock_out is not null) then
      new.out_lat := old.out_lat; new.out_lng := old.out_lng; new.out_acc := old.out_acc;
      new.out_geo := old.out_geo; new.out_dist := old.out_dist; new.out_location_id := old.out_location_id;
      return new;
    end if;
  else
    new.out_geo := null; new.out_dist := null; new.out_location_id := null;
  end if;

  select geofence_mode into mode from companies where id = new.company_id;
  if coalesce(mode, 'off') = 'off' or new.source <> 'app' then
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
    verdict := case when loc.d - tol > loc.geofence_radius then 'outside' else 'ok' end;
    if verdict = 'outside' and mode = 'block' then
      raise exception 'GEOFENCE_OUTSIDE:%', round(loc.d)::int;
    end if;
    new.in_geo := verdict; new.in_dist := round(loc.d)::int; new.in_location_id := loc.id;
  else
    -- Only the employee's own clock-out is judged; a manager closing a
    -- forgotten punch (or the kiosk) is not "missing location".
    if new.out_lat is null and (select user_id from employees where id = new.employee_id) is distinct from auth.uid() then
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
    new.out_geo := case when loc.d - tol > loc.geofence_radius then 'outside' else 'ok' end;
    new.out_dist := round(loc.d)::int; new.out_location_id := loc.id;
  end if;
  return new;
end $$;

drop trigger if exists punches_geofence on punches;
create trigger punches_geofence before insert or update on punches
  for each row execute function public.punches_geofence();
