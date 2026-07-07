-- 0027 — manual billing status per company (VAKTO admin), until Teya automates it.
-- Values: null (derive from trial), 'paying', 'unpaid', 'free'. Run after 0026.
alter table companies add column if not exists billing_status text;
