-- 0012 — internal company chat (channels, members, messages). Run after 0001–0011.

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  kind text not null default 'group', -- general | group
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (channel_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_channel_idx on messages (channel_id, created_at);

alter table channels enable row level security;
alter table channel_members enable row level security;
alter table messages enable row level security;

-- Company-scoped read/write (internal chat for everyone in the company).
drop policy if exists channels_rw on channels;
create policy channels_rw on channels for all
  using (company_id = public.auth_company_id()) with check (company_id = public.auth_company_id());

drop policy if exists messages_read on messages;
create policy messages_read on messages for select using (company_id = public.auth_company_id());
drop policy if exists messages_ins on messages;
create policy messages_ins on messages for insert
  with check (company_id = public.auth_company_id() and sender_id = auth.uid());

drop policy if exists channel_members_rw on channel_members;
create policy channel_members_rw on channel_members for all
  using (exists (select 1 from channels c where c.id = channel_id and c.company_id = public.auth_company_id()))
  with check (exists (select 1 from channels c where c.id = channel_id and c.company_id = public.auth_company_id()));
