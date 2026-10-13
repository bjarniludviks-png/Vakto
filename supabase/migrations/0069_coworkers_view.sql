-- 0069 — „coworkers“: það sem samstarfsfólk má sjá hvert um annað. Run after 0001–0068.
--
-- Vandinn: reglan employees_read (company_id = auth_company_id()) hleypir HVERJUM starfsmanni í
-- ALLA dálka samstarfsfólks gegnum API-ið — taxta, kennitölu, bankareikning, heimilisfang,
-- aðstandanda og clock_token/calendar_token. RLS ræður aðeins röðum, ekki dálkum.
--
-- Lausnin er í tveimur skrefum svo ekkert brotni hjá notendum með eldri útgáfu af appinu:
--   0069 (þessi, hrein viðbót — má keyra strax): sýnin coworkers með öruggu dálkunum einum.
--        Vefur og app lesa samstarfsfólk héðan í stað employees.
--   0070 (þegar vefur OG app eru komin út með þeirri breytingu): employees_read þrengd í
--        stjórnendur; starfsmaður les áfram eigin röð (employees_self_read).
--
-- Sýnin keyrir með réttindum eigandans (security_invoker = off) og síar sjálf á fyrirtæki
-- notandans — þess vegna „security definer view“ viðvörun í Supabase advisor; hún er viljandi.
-- Nýir dálkar á employees eru sjálfkrafa EKKI hér: bæta þarf þeim við meðvitað.
create or replace view public.coworkers
with (security_invoker = off, security_barrier = true) as
  select
    e.id, e.user_id, e.company_id, e.location_id, e.department_id, e.position_id,
    e.full_name, e.title, e.phone, e.email, e.photo_url, e.avatar_color, e.role, e.status
  from public.employees e
  where e.company_id = public.auth_company_id();

revoke all on public.coworkers from anon, public;
grant select on public.coworkers to authenticated;
