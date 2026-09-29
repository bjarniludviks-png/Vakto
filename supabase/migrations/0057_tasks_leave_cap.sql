-- 0057 — verkefni vaktar hert, hámark í fríi á dag, dagatalstengill. Run after 0056.

-- 1) shift_tasks: áður mátti hvaða notandi fyrirtækisins sem er breyta/eyða öllum
--    verkefnum. Nú: stjórnendur búa til/eyða; starfsmaður má aðeins haka við sín eigin.
drop policy if exists shift_tasks_insert on public.shift_tasks;
drop policy if exists shift_tasks_delete on public.shift_tasks;
drop policy if exists shift_tasks_update on public.shift_tasks;

create policy shift_tasks_insert on public.shift_tasks for insert to authenticated
  with check (company_id = auth_company_id() and is_manager());
create policy shift_tasks_delete on public.shift_tasks for delete to authenticated
  using (company_id = auth_company_id() and is_manager());
create policy shift_tasks_update on public.shift_tasks for update to authenticated
  using ((company_id = auth_company_id() and is_manager()) or employee_id = auth_employee_id())
  with check ((company_id = auth_company_id() and is_manager()) or employee_id = auth_employee_id());

-- Starfsmaður (ekki stjórnandi) má aðeins breyta done/done_at — ekki titli, degi eða eiganda.
create or replace function public.shift_tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_manager() then return new; end if;
  if new.title is distinct from old.title or new.date is distinct from old.date
     or new.employee_id is distinct from old.employee_id or new.company_id is distinct from old.company_id then
    raise exception 'TASK_READONLY' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists shift_tasks_guard on public.shift_tasks;
create trigger shift_tasks_guard before update on public.shift_tasks
  for each row execute function public.shift_tasks_guard();

-- 2) Hámark starfsmanna í fríi sama dag (null = ekkert hámark).
alter table public.companies add column if not exists leave_cap int
  check (leave_cap is null or leave_cap >= 1);

-- Beiðni starfsmanns um orlof/ólaunað frí er hafnað ef einhver dagur hennar er þegar
-- fullur (samþykktar + óafgreiddar beiðnir annarra). Veikindi teljast aldrei með og
-- stjórnandi getur alltaf skráð frí sjálfur.
create or replace function public.leave_cap_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int; d date; n int;
begin
  if new.type::text not in ('orlof', 'olaunad') or auth.uid() is null or is_manager() then return new; end if;
  select leave_cap into cap from companies where id = new.company_id;
  if cap is null then return new; end if;
  for d in select generate_series(new.from_date, new.to_date, interval '1 day')::date loop
    select count(distinct employee_id) into n from leave_requests
     where company_id = new.company_id and employee_id <> new.employee_id
       and type::text in ('orlof', 'olaunad') and status::text in ('approved', 'pending')
       and d between from_date and to_date;
    if n >= cap then
      raise exception 'LEAVE_CAP:%', to_char(d, 'YYYY-MM-DD') using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists leave_cap_check on public.leave_requests;
create trigger leave_cap_check before insert on public.leave_requests
  for each row execute function public.leave_cap_check();

revoke execute on function public.shift_tasks_guard() from public, anon, authenticated;
revoke execute on function public.leave_cap_check() from public, anon, authenticated;

-- 3) Leynitengill fyrir vaktir í dagatali símans (ICS). Hver starfsmaður fær sinn;
--    endurnýjun = nýtt gildi (gamli tengillinn hættir að virka).
alter table public.employees add column if not exists calendar_token uuid unique default gen_random_uuid();

-- 4) „Mætti ekki“ viðvaranir — ein per starfsmann/dag/upphafstíma svo endurbirting
--    plans (sem skiptir út shifts-röðum) sendi ekki sömu viðvörun aftur.
--    Aðeins þjónustulykill (service role) skrifar/les; RLS án reglna = lokað öðrum.
create table if not exists public.noshow_alerts (
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  start_time time not null,
  created_at timestamptz not null default now(),
  primary key (employee_id, date, start_time)
);
alter table public.noshow_alerts enable row level security;
