-- 0043: Realtime for chat — messages (and channel renames/photos) stream to
-- clients instantly instead of 4s polling. RLS still governs what each
-- subscriber may see (postgres_changes respects policies).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.channels;
exception when duplicate_object then null;
end $$;
