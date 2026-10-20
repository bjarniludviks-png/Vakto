-- 0083 — Greiðsluleið áskriftar: kort (Straumur) eða krafa í heimabanka (Payday BGL). Run after 0082.
-- Nýskráning krefst ekki lengur korts. Prufa án korts endar í kröfu (src/lib/billing.server.ts).
-- null = ekki valið. Aðeins service role skrifar (eigandi velur í Stillingum → Áskrift gegnum server action).
alter table public.companies add column if not exists payment_method text
  check (payment_method in ('card', 'krafa'));

-- Reikningur: hvernig hann er innheimtur, eindagi kröfu og hvenær ítrekun (unpaid) var send.
alter table public.invoices add column if not exists payment_method text
  check (payment_method in ('card', 'krafa'));
alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists overdue_sent_at timestamptz;
create index if not exists invoices_krafa_pending_idx on public.invoices(status) where payment_method = 'krafa';

-- 0066-vörnin + payment_method: notandi má ekki breyta greiðsluleið beint.
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
  or new.billing_year_start is distinct from old.billing_year_start
  or new.payment_method   is distinct from old.payment_method then
    raise exception 'BILLING_READONLY' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.companies_billing_guard() from public, anon, authenticated;
