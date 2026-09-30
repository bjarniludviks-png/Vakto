-- 0063 — Verð v2 (30. sept 2026): 9.990 kr/mán með 5 virkum starfsmönnum, 1.490 kr á hvern virkan umfram,
-- 490 kr á hverja fullgilda undirskrift (Taktikal). „Virkur“ = átti vakt eða stimplaði sig á tímabilinu.
--
-- billing_usage er skráð jafnóðum með triggerum og hefur ENGA tengingu við employees/shifts/punches,
-- svo virkni mánaðarins stendur þótt starfsmanni, vakt eða samningi sé eytt fyrir mánaðamót.
-- Núverandi fyrirtæki halda eldra verði (v1) til price_v1_until.

create table if not exists public.billing_usage (
  company_id uuid not null,
  kind text not null check (kind in ('shift', 'punch', 'esign')),
  ref text not null,          -- shift/punch: employee_id · esign: contract_signatures.id
  day date not null,
  created_at timestamptz not null default now(),
  primary key (company_id, kind, ref, day)
);
create index if not exists billing_usage_company_day_idx on public.billing_usage (company_id, day);
alter table public.billing_usage enable row level security; -- engar reglur: aðeins þjónninn (service role)

alter table public.companies add column if not exists price_plan text not null default 'v2'
  check (price_plan in ('v1', 'v2'));
alter table public.companies add column if not exists price_v1_until date;
alter table public.invoices add column if not exists active_employees int;
alter table public.invoices add column if not exists esign_count int not null default 0;
alter table public.invoices add column if not exists esign_amount int not null default 0;
alter table public.invoices add column if not exists usage_start date;
alter table public.invoices add column if not exists usage_end date;

-- Núverandi fyrirtæki: gamla verðið í 6 mánuði.
update public.companies set price_plan = 'v1', price_v1_until = date '2027-04-01'
  where price_v1_until is null;

create or replace function public.billing_usage_shift() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Vakt fjarlægð af plani (eða færð) ÁÐUR en hún átti sér stað telst ekki virkni á gamla deginum
  -- (nema önnur vakt sama starfsmanns sé sama dag). Liðnar vaktir standa alltaf.
  if tg_op in ('DELETE', 'UPDATE') and old.employee_id is not null and old.date >= current_date
     and (tg_op = 'DELETE' or old.employee_id is distinct from new.employee_id or old.date <> new.date)
     and not exists (select 1 from shifts s where s.employee_id = old.employee_id and s.date = old.date and s.id <> old.id) then
    delete from billing_usage where company_id = old.company_id and kind = 'shift'
      and ref = old.employee_id::text and day = old.date;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.employee_id is not null then
    insert into billing_usage (company_id, kind, ref, day)
      values (new.company_id, 'shift', new.employee_id::text, new.date) on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function public.billing_usage_punch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into billing_usage (company_id, kind, ref, day)
    values (new.company_id, 'punch', new.employee_id::text, coalesce(new.clock_in, now())::date) on conflict do nothing;
  return new;
end $$;

create or replace function public.billing_usage_esign() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.method = 'taktikal_qes' then
    insert into billing_usage (company_id, kind, ref, day)
      values (new.company_id, 'esign', new.id::text, new.signed_at::date) on conflict do nothing;
  end if;
  return new;
end $$;

revoke all on function public.billing_usage_shift() from public, anon, authenticated;
revoke all on function public.billing_usage_punch() from public, anon, authenticated;
revoke all on function public.billing_usage_esign() from public, anon, authenticated;

drop trigger if exists billing_usage_shift on public.shifts;
create trigger billing_usage_shift after insert or update of employee_id, date or delete on public.shifts
  for each row execute function public.billing_usage_shift();
drop trigger if exists billing_usage_punch on public.punches;
create trigger billing_usage_punch after insert on public.punches
  for each row execute function public.billing_usage_punch();
drop trigger if exists billing_usage_esign on public.contract_signatures;
create trigger billing_usage_esign after insert on public.contract_signatures
  for each row execute function public.billing_usage_esign();

-- Bakfylling síðustu 60 daga svo fyrsta uppgjör sé rétt.
insert into public.billing_usage (company_id, kind, ref, day)
  select company_id, 'shift', employee_id::text, date from public.shifts
  where employee_id is not null and date >= current_date - 60
  on conflict do nothing;
insert into public.billing_usage (company_id, kind, ref, day)
  select company_id, 'punch', employee_id::text, clock_in::date from public.punches
  where clock_in >= now() - interval '60 days'
  on conflict do nothing;
insert into public.billing_usage (company_id, kind, ref, day)
  select company_id, 'esign', id::text, signed_at::date from public.contract_signatures
  where method = 'taktikal_qes' and signed_at >= now() - interval '60 days'
  on conflict do nothing;

-- Árleg greiðsla: árgjald (12 × baseYear) fyrirfram frá billing_year_start; notkun mánaðarlega á árlegum kjörum.
alter table public.companies add column if not exists billing_interval text not null default 'month'
  check (billing_interval in ('month', 'year'));
alter table public.companies add column if not exists billing_year_start date;
alter table public.invoices add column if not exists billing_interval text not null default 'month';
