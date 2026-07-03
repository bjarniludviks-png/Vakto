-- 0023 — multi-company: a user can belong to several companies (same email) and
-- switch between them. users.company_id stays the ACTIVE company (all existing RLS
-- keeps working); this table records every membership. Run after 0022.
create table if not exists company_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role user_role not null default 'employee',
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);
create index if not exists company_members_user on company_members(user_id);

alter table company_members enable row level security;
-- A user can see their own memberships.
drop policy if exists company_members_own on company_members;
create policy company_members_own on company_members for select using (user_id = auth.uid());

-- Backfill from existing users.company_id so current owners keep their company.
insert into company_members (user_id, company_id, role)
  select id, company_id, role from public.users where company_id is not null
  on conflict (user_id, company_id) do nothing;
