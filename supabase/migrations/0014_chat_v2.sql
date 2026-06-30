-- 0014 — chat v2: media messages, DMs, member-based privacy, chat media bucket.
-- Run after 0001–0013.

alter table messages add column if not exists kind text not null default 'text'; -- text | image | audio
alter table messages add column if not exists attachment_url text;

-- Membership-aware visibility (general = everyone in company; groups/DMs = members).
drop policy if exists channels_rw on channels;
drop policy if exists channels_read on channels;
create policy channels_read on channels for select using (
  company_id = public.auth_company_id()
  and (kind = 'general' or created_by = auth.uid()
       or exists (select 1 from channel_members m where m.channel_id = id and m.user_id = auth.uid()))
);
drop policy if exists channels_ins on channels;
create policy channels_ins on channels for insert with check (company_id = public.auth_company_id());
drop policy if exists channels_upd on channels;
create policy channels_upd on channels for update
  using (company_id = public.auth_company_id() and (created_by = auth.uid() or public.is_manager()))
  with check (company_id = public.auth_company_id());
drop policy if exists channels_del on channels;
create policy channels_del on channels for delete
  using (company_id = public.auth_company_id() and (created_by = auth.uid() or public.is_manager()));

drop policy if exists messages_read on messages;
create policy messages_read on messages for select using (
  company_id = public.auth_company_id()
  and exists (
    select 1 from channels c where c.id = channel_id
    and (c.kind = 'general' or c.created_by = auth.uid()
         or exists (select 1 from channel_members m where m.channel_id = c.id and m.user_id = auth.uid()))
  )
);

-- Chat media (images / voice clips) — public bucket, authenticated upload.
insert into storage.buckets (id, name, public) values ('chat', 'chat', true)
on conflict (id) do update set public = true;
drop policy if exists chat_read on storage.objects;
create policy chat_read on storage.objects for select using (bucket_id = 'chat');
drop policy if exists chat_write on storage.objects;
create policy chat_write on storage.objects for insert to authenticated with check (bucket_id = 'chat');
