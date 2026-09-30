-- 0062 — rafræn undirritun ráðningarsamninga með rafrænum skilríkjum gegnum Taktikal.
-- Run after 0061. Fyrirtæki velur aðferð: 'vakto' (ókeypis kóði í tölvupósti, sjálfgefið)
-- eða 'taktikal' (fullgild undirskrift beggja aðila með rafrænum skilríkjum, greitt per samning).

alter table public.companies
  add column if not exists esign_provider text not null default 'vakto';
do $$ begin
  alter table public.companies add constraint companies_esign_provider_chk check (esign_provider in ('vakto', 'taktikal'));
exception when duplicate_object then null; end $$;

-- Eitt undirritunarferli hjá Taktikal per samning. Aðeins þjónninn les og skrifar
-- (undirritunartenglar eru persónulegir og afhentir gegnum server actions).
create table if not exists public.contract_taktikal (
  contract_id uuid primary key references public.contracts(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  process_key text not null unique,
  employer_signee_key text,
  employee_signee_key text,
  employer_url text,
  employee_url text,
  status text not null default 'created' check (status in ('created', 'employer_signed', 'employee_signed', 'all_signed', 'canceled', 'expired', 'failed')),
  last_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contract_taktikal enable row level security; -- engar reglur = aðeins þjónninn
