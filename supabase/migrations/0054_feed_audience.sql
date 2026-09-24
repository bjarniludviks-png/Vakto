-- 0054: fréttaveita — hverjir mega birta (fyrirtækisstilling) og markhópur á færslu
-- (allir / deild / staður). Stjórnendur sjá allt; aðrir sjá færslur ætlaðar þeim.
alter table companies add column if not exists feed_post_policy text not null default 'everyone'
  check (feed_post_policy in ('everyone', 'managers'));
alter table posts add column if not exists audience_kind text not null default 'all'
  check (audience_kind in ('all', 'department', 'location'));
alter table posts add column if not exists audience_id uuid;
create index if not exists posts_audience_idx on posts(company_id, audience_kind, audience_id);

drop policy if exists posts_rw on posts;
drop policy if exists posts_read on posts;
drop policy if exists posts_insert on posts;
drop policy if exists posts_update on posts;
drop policy if exists posts_delete on posts;

create policy posts_read on posts for select using (
  company_id = public.auth_company_id() and (
    audience_kind = 'all'
    or sender_id = auth.uid()
    or public.is_manager()
    or (audience_kind = 'department' and audience_id = (select e.department_id from public.employees e where e.id = public.auth_employee_id()))
    or (audience_kind = 'location' and audience_id = (select e.location_id from public.employees e where e.id = public.auth_employee_id()))
  )
);
create policy posts_insert on posts for insert with check (
  company_id = public.auth_company_id() and sender_id = auth.uid() and (
    public.is_manager()
    or (select c.feed_post_policy from public.companies c where c.id = public.auth_company_id()) = 'everyone'
  )
);
create policy posts_update on posts for update
  using (company_id = public.auth_company_id() and (sender_id = auth.uid() or public.is_manager()))
  with check (company_id = public.auth_company_id());
create policy posts_delete on posts for delete
  using (company_id = public.auth_company_id() and (sender_id = auth.uid() or public.is_manager()));
