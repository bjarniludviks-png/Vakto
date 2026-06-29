-- ============================================================
-- VAKTO — pay rules (kjarasamninga álag/yfirvinna/stórhátíð) + monthly hours.
-- Defaults live in code (src/lib/payrules.ts); this table stores per-company
-- overrides + confirmation. Rates are UNCONFIRMED until verified against the
-- real agreements (Efling/VR). Run after 0001–0006.
-- ============================================================

-- Desired contracted hours per month, per employee (for time-bank / analytics).
alter table employees add column if not exists monthly_hours numeric;

create table if not exists pay_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,                       -- dagvinna | alag_kvold | alag_helgi | yfirvinna | storhatid
  label text not null,
  kind text not null default 'premium',     -- premium | overtime | holiday
  pct numeric not null default 0,           -- premium % over base rate
  confirmed boolean not null default false, -- verified against the real agreement?
  sort int not null default 0,
  unique (company_id, code)
);
create index if not exists pay_rules_company_idx on pay_rules(company_id);

alter table pay_rules enable row level security;

drop policy if exists pay_rules_read on pay_rules;
create policy pay_rules_read on pay_rules for select
  using (company_id = public.auth_company_id());

drop policy if exists pay_rules_write on pay_rules;
create policy pay_rules_write on pay_rules for all
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());
