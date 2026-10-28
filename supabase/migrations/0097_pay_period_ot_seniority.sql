-- 0097 — launatímabil að vild, yfirvinna að meðaltali og starfsaldur sem telst með. Run after 0096.
--
-- companies.pay_period: { "kind": "month", "startDay": 21 } | { "kind": "semimonth" }
--   | { "kind": "biweekly", "anchor": "2026-01-05" } | { "kind": "weekly", "anchor": "2026-01-05" }
--   null = gamla pay_period_start (almanaksmánuður eða upphafsdagur 1–28) — óbreytt hegðun.
-- companies.ot_mode: 'week' (sjálfgefið, hver almanaksvika sér) | 'period' (40 klst/viku að meðaltali yfir
--   launatímabilið — vaktavinna, t.d. greiðasölusamningur SGS–SA gr. 3.2.4).
-- employees.prior_service_months: starfsaldur fyrir ráðningardag sem telst með í orlofs- og veikindarétti
--   (t.d. fyrri ráðning hjá sama fyrirtæki). 0 = aðeins frá ráðningardegi.

alter table public.companies add column if not exists pay_period jsonb;
alter table public.companies add column if not exists ot_mode text not null default 'week';
do $$ begin
  alter table public.companies add constraint companies_ot_mode_chk check (ot_mode in ('week', 'period'));
exception when duplicate_object then null; end $$;

alter table public.employees add column if not exists prior_service_months integer not null default 0;
do $$ begin
  alter table public.employees add constraint employees_prior_service_chk check (prior_service_months between 0 and 600);
exception when duplicate_object then null; end $$;
