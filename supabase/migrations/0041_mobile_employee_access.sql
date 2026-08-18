-- 0041: Mobile app employee access
-- The Expo app talks to Supabase directly with the anon key (no Next.js server
-- actions), so employees need RLS for the flows the web routes through
-- service-role code today:
--   1. employees can read their OWN employee row even when users.company_id
--      is not set (the web falls back to the admin client for this)
--   2. employees can clock in/out from the app (punches self insert + update
--      of their own open punch) — kiosk stays service-role
--   3. employees can read company-shared documents and their own folder in
--      the private `documents` storage bucket (needed for createSignedUrl)

-- 1) employees: self-read by auth link
drop policy if exists employees_self_read on public.employees;
create policy employees_self_read on public.employees
  for select using (user_id = auth.uid());

-- 2) punches: self clock-in / clock-out
drop policy if exists punches_self_insert on public.punches;
create policy punches_self_insert on public.punches
  for insert with check (
    employee_id = public.auth_employee_id()
    and company_id = (
      select e.company_id from public.employees e
      where e.id = public.auth_employee_id()
    )
  );

drop policy if exists punches_self_update on public.punches;
create policy punches_self_update on public.punches
  for update using (employee_id = public.auth_employee_id())
  with check (employee_id = public.auth_employee_id());

-- 3) storage: employees read shared company docs + their own folder
--    (path convention: <company_id>/shared/<file> and <company_id>/<employee_id>/<file>)
drop policy if exists "documents employee read" on storage.objects;
create policy "documents employee read" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (
      select e.company_id::text from public.employees e
      where e.id = public.auth_employee_id()
    )
    and (
      (storage.foldername(name))[2] = 'shared'
      or (storage.foldername(name))[2] = public.auth_employee_id()::text
    )
  );
