-- 0090 — Tengd forrit (MCP): Claude, ChatGPT o.fl. fá LESaðgang að gögnum fyrirtækis gegnum
-- /api/mcp, eftir OAuth-samþykki stjórnanda. Allar töflurnar eru aðeins fyrir service-role
-- (RLS á, engar reglur): appið les þær gegnum þjóninn, aldrei beint.

-- Stjórnandi (eigandi) kveikir á þessu fyrir fyrirtækið. Sjálfgefið slökkt.
alter table public.companies add column if not exists ai_external boolean not null default false;

-- Forrit sem skrá sig sjálf (OAuth Dynamic Client Registration, RFC 7591).
create table if not exists public.oauth_clients (
  id text primary key,
  name text not null,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

-- Einnota heimildarkóðar (10 mín), PKCE S256.
create table if not exists public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  expires_at timestamptz not null
);

-- Ein tenging = eitt forrit hjá einum notanda. Okkar lyklar eru geymdir sem SHA-256;
-- Supabase-lota tengingarinnar (sér lota, ekki vafralota notandans) er dulkóðuð og fer aldrei út.
create table if not exists public.mcp_grants (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.oauth_clients(id) on delete cascade,
  client_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  access_hash text unique,
  access_expires_at timestamptz,
  refresh_hash text unique not null,
  sb_refresh_enc text not null,
  sb_access_enc text,
  sb_access_exp timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists mcp_grants_company on public.mcp_grants(company_id);

alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.mcp_grants enable row level security;
revoke all on public.oauth_clients, public.oauth_codes, public.mcp_grants from anon, authenticated;
