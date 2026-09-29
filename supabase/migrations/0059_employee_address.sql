-- 0059 — heimilisfang og nánasti aðstandandi starfsmanns. Run after 0058.
-- Heimilisfang er lágmarksatriði í ráðningarsamningi (form Vinnumálastofnunar,
-- 91/533/EBE); aðstandandi er valkvæður reitur á sama formi.
alter table public.employees
  add column if not exists address text,
  add column if not exists next_of_kin text;
