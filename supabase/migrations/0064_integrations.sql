-- 0064 — Tengingar (okt. 2026): kerfi sem senda veltu sjálfkrafa (Shopify, WooCommerce …),
-- val fyrirtækis á veltuleið og lært vikudagamynstur veltu.
-- Lyklar kerfanna eru dulkóðaðir á þjóninum (AES-256-GCM) áður en þeir eru vistaðir hér.

alter table companies add column if not exists revenue_mode text
  check (revenue_mode in ('system', 'manual', 'estimate'));
-- true = weekday_revenue var reiknað úr raunveltu (sjálfvirkt), false = slegið inn/áætlað.
alter table companies add column if not exists weekday_revenue_learned boolean not null default false;

create table if not exists company_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null,                  -- 'shopify' | 'woocommerce'
  site text not null,                      -- verslun.myshopify.com / https://verslun.is
  location_id uuid references locations(id) on delete set null,
  secret_enc text,                         -- dulkóðaður aðgangslykill
  status text not null default 'connected' check (status in ('connected', 'error')),
  last_sync_at timestamptz,
  last_error text,
  last_amount numeric,                     -- velta síðasta heila dags
  created_at timestamptz not null default now(),
  unique (company_id, provider, site)
);
create index if not exists company_integrations_company_idx on company_integrations(company_id);
alter table company_integrations enable row level security;

drop policy if exists company_integrations_select on company_integrations;
create policy company_integrations_select on company_integrations for select
  using (company_id = public.auth_company_id() and public.is_manager());
drop policy if exists company_integrations_write on company_integrations;
create policy company_integrations_write on company_integrations for all
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());

-- „Láta mig vita": hvaða kerfi viðskiptavinir bíða eftir (forgangsröðun tenginga).
create table if not exists integration_interest (
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null,
  user_id uuid,
  created_at timestamptz not null default now(),
  primary key (company_id, provider)
);
alter table integration_interest enable row level security;
drop policy if exists integration_interest_rw on integration_interest;
create policy integration_interest_rw on integration_interest for all
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());
