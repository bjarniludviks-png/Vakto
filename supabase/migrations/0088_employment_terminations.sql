-- 0088 — Starfslok / Ljúka ráðningu. Run after 0087.
--
-- VAKTO skráir það sem vinnuveitandinn velur (ekki lögfræðiráðgjöf):
--   * employment_terminations: ein virk færsla per starfsmann (revoked_at null). Eigendur og
--     vaktstjórar fyrirtækisins lesa/skrifa (RLS). Starfsmaðurinn les EKKI töfluna beint (innri
--     athugasemd); hann fær aðeins sína reiti gegnum my_termination() (security definer).
--   * employees.end_date: síðasti starfsdagur — launakeyrsla, laun % og skýrslur telja starfsmanninn
--     með til og með þeim degi (sagan helst; ekkert er eytt).
--   * Aðgangur eftir starfslok: auth_offboard_state() = 'active' | 'readonly' | 'closed'.
--       readonly: eftir síðasta dag, til og með access_until → má aðeins LESA eigin skjöl, samninga
--                 og grunnupplýsingar; engin skrif í neina töflu né Storage.
--       closed:   eftir access_until → ekkert lesið (auk þess bannar /api/cron/starfslok innskráningu).
--     Framfylgt í grunninum með RESTRICTIVE-reglum (sama mynstur og demo í 0087), ekki bara falið í viðmóti.
--   * apply_demo_readonly() er endurskilgreint svo það bæti líka við starfsloka-reglunum — síðari
--     migrations sem keyra `select public.apply_demo_readonly();` fá báðar varnirnar á nýjar töflur.
--
-- Örugg endurkeyrsla.

alter table public.employees add column if not exists end_date date;
-- auth_offboard_state() keyrir í hverri fyrirspurn (RLS) og leitar eftir employees.user_id.
create index if not exists employees_user_id_idx on public.employees(user_id);

create table if not exists public.employment_terminations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  reason text not null check (reason in ('employee_resigned', 'employer_terminated', 'mutual', 'fixed_term_end', 'summary_dismissal', 'other')),
  notice_date date not null,
  notice_value integer not null default 0 check (notice_value >= 0 and notice_value <= 60),
  notice_unit text not null default 'none' check (notice_unit in ('none', 'days', 'weeks', 'months')),
  last_day date not null,
  garden_leave boolean not null default false,          -- laus undan vinnuskyldu
  garden_leave_from date,
  note text,                                            -- innri athugasemd (aðeins stjórnendur)
  document_mode text not null default 'none' check (document_mode in ('sign', 'send', 'upload', 'none')),
  document_id uuid references public.documents(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,   -- bréf í undirritunarferli
  shift_action text not null default 'keep' check (shift_action in ('keep', 'unassign', 'delete')),
  shifts_affected jsonb,                                -- afrit af vöktum sem voru teknar (til að afturkalla)
  payroll_reminder boolean not null default true,       -- lokauppgjör launa og orlofs
  settled_at timestamptz,
  settled_by uuid references public.users(id) on delete set null,
  deactivate boolean not null default true,             -- óvirkja eftir síðasta dag (cron)
  deactivated_at timestamptz,
  prior_role text,                                      -- hlutverk notanda áður en það var lækkað eftir síðasta dag
  access_months integer not null default 12 check (access_months in (0, 3, 12, 24)),
  access_until date not null,
  access_closed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  check (last_day >= notice_date),
  check (access_until >= last_day)
);

create unique index if not exists employment_terminations_active_uq
  on public.employment_terminations(employee_id) where revoked_at is null;
create index if not exists employment_terminations_company_idx
  on public.employment_terminations(company_id, last_day);

alter table public.employment_terminations enable row level security;

drop policy if exists terminations_manager on public.employment_terminations;
create policy terminations_manager on public.employment_terminations for all to authenticated
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());
-- Engin regla fyrir starfsmanninn sjálfan: hann les sína reiti gegnum my_termination().

-- ---------- Það sem starfsmaðurinn má sjá (ekki innri athugasemd) ----------
create or replace function public.my_termination()
returns table (reason text, notice_date date, last_day date, garden_leave boolean, access_until date, document_id uuid, contract_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select t.reason, t.notice_date, t.last_day, t.garden_leave, t.access_until, t.document_id, t.contract_id
  from public.employment_terminations t
  where t.employee_id = public.auth_employee_id() and t.revoked_at is null
  order by t.created_at desc
  limit 1;
$$;
revoke all on function public.my_termination() from public, anon;
grant execute on function public.my_termination() to authenticated;

-- ---------- Aðgangsstaða innskráðs notanda ----------
-- Eigandi fyrirtækis er aldrei lokaður úti af þessu. Dagsetningar miðast við íslenskan tíma (UTC).
create or replace function public.auth_offboard_state()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when t.last_day >= (now() at time zone 'Atlantic/Reykjavik')::date then 'active'
      when t.access_until >= (now() at time zone 'Atlantic/Reykjavik')::date then 'readonly'
      else 'closed'
    end
    from public.employment_terminations t
    join public.employees e on e.id = t.employee_id
    join public.users u on u.id = e.user_id and u.company_id = e.company_id
    where e.user_id = auth.uid() and t.revoked_at is null and u.role <> 'owner'
    order by t.last_day desc
    limit 1
  ), 'active');
$$;
revoke all on function public.auth_offboard_state() from public, anon;
grant execute on function public.auth_offboard_state() to authenticated, service_role;

create or replace function public.auth_is_offboarded()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_offboard_state() <> 'active';
$$;
revoke all on function public.auth_is_offboarded() from public, anon;
grant execute on function public.auth_is_offboarded() to authenticated, service_role;

