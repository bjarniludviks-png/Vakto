-- 0075 — VAKTO AI sem viðbót: 1.990 kr/mán án VSK með allt að 500 spurningum á mánuði.
-- Án viðbótar fær fyrirtækið 25 spurningar á mánuði frítt; í prufu allt að 500. Run after 0074.
-- Reglurnar sjálfar eru í src/lib/ai/ai-plan.server.ts; verðið í src/lib/pricing.ts (AI_ADDON_PRICE).
alter table companies add column if not exists ai_addon boolean not null default false;
alter table companies add column if not exists ai_addon_since timestamptz;
alter table invoices add column if not exists ai_amount int not null default 0;   -- kr án VSK

-- Spurningar til VAKTO AI per fyrirtæki og almanaksmánuð (fyrsti dagur mánaðar).
create table if not exists ai_usage (
  company_id uuid not null references companies(id) on delete cascade,
  month date not null,
  questions int not null default 0,
  primary key (company_id, month)
);
alter table ai_usage enable row level security;
revoke all on table ai_usage from anon, authenticated;
grant select on table ai_usage to authenticated;
drop policy if exists ai_usage_read on ai_usage;
create policy ai_usage_read on ai_usage for select
  using (company_id = auth_company_id() and is_manager());

-- Telur eina spurningu (atómískt) og skilar nýjum fjölda. Aðeins þjónninn (service-role) kallar.
create or replace function ai_usage_bump(p_company uuid, p_month date) returns int
language sql volatile security definer set search_path = public as $$
  insert into ai_usage (company_id, month, questions) values (p_company, p_month, 1)
  on conflict (company_id, month) do update set questions = ai_usage.questions + 1
  returning questions;
$$;
revoke all on function ai_usage_bump(uuid, date) from public, anon, authenticated;
grant execute on function ai_usage_bump(uuid, date) to service_role;
