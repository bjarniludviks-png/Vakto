-- Company-wide shared documents (HACCP, handbooks, safety manuals …).
-- A shared doc is a documents row WITHOUT an employee: employee_id is null.
alter table documents alter column employee_id drop not null;

-- Employees may read their company's shared documents (managers already can).
drop policy if exists documents_shared_read on documents;
create policy documents_shared_read on documents for select
  using (employee_id is null and company_id = public.auth_company_id());
