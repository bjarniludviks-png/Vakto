-- 0026 — company contact/info fields (Stillingar → Fyrirtæki). Run after 0001–0025.
alter table companies add column if not exists address text;
alter table companies add column if not exists phone text;
alter table companies add column if not exists email text;
