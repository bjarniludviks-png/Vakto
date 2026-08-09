-- 0031 — company news feed (posts + likes + comments), Sling-parity.
-- Everyone in the company reads and reacts; everyone can post (workplace
-- feed, not an announcement-only board). company_id on every table keeps
-- RLS flat and fast.

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists posts_company_idx on posts(company_id, created_at desc);

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on post_comments(post_id, created_at);

alter table posts enable row level security;
alter table post_likes enable row level security;
alter table post_comments enable row level security;

drop policy if exists posts_rw on posts;
create policy posts_rw on posts for all
  using (company_id = public.auth_company_id()) with check (company_id = public.auth_company_id());
drop policy if exists post_likes_rw on post_likes;
create policy post_likes_rw on post_likes for all
  using (company_id = public.auth_company_id()) with check (company_id = public.auth_company_id());
drop policy if exists post_comments_rw on post_comments;
create policy post_comments_rw on post_comments for all
  using (company_id = public.auth_company_id()) with check (company_id = public.auth_company_id());
