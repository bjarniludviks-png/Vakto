-- 0109 — Hver vakt veit á hvaða stað hún er. Run after 0108.
--
-- Vandinn: shifts.location_id var til frá upphafi en var aldrei fyllt út. Fyrirtæki með fleiri staði
-- (Pizzan: 11 staðir, ~44 manns á fleiri en einum) gátu því ekki séð plan eða launakostnað per stað —
-- vaktir starfsmanns birtust á öllum stöðum hans og kostnaðurinn taldist tvisvar.
--
-- Nú:
--  • Ný vakt án staðar fær stað starfsmannsins (aðaldeild → staður hennar, annars employees.location_id).
--    Gildir um ALLAR leiðir (vefur, app, AI, afritun, starfslok) því trigger sér um það.
--  • Vaktaplanið sendir staðinn sjálft þegar valinn er einn staður (vakt í Lóuhólum hjá Núpalindar-manni).
--  • Staður verður að tilheyra sama fyrirtæki og vaktin.
--  • Eldri vaktir fá stað starfsmannsins (einu sinni).

create or replace function public.shift_default_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.location_id is null and new.employee_id is not null then
    select coalesce(d.location_id, e.location_id) into new.location_id
      from employees e left join departments d on d.id = e.department_id
     where e.id = new.employee_id;
  end if;
  if new.location_id is not null and not exists (
    select 1 from locations l where l.id = new.location_id and l.company_id = new.company_id
  ) then
    raise exception 'Staður tilheyrir ekki fyrirtækinu';
  end if;
  return new;
end $$;
revoke all on function public.shift_default_location() from public, anon, authenticated;

drop trigger if exists shifts_default_location on public.shifts;
create trigger shifts_default_location before insert or update of location_id on public.shifts
  for each row execute function public.shift_default_location();

create index if not exists shifts_location_date_idx on public.shifts(location_id, date);

update public.shifts s
   set location_id = coalesce(d.location_id, e.location_id)
  from public.employees e
  left join public.departments d on d.id = e.department_id
 where s.employee_id = e.id and s.location_id is null
   and coalesce(d.location_id, e.location_id) is not null;
