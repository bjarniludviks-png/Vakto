-- 0099 — „Á vakt núna“ og „virk(ur)“ í spjalli + léttur prófíll samstarfsmanns. Run after 0098.
--
-- Persónuvernd: aðeins GRÓF virkni („núna“, „í dag“, „í gær“, „fyrir N dögum“) — aldrei nákvæmur tími.
-- Hver starfsmaður ræður: show_presence (sjálfgefið á) — sá sem slekkur sér ekki virkni annarra heldur (gagnkvæmt).
-- show_phone (sjálfgefið á) ræður hvort samstarfsfólk sér símanúmerið (coworkers-sýnin).

alter table public.employees add column if not exists last_active_at timestamptz;
alter table public.employees add column if not exists show_presence boolean not null default true;
alter table public.employees add column if not exists show_phone boolean not null default true;

-- Starfsmaður má sjálfur breyta show_presence og show_phone (auk tengiliðareita úr 0076).
-- last_active_at er aðeins skrifað með touch_presence() hér að neðan.
create or replace function public.guard_employee_self_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array['phone', 'email', 'bank_account', 'photo_url', 'address', 'postal_code', 'city', 'next_of_kin', 'updated_at', 'show_presence', 'show_phone'];
begin
  if auth.uid() is null or public.is_manager() then return new; end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'SELF_UPDATE_FORBIDDEN: aðeins stjórnandi getur breytt þessum upplýsingum' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_employee_self_update() from public, anon, authenticated;

-- Samstarfsfólk sér símanúmer aðeins ef viðkomandi leyfir það. (Sömu dálkar og röð og í 0069.)
create or replace view public.coworkers
with (security_invoker = off, security_barrier = true) as
  select
    e.id, e.user_id, e.company_id, e.location_id, e.department_id, e.position_id,
    e.full_name, e.title, case when e.show_phone then e.phone end as phone, e.email, e.photo_url, e.avatar_color, e.role, e.status
  from public.employees e
  where e.company_id = public.auth_company_id();
revoke all on public.coworkers from anon, public;
grant select on public.coworkers to authenticated;

-- Innskráður notandi merkir sig virkan (vefur/app, mest á 2 mín. fresti). Engin saga — aðeins síðasti tími.
create or replace function public.touch_presence() returns void
language sql security definer set search_path = public as $$
  update public.employees set last_active_at = now()
  where user_id = auth.uid() and (last_active_at is null or last_active_at < now() - interval '2 minutes');
$$;
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- Staða samstarfsfólks eftir user_id (spjallið er eftir notendum): virkni (gróf), á vakt núna, næsta vakt.
--   active: 'now' (< 5 mín), 'today', 'yesterday', 'days:N' (2–6), annars null — aðeins ef BÆÐI leyfa.
--   on_shift: opin stimplun síðustu 16 klst. eða birt vakt sem stendur yfir núna; shift_end = lok vaktarinnar.
--   next_start: upphaf næstu birtu vaktar á næstu 7 dögum (dagsetning + tími, Ísland = UTC).
create or replace function public.coworker_status(p_user_ids uuid[])
returns table (user_id uuid, employee_id uuid, active text, on_shift boolean, shift_end time, next_start timestamp)
language sql stable security definer set search_path = public as $$
  with me as (
    select coalesce((select e.show_presence from public.employees e where e.user_id = auth.uid() and e.company_id = public.auth_company_id() limit 1), true) as show
  ),
  emp as (
    select e.id, e.user_id, e.show_presence, e.last_active_at
    from public.employees e
    where e.company_id = public.auth_company_id() and e.user_id = any(p_user_ids)
  )
  select
    emp.user_id,
    emp.id,
    case
      when not emp.show_presence or not (select show from me) or emp.last_active_at is null then null
      when emp.last_active_at > now() - interval '5 minutes' then 'now'
      when emp.last_active_at::date = current_date then 'today'
      when emp.last_active_at::date = current_date - 1 then 'yesterday'
      when emp.last_active_at::date > current_date - 7 then 'days:' || (current_date - emp.last_active_at::date)
      else null
    end,
    (exists (select 1 from public.punches p where p.employee_id = emp.id and p.clock_out is null and p.clock_in > now() - interval '16 hours')
      or exists (select 1 from public.shifts s where s.employee_id = emp.id and s.published and s.date = current_date
                 and s.start_time <= localtime and (s.end_time > localtime or s.end_time <= s.start_time))),
    (select s.end_time from public.shifts s where s.employee_id = emp.id and s.published and s.date = current_date
       and s.start_time <= localtime and (s.end_time > localtime or s.end_time <= s.start_time) limit 1),
    (select min(s.date + s.start_time) from public.shifts s where s.employee_id = emp.id and s.published
       and (s.date + s.start_time) > localtimestamp and s.date <= current_date + 7)
  from emp;
$$;
revoke all on function public.coworker_status(uuid[]) from public, anon;
grant execute on function public.coworker_status(uuid[]) to authenticated;
