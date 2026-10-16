-- 0082: Lausar vaktir (vakt án starfsmanns, shifts.employee_id IS NULL) sem starfsfólk sækir um.
-- Stjórnandi stofnar lausa vakt í Vaktaplani, starfsmaður sækir um (shift_claims), stjórnandi úthlutar
-- (approve_shift_claim setur starfsmanninn á vaktina og hafnar öðrum umsóknum í einni færslu).

alter table public.shifts add column if not exists note text;

create table if not exists public.shift_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (shift_id, employee_id)
);
create index if not exists shift_claims_company_idx on public.shift_claims(company_id, status);

alter table public.shift_claims enable row level security;

-- Stjórnendur sjá allar umsóknir fyrirtækisins; starfsmaður aðeins sínar.
drop policy if exists shift_claims_read on public.shift_claims;
create policy shift_claims_read on public.shift_claims for select
  using (company_id = public.auth_company_id() and (public.is_manager() or employee_id = public.auth_employee_id()));

-- Starfsmaður sækir um í eigin nafni, aðeins um lausa, birta vakt í eigin fyrirtæki sem er ekki liðin.
drop policy if exists shift_claims_self_insert on public.shift_claims;
create policy shift_claims_self_insert on public.shift_claims for insert
  with check (
    company_id = public.auth_company_id()
    and employee_id = public.auth_employee_id()
    and status = 'pending'
    and exists (
      select 1 from public.shifts s
      where s.id = shift_id and s.company_id = public.auth_company_id()
        and s.employee_id is null and s.published and s.date >= current_date
    )
  );

-- Starfsmaður dregur eigin umsókn til baka (eyðir henni); stjórnendur mega eyða öllum.
drop policy if exists shift_claims_delete on public.shift_claims;
create policy shift_claims_delete on public.shift_claims for delete
  using (company_id = public.auth_company_id() and (public.is_manager() or (employee_id = public.auth_employee_id() and status = 'pending')));

-- Engin UPDATE-regla: úthlutun fer eingöngu um approve_shift_claim.

create or replace function public.approve_shift_claim(p_claim uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.shift_claims%rowtype;
  taken int;
begin
  select * into c from public.shift_claims where id = p_claim for update;
  if not found then raise exception 'CLAIM_NOT_FOUND'; end if;
  if c.company_id is distinct from public.auth_company_id() or not public.is_manager() then
    raise exception 'NOT_ALLOWED';
  end if;
  update public.shifts set employee_id = c.employee_id
    where id = c.shift_id and employee_id is null;
  get diagnostics taken = row_count;
  if taken = 0 then raise exception 'SHIFT_TAKEN'; end if;
  update public.shift_claims set status = 'approved', decided_at = now(), decided_by = auth.uid() where id = c.id;
  update public.shift_claims set status = 'rejected', decided_at = now(), decided_by = auth.uid()
    where shift_id = c.shift_id and id <> c.id and status = 'pending';
  return c.employee_id;
end $$;

revoke all on function public.approve_shift_claim(uuid) from public, anon;
grant execute on function public.approve_shift_claim(uuid) to authenticated;
