-- 0015 — fix chat RLS infinite recursion (channels <-> channel_members).
-- SECURITY DEFINER helpers bypass RLS so the policies don't reference each other.
-- Run after 0014 (or just run this).

create or replace function public.is_channel_member(cid uuid) returns boolean
  language sql security definer stable set search_path = public as
$$ select exists (select 1 from channel_members m where m.channel_id = cid and m.user_id = auth.uid()) $$;

create or replace function public.channel_company(cid uuid) returns uuid
  language sql security definer stable set search_path = public as
$$ select company_id from channels where id = cid $$;

create or replace function public.channel_visible(cid uuid) returns boolean
  language sql security definer stable set search_path = public as
$$ select exists (
     select 1 from channels c where c.id = cid and c.company_id = public.auth_company_id()
     and (c.kind = 'general' or c.created_by = auth.uid()
          or exists (select 1 from channel_members m where m.channel_id = cid and m.user_id = auth.uid()))
   ) $$;

-- channels: read uses the definer helper (no reference to channel_members RLS)
drop policy if exists channels_read on channels;
create policy channels_read on channels for select using (
  company_id = public.auth_company_id()
  and (kind = 'general' or created_by = auth.uid() or public.is_channel_member(id))
);

-- channel_members: scope via definer helper (no reference to channels RLS)
drop policy if exists channel_members_rw on channel_members;
drop policy if exists channel_members_read on channel_members;
drop policy if exists channel_members_write on channel_members;
create policy channel_members_read on channel_members for select
  using (public.channel_company(channel_id) = public.auth_company_id());
create policy channel_members_write on channel_members for all
  using (public.channel_company(channel_id) = public.auth_company_id())
  with check (public.channel_company(channel_id) = public.auth_company_id());

-- messages: visibility via definer helper
drop policy if exists messages_read on messages;
create policy messages_read on messages for select using (
  company_id = public.auth_company_id() and public.channel_visible(channel_id)
);
