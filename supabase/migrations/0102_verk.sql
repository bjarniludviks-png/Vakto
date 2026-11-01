-- 0102 — VAKTO Verk: verktakahamur (verk, viðskiptavinir, tímar á verk, myndir, samþykkt viðskiptavinar).
-- Run after 0101.
--
--   companies.account_kind  'team' (vaktakerfi, sjálfgefið) | 'solo' (verktaki/einyrki — appið sýnir Verk í stað vakta)
--   companies.plan          + 'verktaki' (2.990 kr/mán, sjá src/lib/plans.ts). Eiginleikar eins og Grunnur.
--   clients                 viðskiptavinir verktakans
--   jobs                    verk (heimilisfang + GPS-hnit fyrir innskráningu á verkstað, tímagjald)
--   job_entries             tímar á verk (byrja/stöðva í appi eða skráð handvirkt), km og staðsetning
--   job_items               efni og útlagður kostnaður (aðskilið frá vinnu: 35 % endurgreiðsla VSK af vinnu)
--   job_photos              myndir og athugasemdir á verki
--   job_reports             verkskýrsla send viðskiptavini til samþykktar (opinber hlekkur með token)

-- ---------- 1. Fyrirtæki ----------
alter table public.companies add column if not exists account_kind text not null default 'team';
do $$ begin
  alter table public.companies add constraint companies_account_kind_chk check (account_kind in ('team', 'solo'));
exception when duplicate_object then null; end $$;

alter table public.companies drop constraint if exists companies_plan_chk;
alter table public.companies add constraint companies_plan_chk check (plan in ('free', 'verktaki', 'grunnur', 'voxtur', 'rekstur'));

-- Verktaki = sömu eiginleikar og Grunnur (app, spjall, AI …).
create or replace function public.plan_rank(p text) returns int
language sql immutable set search_path = public as $$
  select case p when 'free' then 0 when 'verktaki' then 1 when 'grunnur' then 1 when 'voxtur' then 2 when 'rekstur' then 3 else 2 end;
$$;

-- ---------- 2. Viðskiptavinir ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  kennitala text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists clients_company_idx on public.clients(company_id, name);

-- ---------- 3. Verk ----------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 200),
  address text,
  lat double precision,
  lng double precision,
  radius_m int not null default 150 check (radius_m between 30 and 2000),
  hourly_rate numeric(12, 2),
  status text not null default 'open' check (status in ('open', 'done', 'archived')),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists jobs_company_idx on public.jobs(company_id, status, created_at desc);

-- ---------- 4. Tímar á verk ----------
create table if not exists public.job_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text,
  km numeric(8, 1) not null default 0 check (km >= 0),
  billable boolean not null default true,
  in_lat double precision, in_lng double precision,
  out_lat double precision, out_lng double precision,
  on_site boolean,             -- innan radíusar verksins við innskráningu (null = engin staðsetning/hnit)
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);
create index if not exists job_entries_job_idx on public.job_entries(job_id, started_at);
create index if not exists job_entries_user_idx on public.job_entries(company_id, user_id, started_at desc);
-- Ein tímataka í gangi á notanda í einu.
create unique index if not exists job_entries_one_running on public.job_entries(user_id) where ended_at is null;

-- ---------- 5. Efni og útlagður kostnaður ----------
create table if not exists public.job_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid default auth.uid() references public.users(id) on delete set null,
  kind text not null default 'material' check (kind in ('material', 'expense')),
  description text not null check (length(btrim(description)) between 1 and 300),
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  receipt_url text,
  date date not null default (now() at time zone 'Atlantic/Reykjavik')::date,
  created_at timestamptz not null default now()
);
create index if not exists job_items_job_idx on public.job_items(job_id, date);

-- ---------- 6. Myndir ----------
create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid default auth.uid() references public.users(id) on delete set null,
  url text not null,
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists job_photos_job_idx on public.job_photos(job_id, created_at);

