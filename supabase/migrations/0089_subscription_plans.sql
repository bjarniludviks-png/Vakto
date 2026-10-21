-- 0089 — Áskriftarleiðir (okt. 2026): Frítt / Grunnur / Vöxtur / Rekstur. Run after 0088.
-- Verð og innifalið: src/lib/plans.ts · eiginleikar per leið: src/lib/plan-features.ts (= plan_allows hér).
--
--   companies.plan              'free' | 'grunnur' | 'voxtur' | 'rekstur' (áður 'vakto'/NULL). Prufa = 'voxtur'.
--   companies.legacy_price_until  eldra verð (min(gamla, nýja)) gildir til og með þessum degi
--   companies.ai_pack_enabled/ai_pack_cap  AI-pakkar (1.490 kr / 50 spurningar) þegar kvótinn klárast, mest cap á mánuði
--   ai_usage.packs              pakkar teknir í mánuðinum (reikningsfærðir eftir á)
--   ai_usage_calls              hvert Anthropic-kall: tókar + kostnaður í kr (kostnaðarþak 30 % af áskrift)
--
-- Samhæfð við eldri kóða (main fyrir þessa breytingu): 'vakto' í plan → 'voxtur' (gikkur), ai_addon helst
-- (ónotaður; fluttur í ai_pack_enabled), ai_usage.questions óbreytt. Örugg endurkeyrsla.

-- ---------- 1. Dálkar ----------
alter table public.companies add column if not exists legacy_price_until date;
alter table public.companies add column if not exists ai_pack_enabled boolean not null default false;
alter table public.companies add column if not exists ai_pack_cap int not null default 10;
alter table public.companies add column if not exists billing_year_plan text;  -- leiðin sem árgjaldið var greitt fyrir
do $$ begin
  alter table public.companies add constraint companies_ai_pack_cap_chk check (ai_pack_cap between 0 and 100);
exception when duplicate_object then null; end $$;

alter table public.ai_usage add column if not exists packs int not null default 0;

alter table public.invoices add column if not exists plan text;
alter table public.invoices add column if not exists ai_packs int not null default 0;
alter table public.invoices add column if not exists legacy boolean not null default false;

-- ---------- 2. Bakfylling (aðeins raðir sem eru ekki þegar á nýju leiðunum) ----------
-- a) Opið demo (Kaffi Sól), Apple-prófunarfyrirtækið (Kaffi Krónan) og fríar áskriftir (Faktura o.fl.):
--    allir eiginleikar, billing_status óbreytt ('free' er aldrei rukkað).
update public.companies set plan = 'rekstur'
  where (plan is null or plan not in ('free', 'grunnur', 'voxtur', 'rekstur'))
    and (billing_status = 'free' or admin_note in ('public-demo', 'app-review-demo') or name ilike 'Kaffi Kr_nan%');
-- b) Eldri fyrirtæki án áskriftar (plan NULL, aldrei í reikningakeyrslunni): óbreytt aðgengi.
update public.companies set plan = 'rekstur'
  where plan is null and trial_ends_at is null and billing_anchor is null;
-- c) Í prufu (ekki enn greitt): Vöxtur — skráðu sig á gamla verðinu, svo eldra verð gildir í 12 mánuði.
update public.companies set plan = 'voxtur',
    legacy_price_until = coalesce(legacy_price_until, (current_date + interval '12 months')::date)
  where (plan is null or plan not in ('free', 'grunnur', 'voxtur', 'rekstur'))
    and trial_ends_at > now() and billing_status is distinct from 'paying';
-- d) Önnur (greiðandi / prufu lokið): ódýrasta GREIDDA leið miðað við virka starfsmenn síðustu 30 daga
--    (aldrei 'free' — þau hafa haft app og stimpilklukku), eldra verð í 12 mánuði.
with act as (
  select c.id, (select count(distinct b.ref) from public.billing_usage b
                where b.company_id = c.id and b.kind in ('shift', 'punch') and b.day >= current_date - 30) as n
  from public.companies c
  where c.plan is null or c.plan not in ('free', 'grunnur', 'voxtur', 'rekstur')
), price as (
  select id,
    9990  + greatest(0, n - 8)  * 1190 as g,
    24990 + greatest(0, n - 25) * 990  as v,
    54990 + greatest(0, n - 60) * 790  as r
  from act
)
update public.companies c set
  plan = case when p.g < p.v and p.g < p.r then 'grunnur' when p.v < p.r then 'voxtur' else 'rekstur' end,  -- jafnt verð → stærri leið (eins og cheapestPlan)
  legacy_price_until = coalesce(c.legacy_price_until, (current_date + interval '12 months')::date)
