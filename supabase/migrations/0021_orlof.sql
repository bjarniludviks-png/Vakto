-- 0021 — per-employee orlof (vacation) handling. Run after 0020.
-- jsonb { mode: 'accrue_amount'|'accrue_hours'|'accrue_days'|'pay_out'|'to_bank', pct: number }
alter table employees add column if not exists orlof jsonb;