-- ---------- 7. Verkskýrslur til samþykktar ----------
create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  period_from date not null,
  period_to date not null,
  snapshot jsonb not null,      -- tímar, efni, myndir og upphæðir eins og þau voru send (breytast ekki eftir á)
  status text not null default 'sent' check (status in ('sent', 'approved', 'rejected')),
  signed_name text,
  client_comment text,
  decided_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists job_reports_job_idx on public.job_reports(job_id, created_at desc);

-- ---------- 8. Aðgangur ----------
-- Allir í fyrirtækinu sjá verk og viðskiptavini þess. Stjórnendur (owner/manager) og verktakar stofna og breyta;
-- hver notandi skráir eigin tíma, stjórnendur sjá og laga alla. Samþykktarsíðan les job_reports með service role.
alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.job_entries enable row level security;
alter table public.job_items enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_reports enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clients', 'jobs', 'job_items', 'job_photos', 'job_reports'] loop
    execute format('drop policy if exists %1$s_read on public.%1$I', t);
    execute format('create policy %1$s_read on public.%1$I for select using (company_id = public.auth_company_id())', t);
    execute format('drop policy if exists %1$s_write on public.%1$I', t);
    execute format($p$create policy %1$s_write on public.%1$I for all
      using (company_id = public.auth_company_id() and public.auth_role() in ('owner', 'manager', 'contractor'))
      with check (company_id = public.auth_company_id() and public.auth_role() in ('owner', 'manager', 'contractor'))$p$, t);
  end loop;
end $$;

drop policy if exists job_entries_read on public.job_entries;
create policy job_entries_read on public.job_entries for select
  using (company_id = public.auth_company_id() and (user_id = auth.uid() or public.auth_role() in ('owner', 'manager')));
drop policy if exists job_entries_own on public.job_entries;
create policy job_entries_own on public.job_entries for all
  using (company_id = public.auth_company_id() and (user_id = auth.uid() or public.auth_role() in ('owner', 'manager')))
  with check (company_id = public.auth_company_id() and (user_id = auth.uid() or public.auth_role() in ('owner', 'manager')));

-- Innskráning á verkstað: on_site reiknað út frá hnitum verksins (haversine) — viðskiptavinurinn sér það í skýrslunni.
create or replace function public.job_entries_on_site() returns trigger
language plpgsql set search_path = public as $$
declare j record; d double precision;
begin
  if new.in_lat is null or new.in_lng is null then new.on_site := null; return new; end if;
  select lat, lng, radius_m into j from public.jobs where id = new.job_id;
  if j.lat is null or j.lng is null then new.on_site := null; return new; end if;
  d := 2 * 6371000 * asin(sqrt(power(sin(radians(new.in_lat - j.lat) / 2), 2)
       + cos(radians(j.lat)) * cos(radians(new.in_lat)) * power(sin(radians(new.in_lng - j.lng) / 2), 2)));
  new.on_site := d <= j.radius_m;
  return new;
end $$;
drop trigger if exists job_entries_on_site on public.job_entries;
create trigger job_entries_on_site before insert or update of in_lat, in_lng, job_id on public.job_entries
  for each row execute function public.job_entries_on_site();

-- Verk/viðskiptavinur verður að tilheyra sama fyrirtæki og röðin (ekki hægt að tengja við verk annars fyrirtækis).
create or replace function public.verk_same_company() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'jobs' then
    if new.client_id is not null and not exists (select 1 from public.clients where id = new.client_id and company_id = new.company_id) then
      raise exception 'Viðskiptavinur tilheyrir ekki fyrirtækinu';
    end if;
  elsif not exists (select 1 from public.jobs where id = new.job_id and company_id = new.company_id) then
    raise exception 'Verk tilheyrir ekki fyrirtækinu';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['jobs', 'job_entries', 'job_items', 'job_photos', 'job_reports'] loop
    execute format('drop trigger if exists %1$s_same_company on public.%1$I', t);
    execute format('create trigger %1$s_same_company before insert or update on public.%1$I for each row execute function public.verk_same_company()', t);
  end loop;
end $$;
