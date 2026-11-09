-- 0111 — Hlutverk, ábyrgð, verkefnalistar, ábyrgðarfærslur og frávik. Run after 0110.
--
-- Hugmyndin (sjá frumgerð „VAKTO Verkefni og ábyrgð“):
--   • Skipurit: employees.reports_to (hver er yfirmaður hvers).
--   • Hlutverk (work_roles) eru sjálfstæð — ekki deild eða vaktategund — en MÁ tengja við vaktategund:
--     þá fær hver sem er á þannig vakt hlutverkið þann dag („Lokun“ → sá sem er á lokunarvakt).
--   • Föst hlutverk á fólki (employee_work_roles), hvert með varamanni (backup = true).
--     Ef handhafi er í samþykktu fríi/veikindum tekur varamaðurinn sjálfkrafa við.
--   • Ábyrgðarfærsla (role_handovers): færa eitt hlutverk eða ALLAR ábyrgðir manneskju til hvers sem er,
--     í dag / út vikuna / til dags / þar til skilað — óháð vöktum og án veikindaskráningar.
--   • Listar (task_lists + task_list_items) endurtaka sig eftir vikudögum eða degi mánaðar og fara á
--     hlutverk, manneskju eða alla á vakt. Sameiginlegur listi = eitt hak fyrir alla; annars hver fyrir sig.
--   • Hök (task_checks) eru skráð per dag. Stök verkefni = shift_tasks (0030), nú líka á hlutverk eða
--     „hvern sem er á vakt“ (employee_id tómt), með tíma, mynd og athugasemd.
--   • Frávik (incidents): starfsmaður skráir, stjórnendur sjá og loka.
--
-- Allur útreikningur á „hver á að gera hvað í dag“ er í SQL (_role_holders / _tasks_for) svo vefur og app
-- sýni alltaf það sama. Starfsfólk hakar AÐEINS gegnum tick_task() sem athugar að verkefnið sé þeirra.

-- ---------- Skipurit ----------
alter table public.employees add column if not exists reports_to uuid references public.employees(id) on delete set null;
create index if not exists employees_reports_to_idx on public.employees(reports_to);

-- ---------- Hlutverk ----------
create table if not exists public.work_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  description text check (description is null or length(description) <= 400),
  responsibilities text[] not null default '{}',
  color text,
  shift_type_id uuid references public.shift_types(id) on delete set null,   -- valfrjáls tenging
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists work_roles_company_idx on public.work_roles(company_id);

create table if not exists public.employee_work_roles (
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_id uuid not null references public.work_roles(id) on delete cascade,
  backup boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (employee_id, role_id)
);
create index if not exists employee_work_roles_role_idx on public.employee_work_roles(role_id);

-- ---------- Ábyrgðarfærslur ----------
create table if not exists public.role_handovers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  from_employee_id uuid not null references public.employees(id) on delete cascade,
  to_employee_id uuid not null references public.employees(id) on delete cascade,
  role_id uuid references public.work_roles(id) on delete cascade,              -- tómt = allar ábyrgðir
  start_date date not null default current_date,
  end_date date,                                                                 -- tómt = þar til skilað
  note text check (note is null or length(note) <= 500),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  returned_at timestamptz,
  check (from_employee_id <> to_employee_id),
  check (end_date is null or end_date >= start_date)
);
create index if not exists role_handovers_company_idx on public.role_handovers(company_id, start_date);

-- ---------- Listar ----------
create table if not exists public.task_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  category text not null default 'annad' check (category in ('opnun', 'lokun', 'thrif', 'vikulegt', 'manadarlegt', 'annad')),
  target text not null check (target in ('role', 'employee', 'everyone')),
  role_id uuid references public.work_roles(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,          -- tómt = allir staðir
  shared boolean not null default true,
  weekdays smallint[],                                                           -- ISO 1=mán … 7=sun; tómt = hvern dag
  month_day smallint check (month_day is null or month_day = -1 or month_day between 1 and 31),
  due_time time,
  remind boolean not null default true,
  escalate boolean not null default true,
  active boolean not null default true,
  sort int not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((target = 'role') = (role_id is not null)),
  check ((target = 'employee') = (employee_id is not null))
);
create index if not exists task_lists_company_idx on public.task_lists(company_id);

