-- 0035 — pinned announcements on the feed.
alter table posts add column if not exists pinned boolean not null default false;