from price p where p.id = c.id;
-- e) Gamla AI-viðbótin (1.990 kr/500) → AI-pakkar með þaki 10 á mánuði.
update public.companies set ai_pack_enabled = true, ai_pack_cap = 10 where ai_addon and not ai_pack_enabled;

-- ---------- 3. plan: sjálfgefið, gildi, samhæfni ----------
alter table public.companies alter column plan set default 'voxtur';
-- Eldri kóði skrifar plan = 'vakto' við nýskráningu → Vöxtur (prufa). NULL → Vöxtur.
create or replace function public.companies_plan_normalize() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.plan is null or new.plan = 'vakto' then new.plan := 'voxtur'; end if;
  return new;
end $$;
drop trigger if exists companies_plan_normalize on public.companies;
create trigger companies_plan_normalize before insert or update of plan on public.companies
  for each row execute function public.companies_plan_normalize();
update public.companies set plan = 'voxtur' where plan is null;
alter table public.companies alter column plan set not null;
do $$ begin
  alter table public.companies add constraint companies_plan_chk check (plan in ('free', 'grunnur', 'voxtur', 'rekstur'));
exception when duplicate_object then null; end $$;

-- Áskriftardálkar breytast aðeins á þjóninum (sama regla og 0066).
create or replace function public.companies_billing_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service role / innri keyrsla
  if new.billing_status   is distinct from old.billing_status
  or new.card_required    is distinct from old.card_required
  or new.trial_ends_at    is distinct from old.trial_ends_at
  or new.plan             is distinct from old.plan
  or new.price_plan       is distinct from old.price_plan
  or new.price_v1_until   is distinct from old.price_v1_until
  or new.billing_anchor   is distinct from old.billing_anchor
  or new.billing_interval is distinct from old.billing_interval
  or new.billing_year_start is distinct from old.billing_year_start
  or new.billing_year_plan is distinct from old.billing_year_plan
  or new.legacy_price_until is distinct from old.legacy_price_until
  or new.ai_pack_enabled  is distinct from old.ai_pack_enabled
  or new.ai_pack_cap      is distinct from old.ai_pack_cap then
    raise exception 'BILLING_READONLY' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.companies_billing_guard() from public, anon, authenticated;

-- ---------- 4. Eiginleikar per leið ----------
create or replace function public.plan_rank(p text) returns int
language sql immutable set search_path = public as $$
  select case p when 'free' then 0 when 'grunnur' then 1 when 'voxtur' then 2 when 'rekstur' then 3 else 2 end;
$$;

-- Leið sem gildir fyrir eiginleika: Grunnur í prufu (ekki enn greitt) fær Vöxt — prufan er á Vexti.
create or replace function public.company_feature_plan(p_company uuid) returns text
language sql stable security definer set search_path = public as $$
  -- Grunnur fær eiginleika Vaxtar í prufu og á meðan eldra verð gildir (eldri viðskiptavinir missa ekkert).
  select case when c.plan = 'grunnur'
               and ((c.trial_ends_at > now() and c.billing_status is distinct from 'paying')
                    or c.legacy_price_until >= (now() at time zone 'Atlantic/Reykjavik')::date)
              then 'voxtur' else c.plan end
  from public.companies c where c.id = p_company;
$$;
revoke all on function public.company_feature_plan(uuid) from public, anon;
grant execute on function public.company_feature_plan(uuid) to authenticated, service_role;

-- Sama tafla og FEATURE_MIN í src/lib/plan-features.ts.
create or replace function public.plan_allows(p_company uuid, p_feature text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.plan_rank(coalesce(public.company_feature_plan(p_company), 'voxtur'))
    >= case when p_feature in ('ai_schedule', 'alerts', 'work_overview', 'terminations', 'multi_location') then 2
            when p_feature in ('app', 'clock', 'chat', 'requests', 'payroll', 'contracts', 'ai') then 1
            else 0 end;
$$;
revoke all on function public.plan_allows(uuid, text) from public, anon;
grant execute on function public.plan_allows(uuid, text) to authenticated, service_role;

-- Leið eigin fyrirtækis (appið kallar til að vita hvort það má opnast).
create or replace function public.company_plan() returns text
language sql stable security definer set search_path = public as $$
  select plan from public.companies where id = public.auth_company_id();
$$;
revoke all on function public.company_plan() from public, anon;
grant execute on function public.company_plan() to authenticated;

-- my_access_state (0088) + leið og hvort appið er leyft ('app': false → appið skráir út með skilaboðum).
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
    'access_until', (select access_until from public.my_termination()),
    'plan', public.company_plan(),
    'role', (select role::text from public.users where id = auth.uid()),
    'app', coalesce(public.plan_allows(public.auth_company_id(), 'app'), true)
  );
$$;
revoke all on function public.my_access_state() from public, anon;
grant execute on function public.my_access_state() to authenticated;

