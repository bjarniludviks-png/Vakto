-- ============================================================
-- 0028 — UNIVERSAL CORE: rule templates, contracts, scheduling patterns.
-- VAKTO works for any country/industry/union: companies define their own
-- rule sets (saved as reusable templates, optionally AI-suggested, always
-- user-approved). Icelandic kjarasamningar become optional presets in code.
-- Run after 0001–0027.
-- ============================================================

-- ---------- rule templates ----------
create table if not exists rule_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  country text,                                -- free text (e.g. "Ísland", "Danmark")
  region text,                                 -- region/town, free text
  industry text,                               -- free text
  union_name text,                             -- union/agreement, free text
  rules jsonb not null default '{}'::jsonb,    -- RuleSet — see src/lib/rules.ts
  source text not null default 'manual',       -- manual | preset | ai
  approved boolean not null default true,      -- AI suggestions require approval
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rule_templates_company_idx on rule_templates(company_id);

alter table rule_templates enable row level security;
drop policy if exists rule_templates_read on rule_templates;
create policy rule_templates_read on rule_templates for select
  using (company_id = public.auth_company_id());
drop policy if exists rule_templates_write on rule_templates;
create policy rule_templates_write on rule_templates for all
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());

-- ---------- employees: universal fields ----------
-- union becomes free text (any union anywhere); template + contract + pattern.
alter table employees add column if not exists union_name text;
alter table employees add column if not exists rule_template_id uuid references rule_templates(id) on delete set null;
alter table employees add column if not exists contract_type text;      -- fulltime | parttime | temporary | contractor | custom…
alter table employees add column if not exists schedule_pattern jsonb;  -- {kind, days, hours…} — see src/lib/rules.ts

-- ---------- employment contracts ----------
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  template text,                               -- template key used to generate
  title text not null default 'Ráðningarsamningur',
  content text not null,                       -- generated text (markdown), editable
  status text not null default 'draft',        -- draft | sent | signed | void
  sent_at timestamptz,
  signed_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists contracts_company_idx on contracts(company_id);
create index if not exists contracts_employee_idx on contracts(employee_id);

alter table contracts enable row level security;
drop policy if exists contracts_manager on contracts;
create policy contracts_manager on contracts for all
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());
drop policy if exists contracts_own_read on contracts;
create policy contracts_own_read on contracts for select
  using (employee_id = public.auth_employee_id());
