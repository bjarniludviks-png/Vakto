-- 0022 — company country (gates Icelandic-specific payroll modules). Run after 0021.
-- 'IS' = full Icelandic mode; anything else = standardized/international mode.
alter table companies add column if not exists country text default 'IS';
