-- 1) Kiosk: misheppnaðar tilraunir (PIN / kennitala) svo hægt sé að læsa eftir of margar.
--    Aðeins þjónninn (service role) les og skrifar — RLS á, engar reglur.
create table if not exists kiosk_fails (
  id bigint generated always as identity primary key,
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid,                       -- null = kennitöluinnsláttur (óþekktur starfsmaður)
  at timestamptz not null default now()
);
create index if not exists kiosk_fails_idx on kiosk_fails(company_id, employee_id, at desc);
alter table kiosk_fails enable row level security;

-- 2) Tilkynnt efni (spjall, fréttaveita, athugasemdir) og lokað á notendur — krafa app-verslana
--    fyrir efni frá notendum. Starfsmaður tilkynnir; stjórnendur fyrirtækisins sjá tilkynningarnar.
create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('message', 'post', 'comment')),
  ref_id uuid not null,
  author_id uuid,
  excerpt text not null default '',
  reason text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (reporter_id, kind, ref_id)
);
create index if not exists content_reports_company_idx on content_reports(company_id, status, created_at desc);
alter table content_reports enable row level security;
drop policy if exists content_reports_insert on content_reports;
create policy content_reports_insert on content_reports for insert to authenticated
  with check (reporter_id = auth.uid() and company_id = public.auth_company_id());
drop policy if exists content_reports_read on content_reports;
create policy content_reports_read on content_reports for select to authenticated
  using (company_id = public.auth_company_id() and (public.is_manager() or reporter_id = auth.uid()));
drop policy if exists content_reports_manage on content_reports;
create policy content_reports_manage on content_reports for update to authenticated
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());

create table if not exists user_blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id)
);
alter table user_blocks enable row level security;
drop policy if exists user_blocks_own on user_blocks;
create policy user_blocks_own on user_blocks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
