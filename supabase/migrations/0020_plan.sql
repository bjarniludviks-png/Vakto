-- 0020 — company subscription plan + trial. Run after 0019.
alter table companies add column if not exists plan text;
alter table companies add column if not exists trial_ends_at timestamptz;
