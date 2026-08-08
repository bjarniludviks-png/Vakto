-- 0029 — named API connections (open Revenue API).
-- Each company creates named keys ("Kassinn Kringlunni", "Shopify") in
-- Stillingar → Tengingar; external systems POST revenue with the key.
-- Only a sha256 hash is stored — the full key is shown once on creation.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  prefix text not null,                      -- displayed identifier (vk_live_ab12…)
  key_hash text not null unique,             -- sha256(full key), hex
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked boolean not null default false
);
create index if not exists api_keys_company_idx on api_keys(company_id);

alter table api_keys enable row level security;

drop policy if exists api_keys_select on api_keys;
create policy api_keys_select on api_keys for select
  using (company_id = public.auth_company_id());
drop policy if exists api_keys_insert on api_keys;
create policy api_keys_insert on api_keys for insert
  with check (company_id = public.auth_company_id());
drop policy if exists api_keys_update on api_keys;
create policy api_keys_update on api_keys for update
  using (company_id = public.auth_company_id());
drop policy if exists api_keys_delete on api_keys;
create policy api_keys_delete on api_keys for delete
  using (company_id = public.auth_company_id());
