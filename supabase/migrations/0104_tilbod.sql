-- 0104 — VAKTO Verk, fasi 2: tilboð sem viðskiptavinur samþykkir (verða að verki) og staða verka
-- frá tilboði til greiðslu (létt CRM). Run after 0103.
--
--   quotes          tilboð: línur (vinna/efni/annað), gildistími, skilmálar; opinber hlekkur (token) til samþykktar
--   jobs            + quote_id (verkið varð til úr tilboði), invoiced_at (reikningur sendur), paid_at (greitt)

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  number int not null default 0,
  title text not null check (length(btrim(title)) between 1 and 200),
  address text,
  description text,
  -- [{ kind: 'labor'|'material'|'other', description, quantity, unit, unitPrice }]
  items jsonb not null default '[]'::jsonb,
  valid_until date,
  terms text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  token uuid not null default gen_random_uuid() unique,
  sent_at timestamptz,
  signed_name text,
  client_comment text,
  decided_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists quotes_company_idx on public.quotes(company_id, created_at desc);

-- Tilboðsnúmer í röð per fyrirtæki (1, 2, 3 …).
create or replace function public.quotes_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.number is null or new.number = 0 then
    perform pg_advisory_xact_lock(hashtext('quotes:' || new.company_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.quotes where company_id = new.company_id;
  end if;
  return new;
end $$;
drop trigger if exists quotes_number on public.quotes;
create trigger quotes_number before insert on public.quotes for each row execute function public.quotes_number();

alter table public.jobs add column if not exists quote_id uuid references public.quotes(id) on delete set null;
alter table public.jobs add column if not exists invoiced_at timestamptz;
alter table public.jobs add column if not exists paid_at timestamptz;

alter table public.quotes enable row level security;
drop policy if exists quotes_read on public.quotes;
create policy quotes_read on public.quotes for select using (company_id = public.auth_company_id());
drop policy if exists quotes_write on public.quotes;
create policy quotes_write on public.quotes for all
  using (company_id = public.auth_company_id() and public.auth_role() in ('owner', 'manager', 'contractor'))
  with check (company_id = public.auth_company_id() and public.auth_role() in ('owner', 'manager', 'contractor'));

-- Viðskiptavinur og verk tilboðs verða að tilheyra sama fyrirtæki.
create or replace function public.quotes_same_company() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is not null and not exists (select 1 from public.clients where id = new.client_id and company_id = new.company_id) then
    raise exception 'Viðskiptavinur tilheyrir ekki fyrirtækinu';
  end if;
  if new.job_id is not null and not exists (select 1 from public.jobs where id = new.job_id and company_id = new.company_id) then
    raise exception 'Verk tilheyrir ekki fyrirtækinu';
  end if;
  return new;
end $$;
drop trigger if exists quotes_same_company on public.quotes;
create trigger quotes_same_company before insert or update on public.quotes for each row execute function public.quotes_same_company();

-- Reikningur í Payday verktakans (eigin Payday-tenging fyrirtækisins, company_integrations).
alter table public.jobs add column if not exists payday_invoice_id text;
alter table public.jobs add column if not exists payday_invoice_number int;
