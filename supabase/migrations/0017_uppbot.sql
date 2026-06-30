-- 0017 — desember-/orlofsuppbót line on payroll. Run after 0016.
-- Amount paid as desember- or orlofsuppbót in this payroll line (0 otherwise).
alter table payroll_lines add column if not exists uppbot numeric not null default 0;
