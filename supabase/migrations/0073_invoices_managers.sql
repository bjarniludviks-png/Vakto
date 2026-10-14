-- 0073 — Reikningar/kvittanir fyrirtækis aðeins fyrir stjórnendur (áður allir í fyrirtækinu).
-- Run after 0072. Vefurinn les invoices aðeins í Stillingum → Áskrift og á /kvittun (stjórnendur);
-- greiðslukeyrsla og admin nota service-role.
drop policy if exists invoices_read on invoices;
create policy invoices_read on invoices for select
  using (company_id = auth_company_id() and is_manager());
