-- 0052: ein vaktategund per nafn í hverju fyrirtæki (kemur í veg fyrir tvítekningar
-- þegar sjálfgefnar tegundir eru vistaðar samhliða). Tvítekningar sem þegar eru
-- til: vaktir færðar á elstu tegundina og hinar fjarlægðar.
with ranked as (
  select id, company_id, name as lname,
         first_value(id) over (partition by company_id, name order by id) as keep_id
  from shift_types
),
dupes as (select id, keep_id from ranked where id <> keep_id)
update shifts s set shift_type_id = d.keep_id from dupes d where s.shift_type_id = d.id;

with ranked as (
  select id, company_id, name as lname,
         first_value(id) over (partition by company_id, name order by id) as keep_id
  from shift_types
)
delete from shift_types where id in (select id from ranked where id <> keep_id);

create unique index if not exists shift_types_company_name_idx on shift_types(company_id, name);
