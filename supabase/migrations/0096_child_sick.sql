-- 0096 — veikindi barna sem sér tegund fjarvista + athugasemd. Run after 0095.
-- Veikindi barna eru sér réttur (SGS gr. 8.5.1 / VR: 12 dagar á 12 mánuðum eftir 6 mánaða starf) og mega
-- ekki ganga á veikindarétt starfsmanns sjálfs — því sér gildi, ekki „veikindi“.
alter type leave_type add value if not exists 'veikindi_barns';
alter table public.leave_requests add column if not exists note text;
