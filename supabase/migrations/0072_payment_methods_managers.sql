-- 0072 — Kortaupplýsingar fyrirtækis (tegund, síðustu 4, gildistími) aðeins fyrir stjórnendur.
-- Run after 0071 OG eftir að vefurinn með company_has_card() í proxy er kominn út —
-- eldri proxy las töfluna beint fyrir alla notendur og myndi senda starfsfólk
-- fyrirtækja með kortaskyldu á kortasíðuna.
drop policy if exists payment_methods_read on payment_methods;
create policy payment_methods_read on payment_methods for select
  using (company_id = auth_company_id() and is_manager());