-- RESTRICTIVE: notandi (vefur/app með anon-lykli) getur ekki stofnað raðir í eiginleikum utan leiðar.
-- Þjónninn (service role) fer framhjá RLS → kiosk og server actions athuga sjálf (src/lib/plan.server.ts).
do $$
declare g record;
begin
  for g in select * from (values
    ('punches', 'clock'), ('messages', 'chat'),
    ('leave_requests', 'requests'), ('shift_swaps', 'requests'), ('availability', 'requests'), ('shift_claims', 'requests'),
    ('payroll_runs', 'payroll'), ('contracts', 'contracts'),
    ('alert_rules', 'alerts'), ('work_overviews', 'work_overview'), ('employment_terminations', 'terminations')
  ) as t(tbl, feat)
  loop
    if to_regclass('public.' || g.tbl) is not null then
      execute format('drop policy if exists plan_gate_insert on public.%I', g.tbl);
      execute format('create policy plan_gate_insert on public.%I as restrictive for insert to authenticated with check (public.plan_allows(company_id, %L))', g.tbl, g.feat);
    end if;
  end loop;
end $$;

-- Hámörk: Frítt 5 starfsmenn (ekki óvirkir); Frítt og Grunnur 1 staður. Gildir líka fyrir þjóninn.
create or replace function public.plan_limits_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text := public.company_feature_plan(new.company_id);
begin
  if tg_table_name = 'employees' and p = 'free'
     and (select count(*) from public.employees where company_id = new.company_id and status is distinct from 'inactive') >= 5 then
    raise exception using errcode = '42501', message = 'PLAN_LIMIT_EMPLOYEES: Fría leiðin er fyrir allt að 5 starfsmenn — í boði í Grunni, sjá vakto.is/verd.';
  end if;
  if tg_table_name = 'locations' and public.plan_rank(p) < 2
     and (select count(*) from public.locations where company_id = new.company_id) >= 1 then
    raise exception using errcode = '42501', message = 'PLAN_LIMIT_LOCATIONS: Fleiri staðir eru í boði í Vexti — sjá vakto.is/verd.';
  end if;
  return new;
end $$;
revoke all on function public.plan_limits_guard() from public, anon, authenticated;
drop trigger if exists plan_limits_guard on public.employees;
create trigger plan_limits_guard before insert on public.employees for each row execute function public.plan_limits_guard();
drop trigger if exists plan_limits_guard on public.locations;
create trigger plan_limits_guard before insert on public.locations for each row execute function public.plan_limits_guard();

-- ---------- 5. VAKTO AI: kvóti + pakkar ----------
-- Telur eina spurningu og tekur AI-pakka þegar komið er yfir innifaldar spurningar. Skilar {questions, packs}.
-- Aðgangsstýring (má taka pakka? þak?) er á þjóninum áður en kallað er (src/lib/ai/ai-plan.server.ts).
create or replace function public.ai_usage_count(p_company uuid, p_month date, p_included int) returns jsonb
language sql volatile security definer set search_path = public as $$
  insert into public.ai_usage as u (company_id, month, questions, packs)
    values (p_company, p_month, 1, case when 1 > p_included then 1 else 0 end)
  on conflict (company_id, month) do update set
    questions = u.questions + 1,
    packs = greatest(u.packs, ceil(greatest(0, u.questions + 1 - p_included) / 50.0)::int)
  returning jsonb_build_object('questions', questions, 'packs', packs);
$$;
revoke all on function public.ai_usage_count(uuid, date, int) from public, anon, authenticated;
grant execute on function public.ai_usage_count(uuid, date, int) to service_role;

-- Hvert kall til Anthropic. company_id NULL = forsíðuspjall (nafnlausir gestir).
create table if not exists public.ai_usage_calls (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid,
  created_at timestamptz not null default now(),
  feature text,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_isk numeric(12, 2) not null default 0
);
create index if not exists ai_usage_calls_company_idx on public.ai_usage_calls (company_id, created_at desc);
alter table public.ai_usage_calls enable row level security;
revoke all on table public.ai_usage_calls from anon, authenticated;
grant select on table public.ai_usage_calls to authenticated;
drop policy if exists ai_usage_calls_read on public.ai_usage_calls;
create policy ai_usage_calls_read on public.ai_usage_calls for select
  using (company_id = public.auth_company_id() and public.is_manager());

-- AI-kostnaður fyrirtækis frá og með degi (kostnaðarþak og /admin).
create or replace function public.ai_cost_since(p_company uuid, p_from timestamptz) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_isk), 0) from public.ai_usage_calls where company_id = p_company and created_at >= p_from;
$$;
revoke all on function public.ai_cost_since(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_cost_since(uuid, timestamptz) to service_role;

select public.apply_demo_readonly();
