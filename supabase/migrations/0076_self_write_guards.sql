-- 0076 — Lokar á að innskráður notandi geti hækkað sig í tign eða breytt eigin launagögnum
-- gegnum API-ið. Run after 0074 (0075 = AI-viðbót).
--
-- Fannst 14. okt. 2026: reglurnar *_self_update hleyptu notanda í ALLA dálka eigin raðar.
--   users:     role og company_id → starfsmaður gat gert sig að eiganda eða fært sig í annað fyrirtæki.
--   employees: rate, pay_type, role, union_agreement … → starfsmaður gat hækkað eigið tímakaup.
--   punches:   clock_in eldri stimplana → starfsmaður gat bætt við tímum aftur í tímann.
--   api_keys:  hver sem var í fyrirtækinu gat breytt lyklum (aðeins stjórnendur eiga að geta það).
-- Allur kóði skrifar í users með service-role; stjórnendur skrifa áfram í employees/punches
-- (is_manager()). Service-role (auth.uid() er null) fer framhjá vörðunum.

-- users: innskráðir notendur skrifa ekki í töfluna sjálfir.
revoke insert, update, delete on table public.users from anon, authenticated;

-- employees: starfsmaður (ekki stjórnandi) má aðeins breyta eigin samskiptaupplýsingum og mynd.
create or replace function public.guard_employee_self_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array['phone', 'email', 'bank_account', 'photo_url', 'address', 'postal_code', 'city', 'next_of_kin', 'updated_at'];
begin
  if auth.uid() is null or public.is_manager() then return new; end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'SELF_UPDATE_FORBIDDEN: aðeins stjórnandi getur breytt þessum upplýsingum' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists employees_self_update_guard on public.employees;
create trigger employees_self_update_guard before update on public.employees
  for each row execute function public.guard_employee_self_update();

-- punches: starfsmaður stimplar inn „núna“ og lokar eigin opinni stimplun — ekkert annað.
-- (Stjórnendur leiðrétta tíma í Tímaskráningu; starfsmaður sendir leiðréttingarbeiðni.)
create or replace function public.guard_punch_self_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- out_geo/out_dist/out_location_id: punches_geofence-triggerinn (0055) fyllir þá við útstimplun.
  allowed text[] := array['clock_out', 'out_lat', 'out_lng', 'out_acc', 'out_geo', 'out_dist', 'out_location_id'];
begin
  if auth.uid() is null or public.is_manager() then return new; end if;
  if tg_op = 'INSERT' then
    if new.clock_out is not null or coalesce(new.approved, false) or abs(extract(epoch from (new.clock_in - now()))) > 900 then
      raise exception 'PUNCH_TIME_FORBIDDEN: stimplun verður að vera núna' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.clock_out is not null
     or (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed)
     or new.clock_out is null or new.clock_out < old.clock_in or new.clock_out > now() + interval '15 minutes' then
    raise exception 'PUNCH_TIME_FORBIDDEN: aðeins hægt að stimpla út úr opinni stimplun' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists punches_self_write_guard on public.punches;
create trigger punches_self_write_guard before insert or update on public.punches
  for each row execute function public.guard_punch_self_write();

-- api_keys: aðeins stjórnendur breyta (afturkalla) lyklum.
drop policy if exists api_keys_update on public.api_keys;
create policy api_keys_update on public.api_keys for update
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());
