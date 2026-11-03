-- 0108 — „Yfirgefa hóp / eyða samtali“ virkar eins og í Messenger. Run after 0107.
--
-- Vandinn: channels_read hleypti STOFNANDA rásar alltaf að henni (created_by = auth.uid()). Sá sem
-- stofnaði hóp og ýtti á „Yfirgefa“ missti aðildina (channel_members-röðinni var eytt) en sá hópinn
-- áfram í listanum — ekkert virtist gerast. Sama um einkaspjall sem maður hóf sjálfur.
--
-- Nú:
--  • Stofnandi sér rás án aðildar AÐEINS á meðan hún er ný og meðlimalaus (insert … returning, áður en
--    meðlimir eru skráðir). Eftir það ræður aðild eingöngu (+ „Almennt“).
--  • Þegar síðasti meðlimur yfirgefur hóp/einkaspjall er rásinni eytt (skilaboð fylgja, cascade) — þá
--    situr ekkert eftir sem enginn sér. Gildir um allar útgáfur appsins, því trigger sér um það.
--  • Eyða hóp fyrir alla: channels_del (0014) leyfir stofnanda og stjórnendum það þegar.

create or replace function public.channel_has_members(cid uuid) returns boolean
  language sql security definer stable set search_path = public as
$$ select exists (select 1 from channel_members m where m.channel_id = cid) $$;
revoke all on function public.channel_has_members(uuid) from public, anon;
grant execute on function public.channel_has_members(uuid) to authenticated;

drop policy if exists channels_read on public.channels;
create policy channels_read on public.channels for select using (
  company_id = public.auth_company_id()
  and (
    kind = 'general'
    or public.is_channel_member(id)
    or (created_by = auth.uid() and not public.channel_has_members(id))
  )
);

create or replace function public.drop_empty_channel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from channel_members m where m.channel_id = old.channel_id) then
    delete from channels c
     where c.id = old.channel_id and c.kind in ('group', 'dm') and c.auto_key is null;
  end if;
  return null;
end;
$$;
revoke all on function public.drop_empty_channel() from public, anon, authenticated;
drop trigger if exists channel_members_drop_empty on public.channel_members;
create trigger channel_members_drop_empty after delete on public.channel_members
  for each row execute function public.drop_empty_channel();

-- ---------------------------------------------------------------------------------------------
-- Aðrir „hnappar sem gera ekkert“ í spjallinu (úttekt 3. nóv. 2026):

-- (a) Sjálfvirk þýðing: 0076 tók skrifheimild á users af innskráðum, svo rofinn vistaðist aldrei
--     (hvorki á vef né í appi). Eigin stilling fer nú um þetta fall.
create or replace function public.set_chat_translate(v text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or v not in ('on', 'off') then return false; end if;
  update users set chat_translate = v where id = auth.uid();
  return found;
end;
$$;
revoke all on function public.set_chat_translate(text) from public, anon;
grant execute on function public.set_chat_translate(text) to authenticated;

-- (b) Eyða eigin skilaboðum sem maður hafði sjálfur svarað: reply_to = on delete set null uppfærir
--     svarið, og 0100-vörðurinn hafnaði þeirri breytingu → öll eyðingin rúllaði til baka. Nú má
--     reply_to fara í null (kerfisbreyting), en ekki breytast í annað.
create or replace function public.guard_message_edit() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() is distinct from old.sender_id then return new; end if;
  if new.id is distinct from old.id or new.company_id is distinct from old.company_id
     or new.channel_id is distinct from old.channel_id or new.sender_id is distinct from old.sender_id
     or new.kind is distinct from old.kind or new.attachment_url is distinct from old.attachment_url
     or new.created_at is distinct from old.created_at
     or (new.reply_to is distinct from old.reply_to and new.reply_to is not null) then
    raise exception 'Aðeins má breyta texta skilaboða';
  end if;
  if new.body is distinct from old.body then
    if coalesce(btrim(new.body), '') = '' then raise exception 'Skilaboð mega ekki vera tóm'; end if;
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end $$;

-- (c) Bæta í spjall: fólk sem vinnur hjá fleiri en einu fyrirtæki er með users.company_id á öðru
--     fyrirtæki en rásin — þá féll öll innsetning meðlima (líka stofnandans) og eftir sat tóm rás.
--     Aðild að fyrirtækinu (company_members) gildir nú líka.
create or replace function public.can_add_channel_member(p_channel uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channels c
    where c.id = p_channel and c.company_id = auth_company_id()
      and (
        exists (select 1 from users u where u.id = p_user and u.company_id = c.company_id)
        or exists (select 1 from company_members cm where cm.user_id = p_user and cm.company_id = c.company_id)
      )
      and (
        c.created_by = auth.uid() or is_manager()
        or (c.kind = 'group' and c.auto_key is null and is_channel_member(c.id))
      )
  );
$$;
revoke all on function public.can_add_channel_member(uuid, uuid) from public, anon;
grant execute on function public.can_add_channel_member(uuid, uuid) to authenticated;

-- (d) Þögguð spjöll: áður aðeins geymd í símanum, svo push-tilkynningar komu áfram. Nú veit þjónninn af
--     þögguninni (lib/chat-push.server.ts sleppir þeim); @-merking nær samt í gegn eins og í Messenger.
create table if not exists public.chat_mutes (
  user_id uuid not null references public.users(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);
alter table public.chat_mutes enable row level security;
drop policy if exists chat_mutes_own on public.chat_mutes;
create policy chat_mutes_own on public.chat_mutes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_channel_member(channel_id));
