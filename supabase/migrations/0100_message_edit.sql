-- 0100 — Breyta eigin spjallskilaboðum. Run after 0099.
--
-- Sendandi má breyta texta eigin textaskilaboða (ekki myndum/skjölum). Aðeins body breytist;
-- edited_at er sett í trigger svo allir sjái „Breytt“. Aðrir dálkar eru læstir fyrir sendandann.

alter table public.messages add column if not exists edited_at timestamptz;

drop policy if exists messages_own_update on public.messages;
create policy messages_own_update on public.messages
  for update using (sender_id = auth.uid() and kind = 'text')
  with check (sender_id = auth.uid() and kind = 'text');

create or replace function public.guard_message_edit() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Aðeins breytingar sendandans sjálfs (RLS hleypir engum öðrum notanda að). Kerfisuppfærslur,
  -- t.d. sender_id → null þegar aðgangi er eytt (on delete set null), fara óhindraðar í gegn.
  if auth.uid() is null or auth.uid() is distinct from old.sender_id then return new; end if;
  if new.id is distinct from old.id or new.company_id is distinct from old.company_id
     or new.channel_id is distinct from old.channel_id or new.sender_id is distinct from old.sender_id
     or new.kind is distinct from old.kind or new.attachment_url is distinct from old.attachment_url
     or new.created_at is distinct from old.created_at or new.reply_to is distinct from old.reply_to then
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

drop trigger if exists messages_guard_edit on public.messages;
create trigger messages_guard_edit before update on public.messages
  for each row execute function public.guard_message_edit();
