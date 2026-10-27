-- 0095 — Aðgangur stjórnenda per notanda (eigandinn velur). Run after 0093 (0094 frátekin annarri grein).
--
-- Áður: fast hlutverkafylki — stjórnandi (manager) sá aldrei Launakeyrslur, sama hvað eigandinn vildi.
-- Nú: users.permissions jsonb = { "launakeyrslur": true, "stillingar": false, … }. null / lykill vantar
-- = sjálfgefið fyrir hlutverkið (óbreytt hegðun fyrir alla núverandi notendur).
--   owner      → alltaf allt (permissions hunsað).
--   manager    → sjálfgefið allt NEMA launakeyrslur; eigandinn getur kveikt/slökkt per svæði.
--   employee / contractor → aldrei stjórnendasvæði (permissions hunsað).
-- Notandi getur EKKI breytt eigin aðgangi: skrif í users fara aðeins um service-role (0076),
-- og vistunaraðgerð eigandans sannreynir að kallandi sé eigandi sama fyrirtækis.
-- company_members.permissions geymir aðganginn per fyrirtæki svo hann fylgi við „Skipta um félag".

alter table public.users add column if not exists permissions jsonb;
alter table public.company_members add column if not exists permissions jsonb;

-- Má innskráður notandi opna svæðið? Sama regla og src/lib/user-permissions.ts (resolveAccess).
create or replace function public.has_perm(p_area text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case u.role
      when 'owner' then true
      when 'manager' then coalesce(
        case when jsonb_typeof(u.permissions -> p_area) = 'boolean' then (u.permissions ->> p_area)::boolean end,
        p_area in ('maelabord', 'vaktaplan', 'timaskraning', 'starfsfolk', 'innsyn', 'stillingar')
      )
      else false
    end
    from public.users u where u.id = auth.uid()
  ), false);
$$;
revoke execute on function public.has_perm(text) from public, anon;
grant execute on function public.has_perm(text) to authenticated, service_role;

-- Laun: áður aðeins eigandi (is_owner). Nú eigandi + stjórnandi sem hefur fengið „launakeyrslur".
-- has_perm('launakeyrslur') er true fyrir eiganda og false fyrir alla aðra nema eigandinn veiti það,
-- svo án breyttra heimilda er reglan nákvæmlega sú sama og áður.
drop policy if exists payroll_runs_owner on public.payroll_runs;
drop policy if exists payroll_runs_access on public.payroll_runs;
create policy payroll_runs_access on public.payroll_runs for all
  using (company_id = public.auth_company_id() and public.has_perm('launakeyrslur'))
  with check (company_id = public.auth_company_id() and public.has_perm('launakeyrslur'));

drop policy if exists payroll_lines_owner on public.payroll_lines;
drop policy if exists payroll_lines_access on public.payroll_lines;
create policy payroll_lines_access on public.payroll_lines for all
  using (exists (select 1 from public.payroll_runs r where r.id = run_id and r.company_id = public.auth_company_id() and public.has_perm('launakeyrslur')))
  with check (exists (select 1 from public.payroll_runs r where r.id = run_id and r.company_id = public.auth_company_id() and public.has_perm('launakeyrslur')));