create table if not exists public.task_list_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  list_id uuid not null references public.task_lists(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  needs_photo boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_list_items_list_idx on public.task_list_items(list_id);

create table if not exists public.task_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  list_id uuid not null references public.task_lists(id) on delete cascade,
  item_id uuid not null references public.task_list_items(id) on delete cascade,
  date date not null,
  owner_employee_id uuid references public.employees(id) on delete cascade,     -- tómt = sameiginlegur listi
  done_by uuid references public.employees(id) on delete set null,
  done_at timestamptz not null default now(),
  photo_url text,
  note text check (note is null or length(note) <= 500)
);
create unique index if not exists task_checks_one
  on public.task_checks(item_id, date, coalesce(owner_employee_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists task_checks_day_idx on public.task_checks(company_id, date);

-- ---------- Stök verkefni (shift_tasks víkkað) ----------
alter table public.shift_tasks alter column employee_id drop not null;
alter table public.shift_tasks add column if not exists role_id uuid references public.work_roles(id) on delete set null;
alter table public.shift_tasks add column if not exists due_time time;
alter table public.shift_tasks add column if not exists created_by uuid references public.users(id) on delete set null;
alter table public.shift_tasks add column if not exists done_by uuid references public.employees(id) on delete set null;
alter table public.shift_tasks add column if not exists needs_photo boolean not null default false;
alter table public.shift_tasks add column if not exists photo_url text;
alter table public.shift_tasks add column if not exists note text;

-- Starfsmaður má áfram aðeins haka (nú líka hver hakaði, mynd og athugasemd).
create or replace function public.guard_shift_task_self_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare allowed text[] := array['done', 'done_at', 'done_by', 'photo_url', 'note'];
begin
  if auth.uid() is null or public.is_manager() then return new; end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'SELF_UPDATE_FORBIDDEN: aðeins hægt að haka við verkefni' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_shift_task_self_update() from public, anon, authenticated;

-- ---------- Frávik ----------
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,          -- sá sem skráði
  date date not null default current_date,
  category text not null default 'annad' check (category in ('hitastig', 'vara', 'bilun', 'atvik', 'verkefni', 'annad')),
  title text not null check (length(btrim(title)) between 1 and 200),
  note text check (note is null or length(note) <= 2000),
  photo_url text,
  task_ref text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists incidents_company_idx on public.incidents(company_id, created_at desc);

-- ---------- RLS ----------
alter table public.work_roles enable row level security;
alter table public.employee_work_roles enable row level security;
alter table public.role_handovers enable row level security;
alter table public.task_lists enable row level security;
alter table public.task_list_items enable row level security;
alter table public.task_checks enable row level security;
alter table public.incidents enable row level security;

-- Lesa: allir í fyrirtækinu (starfsfólk á að sjá hlutverk, varamenn og lista). Skrifa: stjórnendur.
do $$
declare t text;
begin
  foreach t in array array['work_roles', 'employee_work_roles', 'task_lists', 'task_list_items'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (company_id = public.auth_company_id())', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated
      using (company_id = public.auth_company_id() and public.is_manager())
      with check (company_id = public.auth_company_id() and public.is_manager())', t);
  end loop;
end $$;

-- Hök: allir lesa, enginn skrifar beint (aðeins tick_task()).
drop policy if exists task_checks_select on public.task_checks;
create policy task_checks_select on public.task_checks for select to authenticated
  using (company_id = public.auth_company_id());

-- Færslur: allir lesa; stjórnandi færir hvað sem er, starfsmaður aðeins sínar eigin ábyrgðir.
drop policy if exists role_handovers_select on public.role_handovers;
create policy role_handovers_select on public.role_handovers for select to authenticated
  using (company_id = public.auth_company_id());
drop policy if exists role_handovers_insert on public.role_handovers;
create policy role_handovers_insert on public.role_handovers for insert to authenticated
  with check (company_id = public.auth_company_id()
              and (public.is_manager() or from_employee_id = public.auth_employee_id()));
drop policy if exists role_handovers_update on public.role_handovers;
create policy role_handovers_update on public.role_handovers for update to authenticated
  using (company_id = public.auth_company_id()
         and (public.is_manager() or from_employee_id = public.auth_employee_id()))
  with check (company_id = public.auth_company_id()
              and (public.is_manager() or from_employee_id = public.auth_employee_id()));
drop policy if exists role_handovers_delete on public.role_handovers;
create policy role_handovers_delete on public.role_handovers for delete to authenticated
  using (company_id = public.auth_company_id() and public.is_manager());

-- Frávik: starfsmaður skráir og sér sín; stjórnendur sjá öll og loka.
drop policy if exists incidents_select on public.incidents;
create policy incidents_select on public.incidents for select to authenticated
  using (company_id = public.auth_company_id() and (public.is_manager() or employee_id = public.auth_employee_id()));
drop policy if exists incidents_insert on public.incidents;
create policy incidents_insert on public.incidents for insert to authenticated
  with check (company_id = public.auth_company_id()
              and (public.is_manager() or employee_id = public.auth_employee_id()));
drop policy if exists incidents_update on public.incidents;
create policy incidents_update on public.incidents for update to authenticated
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());

-- ---------- Útreikningur ----------

-- Hver heldur hvaða hlutverki á degi: fast / vara (handhafi í fríi) / faert (ábyrgðarfærsla) / vakt (tengd vaktategund).
create or replace function public._role_holders(p_company uuid, p_date date)
returns table(role_id uuid, employee_id uuid, via text, from_employee_id uuid)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  with away as (
    select distinct lr.employee_id as eid from leave_requests lr
     where lr.company_id = p_company and lr.status = 'approved' and p_date between lr.from_date and lr.to_date
  ), ho as (
    select h.* from role_handovers h
     where h.company_id = p_company and h.returned_at is null
       and p_date >= h.start_date and (h.end_date is null or p_date <= h.end_date)
  ), prim as (
    select w.role_id as rid, w.employee_id as eid,
      (select h.to_employee_id from ho h
        where h.from_employee_id = w.employee_id and (h.role_id is null or h.role_id = w.role_id)
        order by h.role_id nulls last, h.created_at desc limit 1) as to_emp,
      exists (select 1 from away a where a.eid = w.employee_id) as is_away
    from employee_work_roles w where w.company_id = p_company and not w.backup
  )
  select p.rid, p.eid, 'fast'::text, null::uuid from prim p where p.to_emp is null and not p.is_away
  union
  select p.rid, p.to_emp, 'faert'::text, p.eid from prim p where p.to_emp is not null
  union
  select p.rid, b.employee_id, 'vara'::text, p.eid from prim p
    join employee_work_roles b on b.role_id = p.rid and b.backup
   where p.to_emp is null and p.is_away and not exists (select 1 from away a where a.eid = b.employee_id)
  union
  select r.id, s.employee_id, 'vakt'::text, null::uuid from work_roles r
    join shifts s on s.shift_type_id = r.shift_type_id and s.company_id = p_company and s.date = p_date and s.published
   where r.company_id = p_company and r.shift_type_id is not null and s.employee_id is not null;
end $$;

-- Hver er með ALLAR ábyrgðir manneskju á degi (færsla án hlutverks), annars hún sjálf.
create or replace function public._handed_to(p_company uuid, p_emp uuid, p_date date)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((
    select h.to_employee_id from role_handovers h
     where h.company_id = p_company and h.from_employee_id = p_emp and h.role_id is null and h.returned_at is null
       and p_date >= h.start_date and (h.end_date is null or p_date <= h.end_date)
     order by h.created_at desc limit 1), p_emp);
$$;

-- Á listinn við þennan dag (vikudagur / dagur mánaðar)?
create or replace function public._list_on(p_weekdays smallint[], p_month_day smallint, p_date date)
returns boolean language sql immutable set search_path = public as $$
  select (p_weekdays is null or cardinality(p_weekdays) = 0 or extract(isodow from p_date)::smallint = any(p_weekdays))
     and (p_month_day is null
          or p_month_day = extract(day from p_date)::smallint
          or (p_month_day = -1 and p_date = (date_trunc('month', p_date) + interval '1 month - 1 day')::date));
$$;

-- Allt sem ein manneskja á að gera á degi: hlutverk, listar (með hökum) og stök verkefni.
create or replace function public._tasks_for(p_company uuid, p_emp uuid, p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_on_shift boolean;
  v_locs uuid[];
  v_roles jsonb;
  v_role_ids uuid[];
  v_lists jsonb;
  v_adhoc jsonb;
  v_boss jsonb;
begin
  select count(*) > 0, coalesce(array_remove(array_agg(distinct s.location_id), null), '{}')
    into v_on_shift, v_locs
    from shifts s where s.company_id = p_company and s.employee_id = p_emp and s.date = p_date and s.published;

  with h as (
    select distinct on (rh.role_id) rh.role_id, rh.via, rh.from_employee_id
      from public._role_holders(p_company, p_date) rh where rh.employee_id = p_emp
     order by rh.role_id, case rh.via when 'fast' then 0 when 'vakt' then 1 when 'faert' then 2 else 3 end
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'name', r.name, 'color', r.color, 'responsibilities', to_jsonb(r.responsibilities),
           'via', h.via, 'from_id', h.from_employee_id, 'from_name', fe.full_name) order by r.sort, r.name), '[]'::jsonb),
         coalesce(array_agg(r.id), '{}')
    into v_roles, v_role_ids
    from h join work_roles r on r.id = h.role_id
    left join employees fe on fe.id = h.from_employee_id;

  select coalesce(jsonb_agg(x.j order by x.due nulls last, x.sort, x.name), '[]'::jsonb) into v_lists from (
    select l.due_time as due, l.sort, l.name, jsonb_build_object(
      'id', l.id, 'name', l.name, 'category', l.category, 'shared', l.shared, 'target', l.target,
      'due_time', to_char(l.due_time, 'HH24:MI'), 'role_id', l.role_id, 'role_name', r.name,
      'from_name', case when l.target = 'employee' and l.employee_id <> p_emp then oe.full_name end,
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'needs_photo', i.needs_photo,
          'done', c.id is not null, 'done_at', c.done_at, 'done_by_name', de.full_name, 'photo_url', c.photo_url, 'note', c.note
        ) order by i.sort, i.created_at), '[]'::jsonb)
        from task_list_items i
        left join task_checks c on c.item_id = i.id and c.date = p_date
             and c.owner_employee_id is not distinct from (case when l.shared then null else p_emp end)
        left join employees de on de.id = c.done_by
        where i.list_id = l.id)
    ) as j
    from task_lists l
    left join work_roles r on r.id = l.role_id
    left join employees oe on oe.id = l.employee_id
    where l.company_id = p_company and l.active and public._list_on(l.weekdays, l.month_day, p_date)
      and (  (l.target = 'employee' and public._handed_to(p_company, l.employee_id, p_date) = p_emp)
          or (l.target = 'role' and l.role_id = any(v_role_ids))
          or (l.target = 'everyone' and v_on_shift and (l.location_id is null or l.location_id = any(v_locs))))
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'due_time', to_char(t.due_time, 'HH24:MI'), 'done', t.done, 'done_at', t.done_at,
      'done_by_name', de.full_name, 'needs_photo', t.needs_photo, 'photo_url', t.photo_url, 'note', t.note,
      'shared', t.employee_id is null, 'role_name', r.name,
      'from_name', case when t.employee_id is not null and t.employee_id <> p_emp then oe.full_name end,
      'created_by_name', cu.full_name
    ) order by t.due_time nulls last, t.created_at), '[]'::jsonb) into v_adhoc
    from shift_tasks t
    left join work_roles r on r.id = t.role_id
    left join employees oe on oe.id = t.employee_id
    left join employees de on de.id = t.done_by
    left join users cu on cu.id = t.created_by
   where t.company_id = p_company and t.date = p_date
     and (  (t.employee_id is not null and public._handed_to(p_company, t.employee_id, p_date) = p_emp)
         or (t.employee_id is null and t.role_id is not null and t.role_id = any(v_role_ids))
         or (t.employee_id is null and t.role_id is null and v_on_shift));

  select jsonb_build_object('id', b.id, 'name', b.full_name) into v_boss
    from employees e join employees b on b.id = e.reports_to where e.id = p_emp;

  return jsonb_build_object('date', p_date, 'employee_id', p_emp, 'on_shift', v_on_shift,
    'roles', v_roles, 'lists', v_lists, 'adhoc', v_adhoc, 'boss', v_boss);
