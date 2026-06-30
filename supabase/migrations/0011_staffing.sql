-- 0011 — staffing need per weekday (Mon..Sun) for the schedule. Run after 0001–0010.
alter table companies add column if not exists staffing_targets jsonb;
