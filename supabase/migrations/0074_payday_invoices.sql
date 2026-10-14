-- 0074 — Reikningar VAKTO-áskriftar gefnir út í Payday BGL Ventures (src/lib/billing-payday.server.ts).
-- Run after 0073. Aðeins service-role skrifar þessa dálka.
alter table companies add column if not exists payday_customer_id text;      -- viðskiptamaður í Payday BGL
alter table invoices add column if not exists payday_invoice_id text;        -- id reiknings í Payday BGL
alter table invoices add column if not exists payday_invoice_number int;     -- reikningsnúmer (númeraröð Payday)
alter table invoices add column if not exists payday_error text;
alter table invoices add column if not exists payday_attempts int not null default 0;
create unique index if not exists invoices_payday_invoice_idx on invoices(payday_invoice_id) where payday_invoice_id is not null;
