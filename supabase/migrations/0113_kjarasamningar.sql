-- 0113 — Kjarasamningasafn + launalyklar. Run after 0110 (0111/0112 eru í öðrum greinum; óháð þeim).
--
-- Safnið sjálft (afbrigði kjarasamninga, lýsingar, heimildir, orlofsþrep) er í kóða: src/lib/agreements.ts og
-- src/lib/agreement-presets.ts. Starfsmaður er settur á afbrigði með employees.pay_rule.agreement (eins og áður),
-- eigin reglur úr safninu eru rule_templates með rules.engine (nákvæm launaregla). Engin breyting á launum
-- starfsfólks fylgir þessari migration — aðeins þegar stjórnandi velur „Nota þessa reglu“.
--
--  • companies.pay_keys: launalyklar fyrirtækisins per launaþátt (heiti launaliðar í Payday):
--      {"dagvinna":"DAG-01","yfirvinna":"YV-01","yfirvinna1":"YV1","eve":"VAK-33","night":"NV-45","weekend":"HV-45","holiday":"STH-90"}
--    Tómt = sjálfgefin heiti („Dagvinna“, „Yfirvinna“, „Álag 33%“) eins og fyrir 0113.
--  • companies.default_agreement: afbrigði (UNION_PRESETS-lykill) sem er sjálfvalið fyrir nýtt starfsfólk.

alter table public.companies add column if not exists pay_keys jsonb;
alter table public.companies add column if not exists default_agreement text;

comment on column public.companies.pay_keys is 'Launalyklar per launaþátt (Payday-heiti). Sjá src/lib/pay-keys.ts.';
comment on column public.companies.default_agreement is 'Kjarasamningsafbrigði (UNION_PRESETS-lykill) sjálfvalið fyrir nýtt starfsfólk.';
