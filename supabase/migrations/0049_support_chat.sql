-- Spjallgaurinn á heimasíðunni: samtöl gesta (bot + eigandi tekur við).
-- Service-role eingöngu — RLS kveikt án stefna, vefþjónninn les/skrifar með admin-lykli.
create table if not exists support_threads (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text,
  email text,
  lang text not null default 'is',
  status text not null default 'bot' check (status in ('bot','human','closed')),
  page text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_seen_at timestamptz
);
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references support_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','owner')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_thread_idx on support_messages(thread_id, created_at);
create index if not exists support_threads_updated_idx on support_threads(updated_at desc);
alter table support_threads enable row level security;
alter table support_messages enable row level security;
