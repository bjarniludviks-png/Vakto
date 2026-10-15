-- 0081 — nákvæmari launaútreikningur (src/lib/paysettings.ts):
-- skattkort, lífeyrir, viðbótarlífeyrir, stéttarfélag og sjóðir á hvern starfsmann + sjálfgefin gildi fyrirtækis,
-- og allar launatengdar fjárhæðir geymdar á launalínu.
alter table employees add column if not exists pay_settings jsonb;
alter table companies add column if not exists pay_defaults jsonb;

alter table payroll_lines
  add column if not exists orlof numeric default 0,
  add column if not exists orlof_to_bank numeric default 0,
  add column if not exists orlof_accrued numeric default 0,
  add column if not exists extra_pension numeric default 0,
  add column if not exists allowance_used numeric default 0,
  add column if not exists employer_pension numeric default 0,
  add column if not exists insurance numeric default 0,
  add column if not exists funds numeric default 0,
  add column if not exists cost numeric;

-- Starfsmaður má EKKI breyta eigin skattkorti/lífeyri (guard_employee_self_update leyfir aðeins tengiliðareiti),
-- svo engin breyting þarf á 0076 — pay_settings er ekki á leyfislistanum.

-- Hlunnindi á launalínu (staðgreiðsluskyld / þar af í fríðu / undanþegin).
alter table payroll_lines
  add column if not exists benefits numeric default 0,
  add column if not exists benefits_in_kind numeric default 0,
  add column if not exists benefits_free numeric default 0;
