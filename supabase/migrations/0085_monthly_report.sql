-- 0085 — Mánaðarskýrsla í pósti til eiganda (src/lib/monthly-report.server.ts, cron 1. hvers mánaðar).
--   monthly_report           kveikt/slökkt (sjálfgefið kveikt)
--   monthly_report_managers  senda líka á vaktstjóra (sjálfgefið slökkt)
--   monthly_report_sent      síðasti mánuður sem var sendur ('YYYY-MM') — aldrei tvisvar sama mánuð
-- Skrifað með service-role (stillingar/monthly-report-actions.ts + cron); engin RLS-breyting.
alter table companies add column if not exists monthly_report boolean not null default true;
alter table companies add column if not exists monthly_report_managers boolean not null default false;
alter table companies add column if not exists monthly_report_sent text;
