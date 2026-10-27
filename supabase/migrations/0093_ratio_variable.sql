-- 0093 — breytilegt starfshlutfall (tímavinna eftir vaktaplani). Run after 0092.
-- Ráðningarsamningur skrifar þá „Breytilegt – tímavinna“ í stað fasts hlutfalls.
alter table public.employees add column if not exists ratio_variable boolean not null default false;
