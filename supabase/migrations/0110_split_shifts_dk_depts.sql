-- 0110 — Fleiri vaktir á dag + deild á vakt + DK-deildarnúmer. Run after 0109.
--
-- Vandinn (Gistihúsið): starfsmaður í morgunmat 7–10 og herbergisþrifum 10–15 sama dag.
-- Planið leyfði eina vakt á dag, svo seinni vaktin skrifaði yfir þá fyrri. Vaktin þekkti heldur ekki
-- sína deild (alltaf aðaldeild starfsmanns), og deildardálkurinn í DK-skránni var alltaf tómur.
--
-- Nú:
--  • shifts.slot: númer vaktar innan dagsins hjá starfsmanni (0 = fyrsta, 1 = önnur …).
--  • shifts.department_id: deild vaktarinnar. Tómt = aðaldeild starfsmanns.
--    Deildin verður að vera á sama stað og vaktin (eða fyrirtækinu ef vaktin er staðlaus).
--  • departments.dk_code: deildarnúmer í dk Laun. DK-útflutningurinn skiptir tímum á deildir.

alter table public.shifts add column if not exists slot smallint not null default 0;
alter table public.shifts add column if not exists department_id uuid references public.departments(id) on delete set null;
alter table public.departments add column if not exists dk_code text;

create index if not exists shifts_emp_date_slot_idx on public.shifts(employee_id, date, slot);

create or replace function public.shift_department_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.department_id is not null and not exists (
    select 1 from departments d join locations l on l.id = d.location_id
     where d.id = new.department_id and l.company_id = new.company_id
  ) then
    raise exception 'Deild tilheyrir ekki fyrirtækinu';
  end if;
  return new;
end $$;
revoke all on function public.shift_department_guard() from public, anon, authenticated;

drop trigger if exists shifts_department_guard on public.shifts;
create trigger shifts_department_guard before insert or update of department_id on public.shifts
  for each row execute function public.shift_department_guard();
