-- 0032 — in-app contract signing (þrep 1 of e-signature).
-- The employee approves their own contract in Mitt svæði: status sent →
-- signed with name + timestamp recorded. Qualified e-signature (Taktikal/
-- Signet) can layer on later without schema changes.

alter table contracts add column if not exists signed_by_name text;
alter table contracts add column if not exists signed_via text;   -- 'inapp' | later: 'taktikal' etc.

-- Employees may update ONLY their own contract and ONLY the sent→signed
-- transition (USING requires status='sent', WITH CHECK requires 'signed').
drop policy if exists contracts_own_sign on contracts;
create policy contracts_own_sign on contracts for update
  using (employee_id = public.auth_employee_id() and status = 'sent')
  with check (employee_id = public.auth_employee_id() and status = 'signed');
