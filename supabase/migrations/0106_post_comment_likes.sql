-- 0106 — Hjörtu á athugasemdum í fréttaveitunni. Run after 0105.
-- Eitt hjarta á mann á hverja athugasemd; sama aðgangsstýring og post_likes.
create table if not exists public.post_comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists post_comment_likes_company_idx on public.post_comment_likes (company_id);
alter table public.post_comment_likes enable row level security;

drop policy if exists post_comment_likes_read on public.post_comment_likes;
create policy post_comment_likes_read on public.post_comment_likes for select using (company_id = auth_company_id());
drop policy if exists post_comment_likes_own on public.post_comment_likes;
create policy post_comment_likes_own on public.post_comment_likes for all
  using (company_id = auth_company_id() and user_id = auth.uid())
  with check (company_id = auth_company_id() and user_id = auth.uid());

drop policy if exists demo_readonly_insert on public.post_comment_likes;
create policy demo_readonly_insert on public.post_comment_likes as restrictive for insert to authenticated with check (not (select is_demo_user()));
drop policy if exists demo_readonly_update on public.post_comment_likes;
create policy demo_readonly_update on public.post_comment_likes as restrictive for update to authenticated using (not (select is_demo_user())) with check (not (select is_demo_user()));
drop policy if exists demo_readonly_delete on public.post_comment_likes;
create policy demo_readonly_delete on public.post_comment_likes as restrictive for delete to authenticated using (not (select is_demo_user()));
drop policy if exists offboarded_select on public.post_comment_likes;
create policy offboarded_select on public.post_comment_likes as restrictive for select to authenticated using ((select auth_offboard_state()) = 'active');
drop policy if exists offboarded_insert on public.post_comment_likes;
create policy offboarded_insert on public.post_comment_likes as restrictive for insert to authenticated with check (not (select auth_is_offboarded()));
drop policy if exists offboarded_update on public.post_comment_likes;
create policy offboarded_update on public.post_comment_likes as restrictive for update to authenticated using (not (select auth_is_offboarded())) with check (not (select auth_is_offboarded()));
drop policy if exists offboarded_delete on public.post_comment_likes;
create policy offboarded_delete on public.post_comment_likes as restrictive for delete to authenticated using (not (select auth_is_offboarded()));

drop trigger if exists demo_readonly_guard on public.post_comment_likes;
create trigger demo_readonly_guard before insert or delete or update on public.post_comment_likes for each statement execute function demo_readonly_guard();
drop trigger if exists offboarded_guard on public.post_comment_likes;
create trigger offboarded_guard before insert or delete or update on public.post_comment_likes for each statement execute function offboarded_guard();
