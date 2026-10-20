-- 0086 — Vaktarar og sjálfvirkar skýrslur. Run after 0085 (óháð henni).
-- Stjórnendur (eða VAKTO AI fyrir þeirra hönd, created_via = 'ai') setja reglur:
--   hours_threshold    starfsmaður fer yfir X klst. á viku/mánuði/launatímabili (viðvörun t.d. við 90 %)
--   overtime_threshold starfsmaður fer yfir X yfirvinnutíma á tímabili
--   labor_pct_above    laun % af veltu fer yfir X % á tímabili
--   report             skýrsla úr Skýrslusafninu send á tímaáætlun (schedule)
-- Metið af /api/cron/alerts (service role). alert_events tryggir að hver viðvörun fari einu sinni
-- per starfsmann per tímabil (unique rule_id + dedupe_key).

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('hours_threshold', 'overtime_threshold', 'labor_pct_above', 'report')),
  params jsonb not null default '{}'::jsonb,
  channel text not null default 'email' check (channel in ('email', 'push', 'both')),
  -- Auðkenni notenda (users.id) í fyrirtækinu sem fá tilkynninguna; tómt = sá sem bjó regluna til.
  recipients uuid[] not null default '{}',
  -- Aðeins fyrir report: { "freq": "daily"|"weekly"|"monthly", "weekday": 1-7, "day": 1-28, "hour": 0-23 }
  schedule jsonb,
  active boolean not null default true,
  last_fired_at timestamptz,
  last_period_key text,
  created_via text not null default 'ui' check (created_via in ('ui', 'ai')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alert_rules_company_idx on public.alert_rules(company_id, active);

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.alert_rules(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  dedupe_key text not null,
  employee_id uuid references public.employees(id) on delete set null,
  detail text,
  fired_at timestamptz not null default now(),
  unique (rule_id, dedupe_key)
);
create index if not exists alert_events_company_idx on public.alert_events(company_id, fired_at desc);

alter table public.alert_rules enable row level security;
alter table public.alert_events enable row level security;

-- Eigendur og vaktstjórar fyrirtækisins sjá og stýra reglunum.
drop policy if exists alert_rules_read on public.alert_rules;
create policy alert_rules_read on public.alert_rules for select
  using (company_id = public.auth_company_id() and public.is_manager());

drop policy if exists alert_rules_insert on public.alert_rules;
create policy alert_rules_insert on public.alert_rules for insert
  with check (company_id = public.auth_company_id() and public.is_manager());

drop policy if exists alert_rules_update on public.alert_rules;
create policy alert_rules_update on public.alert_rules for update
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());

drop policy if exists alert_rules_delete on public.alert_rules;
create policy alert_rules_delete on public.alert_rules for delete
  using (company_id = public.auth_company_id() and public.is_manager());

-- Atburðaskráin er aðeins lesin í viðmótinu; cron (service role) skrifar.
drop policy if exists alert_events_read on public.alert_events;
create policy alert_events_read on public.alert_events for select
  using (company_id = public.auth_company_id() and public.is_manager());
