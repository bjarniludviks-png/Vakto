-- ============================================================
-- VAKTO — Supabase Storage buckets for employee documents & photos.
-- Path convention: <company_id>/<employee_id>/<filename>
-- Run after 0005. Storage RLS lives on storage.objects.
-- ============================================================

-- Buckets: documents is private (signed URLs), avatars is public.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- ---------- documents (private): managers in the company ----------
drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select
  using (
    bucket_id = 'documents'
    and public.is_manager()
    and (storage.foldername(name))[1] = public.auth_company_id()::text
  );

drop policy if exists documents_write on storage.objects;
create policy documents_write on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and public.is_manager()
    and (storage.foldername(name))[1] = public.auth_company_id()::text
  );

drop policy if exists documents_delete on storage.objects;
create policy documents_delete on storage.objects for delete
  using (
    bucket_id = 'documents'
    and public.is_manager()
    and (storage.foldername(name))[1] = public.auth_company_id()::text
  );

-- ---------- avatars (public read): self or managers may write ----------
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.auth_company_id()::text
    and (
      public.is_manager()
      or (storage.foldername(name))[2] = public.auth_employee_id()::text
    )
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.auth_company_id()::text
    and (
      public.is_manager()
      or (storage.foldername(name))[2] = public.auth_employee_id()::text
    )
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.auth_company_id()::text
    and (
      public.is_manager()
      or (storage.foldername(name))[2] = public.auth_employee_id()::text
    )
  );
