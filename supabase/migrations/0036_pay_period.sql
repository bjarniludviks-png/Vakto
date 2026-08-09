-- 0036 — configurable pay period start day (1 = calendar month, 21 = 21st→20th …).
alter table companies add column if not exists pay_period_start smallint not null default 1;
