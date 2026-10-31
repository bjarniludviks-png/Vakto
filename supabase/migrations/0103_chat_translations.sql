-- 0103 — Sjálfvirk þýðing spjalls. Run after 0102 (eða 0101 ef 0102 er ekki komin).
--
--   message_translations   þýðing skilaboða per tungumál, vistuð svo hver skilaboð séu þýdd einu sinni
--                          (body null = skilaboðin eru þegar á því tungumáli). Skrifað af þjóninum (service role).
--   users.chat_translate   'on' | 'off' | null (null = sjálfgefið: kveikt ef viðmótið er ekki á íslensku)

create table if not exists public.message_translations (
  message_id uuid not null references public.messages(id) on delete cascade,
  lang text not null check (lang in ('is', 'en', 'vi', 'pl')),
  body text,
  created_at timestamptz not null default now(),
  primary key (message_id, lang)
);
alter table public.message_translations enable row level security;
-- Sá sem má lesa skilaboðin má lesa þýðinguna (undirfyrirspurnin keyrir með RLS messages).
drop policy if exists message_translations_read on public.message_translations;
create policy message_translations_read on public.message_translations for select
  using (exists (select 1 from public.messages m where m.id = message_id));

alter table public.users add column if not exists chat_translate text;
do $$ begin
  alter table public.users add constraint users_chat_translate_chk check (chat_translate in ('on', 'off'));
exception when duplicate_object then null; end $$;

-- Breytt skilaboð (0100): gömlu þýðingarnar eiga ekki lengur við.
create or replace function public.message_translations_reset() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.body is distinct from old.body then delete from public.message_translations where message_id = new.id; end if;
  return new;
end $$;
drop trigger if exists messages_translations_reset on public.messages;
create trigger messages_translations_reset after update of body on public.messages
  for each row execute function public.message_translations_reset();
