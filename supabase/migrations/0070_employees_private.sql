-- 0070 — employees: aðeins stjórnendur lesa raðir annarra. Run after 0069.
--
-- !! EKKI keyra á prod fyrr en vefurinn OG appið (OTA/nýtt build) lesa samstarfsfólk úr
-- !! sýninni coworkers (0069). Eldri útgáfur af appinu lesa nöfn samstarfsfólks beint úr
-- !! employees og sýna þá auð nöfn á vaktaplani og í spjalli.
--
-- Eftir þetta: stjórnandi/vaktstjóri les alla starfsmenn fyrirtækisins (óbreytt), starfsmaður
-- les eigin röð í heild (employees_self_read úr 0041) og sér aðra aðeins gegnum coworkers.
drop policy if exists employees_read on employees;
create policy employees_read on employees for select
  using (company_id = auth_company_id() and is_manager());
