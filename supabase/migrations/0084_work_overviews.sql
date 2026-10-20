-- 0084 — Vinnuyfirlit: undirritað mánaðaryfirlit per starfsmann (tímar, vaktir, launaliðir).
-- Run after 0083 (0083 = payment_method, PR #32).
--
-- Flæði: stjórnandi býr til yfirlit fyrir tímabil (draft) → sendir til staðfestingar (sent) →
-- starfsmaður staðfestir (employee_approved) eða gerir athugasemd (employee_flagged) →
-- stjórnandi staðfestir (final). Við final er PDF með fingrafari (SHA-256) og staðfestingarskrá
-- vistað í skjalasafn starfsmannsins (documents + private `documents` bucket).
--
-- snapshot = útreiknaðar línur og samtölur (sami launaútreikningur og launakeyrslan) á þeim tíma
-- sem yfirlitið var búið til. log = staðfestingarskrá [{at, by, name, action, note}].
--
-- Aðgangur:
--   stjórnendur (owner/manager) lesa og skrifa yfirlit síns fyrirtækis;
--   starfsmaður les eigin yfirlit (ekki drög) og svarar AÐEINS gegnum respond_work_overview().
--   Vörður (trigger) tryggir að stjórnandi geti ekki skráð svar starfsmanns né breytt lokuðu yfirliti.

create table if not exists public.work_overviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'employee_approved', 'employee_flagged', 'final')),
  employee_comment text,
  employee_approved_at timestamptz,
  employee_flagged_at timestamptz,
  manager_comment text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_by uuid references public.users(id) on delete set null,
  sent_at timestamptz,
  manager_id uuid references public.users(id) on delete set null,
  final_at timestamptz,
  document_id uuid references public.documents(id) on delete set null,
  fingerprint text,
  log jsonb not null default '[]'::jsonb,
  unique (company_id, employee_id, period_start, period_end),
  check (period_end >= period_start)
);
create index if not exists work_overviews_company_idx on public.work_overviews(company_id, period_start desc);
create index if not exists work_overviews_employee_idx on public.work_overviews(employee_id, period_start desc);

alter table public.work_overviews enable row level security;

drop policy if exists work_overviews_read on public.work_overviews;
create policy work_overviews_read on public.work_overviews for select
  using (company_id = public.auth_company_id()
         and (public.is_manager() or (employee_id = (select public.auth_employee_id()) and status <> 'draft')));

drop policy if exists work_overviews_manager_insert on public.work_overviews;
create policy work_overviews_manager_insert on public.work_overviews for insert
  with check (company_id = public.auth_company_id() and public.is_manager());

drop policy if exists work_overviews_manager_update on public.work_overviews;
create policy work_overviews_manager_update on public.work_overviews for update
  using (company_id = public.auth_company_id() and public.is_manager())
  with check (company_id = public.auth_company_id() and public.is_manager());

drop policy if exists work_overviews_manager_delete on public.work_overviews;
create policy work_overviews_manager_delete on public.work_overviews for delete
  using (company_id = public.auth_company_id() and public.is_manager() and status <> 'final');

-- Vörður: svar starfsmanns kemur aðeins úr respond_work_overview(); lokað yfirlit breytist ekki.
-- Service-role (auth.uid() er null) fer framhjá.
create or replace function public.guard_work_overview() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if old.status = 'final' then
    raise exception 'WORK_OVERVIEW_FINAL: yfirlitið er staðfest og verður ekki breytt' using errcode = '42501';
  end if;
  if coalesce(current_setting('vakto.wo_employee', true), '') <> '1' then
    if (new.status in ('employee_approved', 'employee_flagged') and new.status is distinct from old.status)
       or new.employee_comment is distinct from old.employee_comment
       or new.employee_approved_at is distinct from old.employee_approved_at
       or new.employee_flagged_at is distinct from old.employee_flagged_at then
      -- Endurgerð/endursending núllstillir svarið (draft/sent) — það er leyft.
      if not (new.status in ('draft', 'sent') and new.employee_approved_at is null and new.employee_flagged_at is null) then
        raise exception 'WORK_OVERVIEW_EMPLOYEE_ONLY: aðeins starfsmaðurinn getur staðfest yfirlitið' using errcode = '42501';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists work_overviews_guard on public.work_overviews;
create trigger work_overviews_guard before update on public.work_overviews
  for each row execute function public.guard_work_overview();

-- Starfsmaður staðfestir (p_approve = true) eða gerir athugasemd (false, p_comment áskilin).
create or replace function public.respond_work_overview(p_id uuid, p_approve boolean, p_comment text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  w public.work_overviews%rowtype;
  me uuid := public.auth_employee_id();
  who text;
  note text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  select * into w from public.work_overviews where id = p_id for update;
  if not found or me is null or w.employee_id <> me then raise exception 'NOT_ALLOWED'; end if;
  if w.status <> 'sent' then raise exception 'NOT_PENDING'; end if;
  if not p_approve and note is null then raise exception 'COMMENT_REQUIRED'; end if;
  select full_name into who from public.employees where id = me;
  perform set_config('vakto.wo_employee', '1', true);
  update public.work_overviews set
    status = case when p_approve then 'employee_approved' else 'employee_flagged' end,
    employee_comment = left(note, 2000),
    employee_approved_at = case when p_approve then now() else null end,
    employee_flagged_at = case when p_approve then null else now() end,
    log = log || jsonb_build_array(jsonb_build_object(
      'at', now(), 'by', auth.uid(), 'name', who,
      'action', case when p_approve then 'employee_approved' else 'employee_flagged' end,
      'note', left(note, 2000)))
  where id = p_id;
  perform set_config('vakto.wo_employee', '', true);
  return case when p_approve then 'employee_approved' else 'employee_flagged' end;
end;
$$;

revoke all on function public.respond_work_overview(uuid, boolean, text) from public, anon;
grant execute on function public.respond_work_overview(uuid, boolean, text) to authenticated;
