-- 0024 — per-employee clock token for the Wallet ID card QR. Run after 0023.
-- The QR on the staff pass encodes this token; the kiosk scans it to clock in/out.
alter table employees add column if not exists clock_token text unique;

-- Backfill a random token for existing employees.
update employees set clock_token = replace(gen_random_uuid()::text, '-', '') where clock_token is null;
