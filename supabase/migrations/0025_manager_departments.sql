-- 0025 — managers/shift-leads scoped to the departments they oversee. Run after 0024.
-- Stored as department NAMES (the whole app filters by department name, not id), so
-- this needs no joins and matches the existing data flow. Empty/null = sees everything.
alter table employees add column if not exists oversees_departments text[];

-- Existing employees start unscoped (null) → owners/managers keep seeing all departments
-- until someone assigns specific departments in the profile.
