-- Áskriftarstaða fyrirtækis má aðeins breytast á þjóninum (service role: nýskráning, Straumur-webhook,
-- reikningakeyrsla, VAKTO Admin). Áður gat eigandi breytt eigin röð í `companies` að vild
-- (companies_owner_write) og þar með sett sig á „free“ eða framlengt prufuna sjálfur.
create or replace function public.companies_billing_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service role / innri keyrsla
  if new.billing_status   is distinct from old.billing_status
  or new.card_required    is distinct from old.card_required
  or new.trial_ends_at    is distinct from old.trial_ends_at
  or new.plan             is distinct from old.plan
  or new.price_plan       is distinct from old.price_plan
  or new.price_v1_until   is distinct from old.price_v1_until
  or new.billing_anchor   is distinct from old.billing_anchor
  or new.billing_interval is distinct from old.billing_interval
  or new.billing_year_start is distinct from old.billing_year_start then
    raise exception 'BILLING_READONLY' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists companies_billing_guard on public.companies;
create trigger companies_billing_guard before update on public.companies
  for each row execute function public.companies_billing_guard();
revoke execute on function public.companies_billing_guard() from public, anon, authenticated;
