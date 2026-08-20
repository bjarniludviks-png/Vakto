-- 0042: Messenger-style chat upgrades
--   1. channels.photo_url — group photo (any member of a group may update
--      name/photo, like Messenger; creator/manager policy stays for the rest)
--   2. messages.reply_to — reply-to-message threading
--   3. message_reactions — one emoji reaction per user per message
--   4. employees may delete their OWN messages

alter table channels add column if not exists photo_url text;

alter table messages add column if not exists reply_to uuid references messages(id) on delete set null;

create table if not exists message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  emoji text not null default '❤️',
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table message_reactions enable row level security;

drop policy if exists message_reactions_read on message_reactions;
create policy message_reactions_read on message_reactions
  for select using (company_id = public.auth_company_id());

drop policy if exists message_reactions_own on message_reactions;
create policy message_reactions_own on message_reactions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and company_id = public.auth_company_id());

-- group members may rename / set photo on their group channels
drop policy if exists channels_member_update on channels;
create policy channels_member_update on channels
  for update using (kind = 'group' and public.is_channel_member(id))
  with check (kind = 'group' and public.is_channel_member(id));

-- unsend: delete your own message
drop policy if exists messages_own_delete on messages;
create policy messages_own_delete on messages
  for delete using (sender_id = auth.uid());
