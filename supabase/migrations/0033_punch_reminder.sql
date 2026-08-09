-- 0033 — "Ertu enn að vinna?" reminder marker: one nudge per open punch.
alter table punches add column if not exists long_reminded_at timestamptz;
