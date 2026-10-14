-- 0078 — Fleiri skrifheimildir þrengdar (14. okt. 2026). Run after 0077.
--   channel_members: hver sem var í fyrirtækinu gat bætt sér (eða öðrum) í hvaða rás sem er, líka
--                    einkaspjall annarra, og þannig lesið það. Nú: stofnandi rásar, stjórnandi, eða
--                    meðlimur hópspjalls (ekki deildar-/staðarrása, þær samstillir þjónninn).
--   post_comments / post_likes: aðeins eigin færslur (stjórnendur mega eyða athugasemdum).
--   posts:         höfundi verður ekki breytt yfir á annan.
--   api_keys:      aðeins stjórnendur stofna og eyða lyklum.
--   audit_log:     ekki hægt að skrá færslu í nafni annars notanda.
--   shift_tasks:   starfsmaður má aðeins haka við eigin verkefni (done/done_at).

create or replace function public.can_add_channel_member(p_channel uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channels c
    where c.id = p_channel and c.company_id = auth_company_id()
      and exists (select 1 from users u where u.id = p_user and u.company_id = c.company_id)
      and (
        c.created_by = auth.uid() or is_manager()
        or (c.kind = 'group' and c.auto_key is null and is_channel_member(c.id))
      )
  );
$$;
revoke all on function public.can_add_channel_member(uuid, uuid) from public, anon;
grant execute on function public.can_add_channel_member(uuid, uuid) to authenticated;

create or replace function public.can_remove_channel_member(p_channel uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or exists (
    select 1 from channels c
    where c.id = p_channel and c.company_id = auth_company_id() and (c.created_by = auth.uid() or is_manager())
  );
$$;
revoke all on function public.can_remove_channel_member(uuid, uuid) from public, anon;
grant execute on function public.can_remove_channel_member(uuid, uuid) to authenticated;

drop policy if exists channel_members_write on channel_members;
drop policy if exists channel_members_insert on channel_members;
drop policy if exists channel_members_delete on channel_members;
create policy channel_members_insert on channel_members for insert
  with check (channel_company(channel_id) = auth_company_id() and can_add_channel_member(channel_id, user_id));
create policy channel_members_delete on channel_members for delete
  using (channel_company(channel_id) = auth_company_id() and can_remove_channel_member(channel_id, user_id));

drop policy if exists post_comments_rw on post_comments;
drop policy if exists post_comments_read on post_comments;
drop policy if exists post_comments_insert on post_comments;
drop policy if exists post_comments_own on post_comments;
drop policy if exists post_comments_delete on post_comments;
create policy post_comments_read on post_comments for select using (company_id = auth_company_id());
create policy post_comments_insert on post_comments for insert
  with check (company_id = auth_company_id() and sender_id = auth.uid());
create policy post_comments_own on post_comments for update
  using (company_id = auth_company_id() and sender_id = auth.uid())
  with check (company_id = auth_company_id() and sender_id = auth.uid());
create policy post_comments_delete on post_comments for delete
  using (company_id = auth_company_id() and (sender_id = auth.uid() or is_manager()));

drop policy if exists post_likes_rw on post_likes;
drop policy if exists post_likes_read on post_likes;
drop policy if exists post_likes_own on post_likes;
create policy post_likes_read on post_likes for select using (company_id = auth_company_id());
create policy post_likes_own on post_likes for all
  using (company_id = auth_company_id() and user_id = auth.uid())
  with check (company_id = auth_company_id() and user_id = auth.uid());

drop policy if exists posts_update on posts;
create policy posts_update on posts for update
  using (company_id = auth_company_id() and (sender_id = auth.uid() or is_manager()))
  with check (company_id = auth_company_id() and (sender_id = auth.uid() or is_manager()));

drop policy if exists api_keys_insert on api_keys;
drop policy if exists api_keys_delete on api_keys;
create policy api_keys_insert on api_keys for insert with check (company_id = auth_company_id() and is_manager());
create policy api_keys_delete on api_keys for delete using (company_id = auth_company_id() and is_manager());

drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert
  with check (company_id = auth_company_id() and (user_id is null or user_id = auth.uid()));

create or replace function public.guard_shift_task_self_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare allowed text[] := array['done', 'done_at'];
begin
  if auth.uid() is null or public.is_manager() then return new; end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'SELF_UPDATE_FORBIDDEN: aðeins hægt að haka við verkefni' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists shift_tasks_self_update_guard on public.shift_tasks;
create trigger shift_tasks_self_update_guard before update on public.shift_tasks
  for each row execute function public.guard_shift_task_self_update();

-- Triggerföllin eru ekki ætluð sem RPC (Supabase-linter 0028/0029).
revoke all on function public.guard_employee_self_update() from public, anon, authenticated;
revoke all on function public.guard_punch_self_write() from public, anon, authenticated;
revoke all on function public.guard_shift_task_self_update() from public, anon, authenticated;
