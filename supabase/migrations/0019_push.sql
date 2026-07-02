-- 0019 — web push subscriptions. Run after 0018.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;
-- Users manage their own subscriptions; sending is done server-side (service role).
drop policy if exists push_own on push_subscriptions;
create policy push_own on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
