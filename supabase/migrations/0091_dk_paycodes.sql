-- 0091 — DK: launaliðir fyrirtækisins í dk Laun fyrir CSV-innlestur í launakeyrslu
-- (Laun → Launakeyrsla → Skráning tíma/launa → F5 → „Lesa úr CSV-skrá inn í launakeyrslu“).
-- {"dagvinna":"100","yfirvinna":"200","alag":{"33":"310","45":"320"}}
alter table public.companies add column if not exists dk_paycodes jsonb;