end $$;

revoke all on function public._role_holders(uuid, date) from public, anon, authenticated;
revoke all on function public._handed_to(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public._tasks_for(uuid, uuid, date) from public, anon, authenticated;

-- Verkefni dagsins fyrir mig (eða annan starfsmann ef ég er stjórnandi).
create or replace function public.tasks_day(p_date date default current_date, p_employee uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := public.auth_company_id(); v_me uuid := public.auth_employee_id(); v_emp uuid;
begin
  if v_company is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  v_emp := coalesce(p_employee, v_me);
  if v_emp is null then return null; end if;
  if v_emp is distinct from v_me and not public.is_manager() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from employees where id = v_emp and company_id = v_company) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return public._tasks_for(v_company, v_emp, p_date);
end $$;

-- Staða dagsins hjá öllum (stjórnendur): aðeins fólk sem á eitthvað að gera eða er á vakt.
create or replace function public.tasks_board(p_date date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := public.auth_company_id(); e record; d jsonb; out jsonb := '[]'::jsonb;
begin
  if v_company is null or not public.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  for e in select id, full_name, avatar_color, photo_url, reports_to from employees
            where company_id = v_company and status <> 'inactive' order by full_name loop
    d := public._tasks_for(v_company, e.id, p_date);
    if (d->>'on_shift')::boolean or jsonb_array_length(d->'lists') > 0 or jsonb_array_length(d->'adhoc') > 0 then
      out := out || jsonb_build_array(d || jsonb_build_object('name', e.full_name, 'color', e.avatar_color,
                                                             'photo_url', e.photo_url, 'reports_to', e.reports_to));
    end if;
  end loop;
  return out;
end $$;

-- Hlutfall kláraðra verkefna hjá liðinu (Vel gert-skjárinn). Sameiginleg atriði teljast einu sinni.
create or replace function public.tasks_team_progress(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := public.auth_company_id(); dd date; e record; d jsonb; l jsonb; i jsonb; a jsonb;
        seen text[] := '{}'; k text; n_done int := 0; n_all int := 0;
begin
  if v_company is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > 31 then raise exception 'RANGE' using errcode = '22023'; end if;
  dd := p_from;
  while dd <= p_to loop
    for e in select id from employees where company_id = v_company and status <> 'inactive' loop
      d := public._tasks_for(v_company, e.id, dd);
      for l in select * from jsonb_array_elements(d->'lists') loop
        for i in select * from jsonb_array_elements(l->'items') loop
          k := (i->>'id') || dd::text || case when (l->>'shared')::boolean then '' else e.id::text end;
          if not k = any(seen) then seen := seen || k; n_all := n_all + 1; if (i->>'done')::boolean then n_done := n_done + 1; end if; end if;
        end loop;
      end loop;
      for a in select * from jsonb_array_elements(d->'adhoc') loop
        k := 'a' || (a->>'id');
        if not k = any(seen) then seen := seen || k; n_all := n_all + 1; if (a->>'done')::boolean then n_done := n_done + 1; end if; end if;
      end loop;
    end loop;
    dd := dd + 1;
  end loop;
  return jsonb_build_object('done', n_done, 'total', n_all);
end $$;

-- Haka við / afhaka. Starfsmaður aðeins það sem er hans í dag; stjórnandi hvað sem er í fyrirtækinu.
-- p_kind: 'item' (atriði á lista) eða 'adhoc' (stakt verkefni). p_owner: fyrir hvern (persónulegur listi, stjórnandi).
create or replace function public.tick_task(p_kind text, p_id uuid, p_date date, p_done boolean,
                                            p_photo text default null, p_note text default null, p_owner uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_company uuid := public.auth_company_id(); v_me uuid := public.auth_employee_id(); v_mgr boolean := public.is_manager();
        v_list task_lists; v_item task_list_items; v_task shift_tasks; v_owner uuid; v_mine jsonb; v_ok boolean;
begin
  if v_company is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_note is not null and length(p_note) > 500 then raise exception 'NOTE_TOO_LONG' using errcode = '22023'; end if;
  if p_photo is not null and p_photo !~ '^https://' then raise exception 'BAD_PHOTO' using errcode = '22023'; end if;
  if v_me is not null then v_mine := public._tasks_for(v_company, v_me, p_date); end if;

  if p_kind = 'item' then
    select * into v_item from task_list_items where id = p_id and company_id = v_company;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    select * into v_list from task_lists where id = v_item.list_id;
    v_ok := v_mine is not null and exists (select 1 from jsonb_array_elements(v_mine->'lists') x where x->>'id' = v_list.id::text);
    if not v_ok and not v_mgr then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
    v_owner := case when v_list.shared then null when v_ok and p_owner is null then v_me else p_owner end;
    if not v_list.shared and v_owner is null then raise exception 'OWNER_REQUIRED' using errcode = '22023'; end if;
    if p_done then
      insert into task_checks (company_id, list_id, item_id, date, owner_employee_id, done_by, photo_url, note)
      values (v_company, v_list.id, v_item.id, p_date, v_owner, v_me, p_photo, p_note)
      on conflict (item_id, date, coalesce(owner_employee_id, '00000000-0000-0000-0000-000000000000'::uuid))
      do update set done_by = excluded.done_by, done_at = now(),
                    photo_url = coalesce(excluded.photo_url, task_checks.photo_url), note = coalesce(excluded.note, task_checks.note);
    else
      delete from task_checks where item_id = v_item.id and date = p_date and owner_employee_id is not distinct from v_owner;
    end if;
  elsif p_kind = 'adhoc' then
    select * into v_task from shift_tasks where id = p_id and company_id = v_company;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    v_ok := v_mine is not null and exists (select 1 from jsonb_array_elements(v_mine->'adhoc') x where x->>'id' = v_task.id::text);
    if not v_ok and not v_mgr then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
    update shift_tasks set done = p_done, done_at = case when p_done then now() end, done_by = case when p_done then v_me end,
           photo_url = case when p_done then coalesce(p_photo, photo_url) end,
           note = case when p_done then coalesce(p_note, note) else note end
     where id = v_task.id;
  else
    raise exception 'BAD_KIND' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.tasks_day(date, uuid) from public, anon;
revoke all on function public.tasks_board(date) from public, anon;
revoke all on function public.tasks_team_progress(date, date) from public, anon;
revoke all on function public.tick_task(text, uuid, date, boolean, text, text, uuid) from public, anon;
grant execute on function public.tasks_day(date, uuid) to authenticated;
grant execute on function public.tasks_board(date) to authenticated;
grant execute on function public.tasks_team_progress(date, date) to authenticated;
grant execute on function public.tick_task(text, uuid, date, boolean, text, text, uuid) to authenticated;