-- Fyrir innskráningu/app: staða + dagsetningar (engin innri gögn).
create or replace function public.my_access_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'state', public.auth_offboard_state(),
    'last_day', (select last_day from public.my_termination()),
    'access_until', (select access_until from public.my_termination())
  );
$$;
revoke all on function public.my_access_state() from public, anon;
grant execute on function public.my_access_state() to authenticated;

-- Gikkur (einu sinni per setningu): grípur líka skrif sem fara framhjá RLS innan SECURITY DEFINER-falla
-- (t.d. respond_work_overview, approve_shift_claim) — sama mynstur og demo_readonly_guard (0087).
-- Þjónninn (þjónustulykill, auth.uid() null) er undanþeginn, t.d. rafræn undirritun starfslokabréfs.
create or replace function public.offboarded_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and public.auth_is_offboarded() then
    raise exception using
      errcode = '42501',
      message = 'Ráðningu þinni er lokið — aðgangurinn er aðeins til að skoða eigin skjöl.';
  end if;
  return null;
end;
$$;

-- ---------- Varnir: demo (0087) + starfslok, á allar RLS-töflur ----------
-- Töflur sem fyrrverandi starfsmaður má enn LESA á lesaðgangstímanum (eigin gögn takmarkast af
-- venjulegu reglunum): skjöl, samningar, undirskriftir og grunnupplýsingar sem skjárinn þarf.
create or replace function public.apply_demo_readonly()
returns integer
language plpgsql
set search_path = public
as $$
declare
  t record;
  n integer := 0;
  exempt text[] := array['ai_conversations', 'ai_messages', 'support_threads', 'support_messages', 'site_visits', 'email_verifications'];
  off_exempt text[] := array['site_visits', 'email_verifications', 'support_threads', 'support_messages'];
  off_readable text[] := array['employees', 'users', 'companies', 'documents', 'contracts', 'contract_signatures', 'contract_taktikal', 'departments', 'positions', 'locations'];
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    -- Demo (0087)
    if t.relname <> all (exempt) then
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'demo_readonly_insert') then
        execute format('create policy demo_readonly_insert on public.%I as restrictive for insert to authenticated with check (not (select public.is_demo_user()))', t.relname);
        n := n + 1;
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'demo_readonly_update') then
        execute format('create policy demo_readonly_update on public.%I as restrictive for update to authenticated using (not (select public.is_demo_user())) with check (not (select public.is_demo_user()))', t.relname);
        n := n + 1;
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'demo_readonly_delete') then
        execute format('create policy demo_readonly_delete on public.%I as restrictive for delete to authenticated using (not (select public.is_demo_user()))', t.relname);
        n := n + 1;
      end if;
      if not exists (select 1 from pg_trigger where tgrelid = format('public.%I', t.relname)::regclass and tgname = 'demo_readonly_guard') then
        execute format('create trigger demo_readonly_guard before insert or update or delete on public.%I for each statement execute function public.demo_readonly_guard()', t.relname);
        n := n + 1;
      end if;
    end if;
    -- Starfslok (0088): fyrrverandi starfsmaður skrifar ekkert; les aðeins leyfðar töflur, og ekkert eftir lokun.
    if t.relname <> all (off_exempt) then
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'offboarded_insert') then
        execute format('create policy offboarded_insert on public.%I as restrictive for insert to authenticated with check (not (select public.auth_is_offboarded()))', t.relname);
        n := n + 1;
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'offboarded_update') then
        execute format('create policy offboarded_update on public.%I as restrictive for update to authenticated using (not (select public.auth_is_offboarded())) with check (not (select public.auth_is_offboarded()))', t.relname);
        n := n + 1;
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'offboarded_delete') then
        execute format('create policy offboarded_delete on public.%I as restrictive for delete to authenticated using (not (select public.auth_is_offboarded()))', t.relname);
        n := n + 1;
      end if;
      if not exists (select 1 from pg_trigger where tgrelid = format('public.%I', t.relname)::regclass and tgname = 'offboarded_guard') then
        execute format('create trigger offboarded_guard before insert or update or delete on public.%I for each statement execute function public.offboarded_guard()', t.relname);
        n := n + 1;
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'offboarded_select') then
        if t.relname = any (off_readable) then
          execute format('create policy offboarded_select on public.%I as restrictive for select to authenticated using ((select public.auth_offboard_state()) <> ''closed'')', t.relname);
        else
          execute format('create policy offboarded_select on public.%I as restrictive for select to authenticated using ((select public.auth_offboard_state()) = ''active'')', t.relname);
        end if;
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end;
$$;

revoke all on function public.apply_demo_readonly() from public, anon, authenticated;

select public.apply_demo_readonly();

-- Storage: engar upphleðslur/breytingar/eyðingar eftir starfslok; ekkert lesið eftir lokun.
drop policy if exists offboarded_insert on storage.objects;
create policy offboarded_insert on storage.objects as restrictive for insert to authenticated
  with check (not (select public.auth_is_offboarded()));
drop policy if exists offboarded_update on storage.objects;
create policy offboarded_update on storage.objects as restrictive for update to authenticated
  using (not (select public.auth_is_offboarded())) with check (not (select public.auth_is_offboarded()));
drop policy if exists offboarded_delete on storage.objects;
create policy offboarded_delete on storage.objects as restrictive for delete to authenticated
  using (not (select public.auth_is_offboarded()));
drop policy if exists offboarded_select on storage.objects;
create policy offboarded_select on storage.objects as restrictive for select to authenticated
  using ((select public.auth_offboard_state()) <> 'closed');
