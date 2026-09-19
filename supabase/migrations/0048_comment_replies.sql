-- 0048 — svör við athugasemdum í fréttaveitu (eitt þrep, eins og á Facebook).
alter table post_comments add column if not exists parent_id uuid references post_comments(id) on delete cascade;
create index if not exists post_comments_parent_idx on post_comments(parent_id);
