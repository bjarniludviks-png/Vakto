-- 0046: Messenger-grade chat. Run after 0045.
--   1. channel_reads — per-user "last read" cursor per channel → real unread
--      counts (server-side) + read receipts ("Séð").
--   2. chat_unread_counts() — RPC that counts unread messages per channel for
--      the caller (security invoker → messages RLS decides what is visible).
--   3. channels.auto_key — 'dept:<id>' | 'loc:<id>' marks the automatic team
--      channels per department / location (kept in sync from the app).
--   4. channel_reads joins the realtime publication so read receipts update live.
-- The web chat tolerates this migration being absent (counts fall back to 0,
-- receipts/team channels simply do not appear).

-- ---------- 1) channel_reads ----------
create table if not exists public.channel_reads (
  channel_id   uuid not null references public.channels(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists channel_reads_user_idx on public.channel_reads (user_id);

alter table public.channel_reads enable row level security;

-- Members of a channel may SEE each other's cursors (read receipts) …
drop policy if exists channel_reads_read on public.channel_reads;
create policy channel_reads_read on public.channel_reads
  for select using (public.channel_visible(channel_id));

-- … but only ever WRITE their own row.
drop policy if exists channel_reads_own on public.channel_reads;
create policy channel_reads_own on public.channel_reads
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.channel_visible(channel_id));

-- ---------- 2) unread counts ----------
-- Messages newer than my cursor, sent by someone else, in channels I can see.
-- A channel with no cursor row counts everything (first visit clears it).
create or replace function public.chat_unread_counts()
returns table (channel_id uuid, n bigint)
language sql stable security invoker set search_path = public as $$
  select m.channel_id, count(*)::bigint as n
  from public.messages m
  left join public.channel_reads r
    on r.channel_id = m.channel_id and r.user_id = auth.uid()
  where m.sender_id is distinct from auth.uid()
    and m.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz)
  group by m.channel_id
$$;
grant execute on function public.chat_unread_counts() to authenticated;

-- ---------- 3) automatic team channels ----------
alter table public.channels add column if not exists auto_key text;
-- Plain (non-partial) unique index: NULLs are distinct, so manual channels never
-- collide, and PostgREST's `on_conflict=auto_key` upsert can infer it.
create unique index if not exists channels_auto_key_uidx on public.channels (auto_key);

-- ---------- 4) realtime ----------
do $$
begin
  alter publication supabase_realtime add table public.channel_reads;
exception when duplicate_object then null;
end $$;
