-- 0034 — Facebook-style feed upgrade: media on posts + typed reactions.
alter table posts add column if not exists image_url text;
alter table posts add column if not exists file_url text;
alter table posts add column if not exists file_name text;
alter table post_likes add column if not exists reaction text not null default '❤️';
