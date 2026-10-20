-- 0087 — Opna demoið (Kaffi Sól) er AÐEINS til skoðunar. Run after 0086 (óháð henni).
--
-- RESTRICTIVE RLS-reglur: notandi í demo-fyrirtækinu (companies.admin_note = 'public-demo',
-- sama merki og næturkeyrslan /api/cron/demo-reset krefst) getur ekki INSERT/UPDATE/DELETE
-- í neinni töflu í public né í Storage — ekki heldur með beinum supabase-js köllum úr vafranum.
--   * SELECT er óbreytt (engin regla fyrir select).
--   * service_role (næturkeyrsla, bootstrap, AI-talning) fer framhjá RLS → óbreytt.
--   * Aðrir notendur: is_demo_user() = false → reglan er alltaf sönn.
--   * Auk þess BEFORE-statement-gikkur `demo_readonly_guard` á sömu töflum: grípur líka skrif
--     sem fara framhjá RLS innan SECURITY DEFINER-falla (t.d. approve_shift_claim,
--     respond_work_overview) og gefur skýr skilaboð í stað „0 raða" við UPDATE/DELETE.
--     Einu sinni per setningu (ekki per röð) → hverfandi kostnaður.
-- Undanþegnar töflur (skrif í demo leyfð):
--   ai_conversations, ai_messages — saga VAKTO AI-spurninga (spurningar eru leyfðar í demo)
--   support_threads, support_messages, site_visits, email_verifications — ótengt fyrirtæki
--
-- Örugg endurkeyrsla. Nýjar töflur í síðari migrations: keyra `select public.apply_demo_readonly();`
-- í lok þeirrar migration (fallið bætir aðeins við reglum sem vantar).

create or replace function public.is_demo_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.companies c on c.id = u.company_id
    where u.id = auth.uid() and c.admin_note = 'public-demo'
  );
$$;

revoke all on function public.is_demo_user() from public;
grant execute on function public.is_demo_user() to authenticated, anon, service_role;

create or replace function public.demo_readonly_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_demo_user() then
    raise exception using
      errcode = '42501',
      message = 'Demo er aðeins til skoðunar — stofnaðu eigið fyrirtæki til að prófa breytingar (14 daga frí prufa).';
  end if;
  return null;
end;
$$;

create or replace function public.apply_demo_readonly()
returns integer
language plpgsql
set search_path = public
as $$
declare
  t record;
  n integer := 0;
  exempt text[] := array['ai_conversations', 'ai_messages', 'support_threads', 'support_messages', 'site_visits', 'email_verifications'];
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and c.relname <> all (exempt)
  loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'demo_readonly_insert') then
      execute format('create policy demo_readonly_insert on public.%I as restrictive for insert to authenticated with check (not (select public.is_demo_user()))', t.relname);
      n := n + 1;
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'demo_readonly_update') then
      execute format('create policy demo_readonly_update on public.%I as restrictive for update to authenticated using (not (select public.is_demo_user())) with check (not (select public.is_demo_user()))', t.relname);
      n := n + 1;
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'demo_readonly_delete') then
      execute format('create policy demo_readonly_delete on public.%I as restrictive for delete to authenticated using (not (select public.is_demo_user()))', t.relname);
      n := n + 1;
    end if;
    if not exists (select 1 from pg_trigger where tgrelid = format('public.%I', t.relname)::regclass and tgname = 'demo_readonly_guard') then
      execute format('create trigger demo_readonly_guard before insert or update or delete on public.%I for each statement execute function public.demo_readonly_guard()', t.relname);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke all on function public.apply_demo_readonly() from public, anon, authenticated;

select public.apply_demo_readonly();

-- Storage (avatars, chat, documents): engar upphleðslur/breytingar/eyðingar úr demo.
drop policy if exists demo_readonly_insert on storage.objects;
create policy demo_readonly_insert on storage.objects as restrictive for insert to authenticated
  with check (not (select public.is_demo_user()));
drop policy if exists demo_readonly_update on storage.objects;
create policy demo_readonly_update on storage.objects as restrictive for update to authenticated
  using (not (select public.is_demo_user())) with check (not (select public.is_demo_user()));
drop policy if exists demo_readonly_delete on storage.objects;
create policy demo_readonly_delete on storage.objects as restrictive for delete to authenticated
  using (not (select public.is_demo_user()));
