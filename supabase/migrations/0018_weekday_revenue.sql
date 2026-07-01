-- 0018 — average revenue per weekday (for laun% estimation without a POS link).
-- jsonb map "0".."6" (0=Sun … 6=Sat) → kr. Run after 0017.
alter table companies add column if not exists weekday_revenue jsonb;
