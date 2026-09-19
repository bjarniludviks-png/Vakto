-- 0045 — per-company target for laun % af veltu (the dashboard's traffic light:
-- green ≤ target, yellow ≤ target + 3, red above). Was hardcoded 30 in three
-- places; now one setting read by src/lib/labor.ts getLaborTarget(). Run after 0044.
alter table companies add column if not exists labor_target numeric default 30;
