-- 0016 — per-employee Mitt-svæði permissions + benefits/allowances. Run after 0015.
alter table employees add column if not exists permissions jsonb;
alter table employees add column if not exists benefits jsonb;
