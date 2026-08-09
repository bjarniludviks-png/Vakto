-- 0037 — optional time-bank settlement in payroll runs.
-- Deduction is ALWAYS at base hourly rate only: when overtime offsets a
-- deficit the employee keeps the overtime premium — only the base part
-- cancels against the owed hours.
alter table payroll_lines add column if not exists timebank_hours numeric not null default 0;
alter table payroll_lines add column if not exists timebank_adj numeric not null default 0;
