-- 0094 — starfsmaður í fleiri en einni deild. Run after 0093.
-- department_id er áfram aðaldeildin (laun, skýrslur, spjallrásir); extra_departments eru heiti
-- annarra deilda sem hann vinnur líka í — vaktaplanið sýnir hann undir þeim öllum.
-- Sama snið og oversees_departments (0025): heiti, ekki id. Starfsmaður breytir þessu ekki sjálfur
-- (guard_employee_self_update í 0076 leyfir aðeins tilgreinda dálka).
alter table public.employees add column if not exists extra_departments text[] not null default '{}';
