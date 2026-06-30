-- 0013 — per-employee custom pay-rule set (used when union = "Eigin reglur").
-- Run after 0001–0012.
alter table employees add column if not exists pay_rule jsonb;
