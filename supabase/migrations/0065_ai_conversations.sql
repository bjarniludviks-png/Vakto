-- VAKTO AI: vistuð samtöl. Hver notandi sér aðeins sín eigin samtöl (innan síns fyrirtækis).
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_idx on ai_conversations(user_id, updated_at desc);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  actions jsonb,                       -- tillögur með stöðu (pending/done/cancelled/error)
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conv_idx on ai_messages(conversation_id, created_at);

alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;

drop policy if exists ai_conversations_own on ai_conversations;
create policy ai_conversations_own on ai_conversations for all to authenticated
  using (user_id = auth.uid() and company_id = public.auth_company_id())
  with check (user_id = auth.uid() and company_id = public.auth_company_id());

drop policy if exists ai_messages_own on ai_messages;
create policy ai_messages_own on ai_messages for all to authenticated
  using (exists (select 1 from ai_conversations c where c.id = conversation_id and c.user_id = auth.uid() and c.company_id = public.auth_company_id()))
  with check (exists (select 1 from ai_conversations c where c.id = conversation_id and c.user_id = auth.uid() and c.company_id = public.auth_company_id()));
