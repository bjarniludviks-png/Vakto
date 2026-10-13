-- 0068 — VAKTO-teymið (starfsfólk VAKTO með aðgang að /admin). Run after 0001–0067.
--
-- Hingað til réð aðeins env-breytan VAKTO_ADMIN_EMAILS hverjir komast inn á
-- admin.vakto.is. Hún gildir áfram (eigendur — alltaf inni, líka ef taflan
-- tæmist), en nú getur eigandi boðið samstarfsfólki aðgang úr Stillingum.
--   role 'owner' = má bjóða/fjarlægja fólk · 'staff' = allt annað í /admin.
-- Skrifað og lesið EINGÖNGU með service-role úr src/app/admin — aldrei af leigjendum.
create table if not exists platform_admins (
  email text primary key,                       -- lágstafir
  full_name text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  invited_by text,                              -- netfang þess sem bauð
  created_at timestamptz not null default now()
);

-- Deny-all RLS: engar reglur, svo anon/authenticated komast hvorki í lestur né skrif.
alter table platform_admins enable row level security;
revoke all on table platform_admins from anon, authenticated;

-- Eina leið innskráðs notanda að töflunni: „er ÉG í teyminu?“ (já/nei).
-- Notað í proxy/middleware þar sem service-role lykillinn á ekki heima.
create or replace function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from platform_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function is_platform_admin() from public, anon;
grant execute on function is_platform_admin() to authenticated;
