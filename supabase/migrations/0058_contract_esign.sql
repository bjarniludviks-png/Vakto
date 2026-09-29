-- 0058 — rafræn undirritun ráðningarsamninga án þriðja aðila. Run after 0057.
--
-- Vinnuveitandi undirritar þegar hann sendir (innskráð lota). Starfsmaður staðfestir
-- með 6 stafa kóða sem sendur er á netfang hans. Hver undirskrift skráir tíma, IP,
-- tæki og SHA-256 fingrafar samningstextans — ef textinn breytist eftir sendingu
-- stemmir fingrafarið ekki og undirritun er hafnað.
-- Undirritun starfsmanns fer AÐEINS um þjóninn (þjónustulykill) eftir að kóði er
-- staðfestur, svo gamla reglan sem leyfði starfsmanni að uppfæra stöðu beint fer.

alter table public.contracts
  add column if not exists content_sha256 text,
  add column if not exists employer_signed_at timestamptz,
  add column if not exists employer_signed_by text;

drop policy if exists contracts_own_sign on public.contracts;

-- Sendur/undirritaður samningur er læstur: innskráður notandi (líka stjórnandi) getur
-- ekki breytt texta hans. Kerfið sjálft (þjónustulykill, auth.uid() null) er undanþegið.
create or replace function public.contracts_lock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.status in ('sent', 'signed') and new.content is distinct from old.content then
    raise exception 'CONTRACT_LOCKED' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists contracts_lock on public.contracts;
create trigger contracts_lock before update on public.contracts
  for each row execute function public.contracts_lock();
revoke execute on function public.contracts_lock() from public, anon, authenticated;

create table if not exists public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  signer_role text not null check (signer_role in ('employer', 'employee')),
  signer_name text not null,
  signer_email text,
  user_id uuid,
  method text not null,          -- 'session' (innskráður vinnuveitandi) | 'email_otp' | 'manual'
  doc_sha256 text not null,
  ip text,
  user_agent text,
  signed_at timestamptz not null default now()
);
create index if not exists contract_signatures_contract on public.contract_signatures(contract_id);
alter table public.contract_signatures enable row level security;
drop policy if exists contract_signatures_read on public.contract_signatures;
create policy contract_signatures_read on public.contract_signatures for select to authenticated
  using ((company_id = auth_company_id() and is_manager())
         or exists (select 1 from public.contracts c where c.id = contract_id and c.employee_id = auth_employee_id()));
-- Engar insert/update/delete reglur: aðeins þjónninn skrifar.

create table if not exists public.contract_sign_codes (
  contract_id uuid not null references public.contracts(id) on delete cascade,
  user_id uuid not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  primary key (contract_id, user_id)
);
alter table public.contract_sign_codes enable row level security; -- engar reglur = aðeins þjónninn
