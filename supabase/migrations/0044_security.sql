-- 0044 — öryggislagfæringar fyrir sölu (WASTE-listi D1–D3)
--
-- D1  chat-bucket: lestur var opinn öllum innskráðum notendum þvert á fyrirtæki.
--     Slóðin er "<company_id>/…" (sjá spjall/actions.ts uploadChatMedia) → afmarka við eigið fyrirtæki.
-- D2  kiosk: fyrirtækis-UUID í URL nægði til að sjá starfsfólk og hver er á vakt.
--     Nýr leynilykill companies.kiosk_token; kiosk-slóðin verður /kiosk?k=<token>.
-- D3  auth-trigger gaf nýjum notendum sjálfgefið hlutverkið owner. Sjálfgefið verður employee;
--     nýskráning eiganda sendir role=owner í metadata (nyskraning/actions.ts) og boð senda sitt hlutverk.

-- ---------- D1: chat storage ----------
drop policy if exists chat_read on storage.objects;
create policy chat_read on storage.objects for select to authenticated using (
  bucket_id = 'chat'
  and (storage.foldername(name))[1] = auth_company_id()::text
);
drop policy if exists chat_write on storage.objects;
create policy chat_write on storage.objects for insert to authenticated with check (
  bucket_id = 'chat'
  and (storage.foldername(name))[1] = auth_company_id()::text
);

-- ---------- D2: kiosk token ----------
create extension if not exists pgcrypto;
alter table companies add column if not exists kiosk_token text;
update companies set kiosk_token = encode(gen_random_bytes(16), 'hex') where kiosk_token is null;
alter table companies alter column kiosk_token set not null;
alter table companies alter column kiosk_token set default encode(gen_random_bytes(16), 'hex');
create unique index if not exists companies_kiosk_token_idx on companies(kiosk_token);

-- ---------- D3: default role ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee')
  )
  on conflict (id) do nothing;
  return new;
end $$;
