-- Áskrift og greiðslur gegnum Straum (kort skráð við nýskráningu, tekið af því eftir prufu).
-- Allt skrifað með service-role úr vefþjóni/webhook; RLS leyfir fyrirtækinu að LESA sín gögn.
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null default 'straumur',
  token text not null,
  card_summary text,          -- síðustu 4
  card_brand text,            -- VI / MC ...
  card_expiry text,           -- MM/yyyy
  checkout_reference text,
  payfac_reference text,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now()
);
create index if not exists payment_methods_company_idx on payment_methods(company_id, status);
create unique index if not exists payment_methods_token_idx on payment_methods(provider, token);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  users_count int not null default 0,
  base_amount int not null,       -- kr án VSK
  extra_amount int not null default 0,
  vat_amount int not null default 0,
  total_amount int not null,      -- kr með VSK (það sem er tekið af korti)
  currency text not null default 'ISK',
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','void')),
  reference text not null unique, -- merchantReference hjá Straumi: inv:<id>
  payfac_reference text,
  attempts int not null default 0,
  last_error text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invoices_company_idx on invoices(company_id, period_start desc);

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  event_type text not null,
  payfac_reference text,
  merchant_reference text,
  success boolean,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create unique index if not exists billing_events_dedup on billing_events(event_type, payfac_reference, merchant_reference);

alter table companies add column if not exists billing_anchor date;           -- fyrsti gjalddagi (= lok prufu)
alter table companies add column if not exists trial_reminder_sent_at timestamptz;
alter table companies add column if not exists trial_expired_sent_at timestamptz;

alter table payment_methods enable row level security;
alter table invoices enable row level security;
alter table billing_events enable row level security;
drop policy if exists payment_methods_read on payment_methods;
create policy payment_methods_read on payment_methods for select using (company_id = auth_company_id());
drop policy if exists invoices_read on invoices;
create policy invoices_read on invoices for select using (company_id = auth_company_id());
