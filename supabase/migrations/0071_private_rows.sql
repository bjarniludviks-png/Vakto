-- 0071 — Starfsmaður les aðeins SÍNAR raðir í skjölum, fjarvistum og stimplunum.
-- Run after 0001–0070. Óhætt fyrir eldri app-útgáfur: appið og vefurinn lesa
-- þessar töflur aðeins fyrir eigin starfsmann nema á stjórnendaskjám.
--
-- Áður: allir í fyrirtækinu gátu lesið gegnum grunninn nöfn skjala annarra
-- (áminningar, samningar), tegund fjarveru (veikindi) og stimplanir með staðsetningu.
-- Stjórnendur (owner/manager) sjá áfram allt í sínu fyrirtæki.

drop policy if exists documents_read on documents;
create policy documents_read on documents for select
  using (company_id = auth_company_id()
         and (is_manager() or employee_id = (select auth_employee_id())));
-- documents_shared_read (0040) stendur: sameiginleg skjöl (employee_id is null) sjá allir.

drop policy if exists leave_requests_read on leave_requests;
create policy leave_requests_read on leave_requests for select
  using (company_id = auth_company_id()
         and (is_manager() or employee_id = (select auth_employee_id())));

drop policy if exists punches_read on punches;
create policy punches_read on punches for select
  using (company_id = auth_company_id()
         and (is_manager() or employee_id = (select auth_employee_id())));

-- Kortatókinn (payment_methods.token) er aðeins fyrir þjóninn (service-role).
-- Innskráðir notendur fá dálkana sem birtast í viðmóti, aldrei tókann.
revoke all on table payment_methods from anon, authenticated;
grant select (id, company_id, provider, card_summary, card_brand, card_expiry, status, created_at)
  on table payment_methods to authenticated;

-- „Er virkt kort á fyrirtækinu MÍNU?“ (já/nei) — notað í proxy/middleware fyrir
-- alla notendur, svo lestrarreglan á töflunni geti verið fyrir stjórnendur eina (0072).
create or replace function company_has_card() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from payment_methods
    where company_id = auth_company_id() and status = 'active'
  );
$$;
revoke all on function company_has_card() from public, anon;
grant execute on function company_has_card() to authenticated;
