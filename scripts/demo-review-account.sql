-- Prófaðgangur fyrir yfirferð Google Play.
-- Forsenda: búinn að stofna notandann í Supabase → Authentication → Users
-- með netfanginu bjarniludviks+google@icloud.com og lykilorði að eigin vali.
-- Tengir hann við sýnifyrirtækið Kaffi Krónan sem starfsmanninn Phong Ha
-- og birtir vaktaplan fyrir þessa viku og þá næstu.

-- 1) notandi → Kaffi Krónan, hlutverk starfsmaður
insert into users (id, company_id, email, full_name, role)
select a.id, '00000000-0000-0000-0000-0000000000c0', a.email, 'Google Review', 'employee'
from auth.users a
where a.email = 'bjarniludviks+google@icloud.com'
on conflict (id) do update
  set company_id = excluded.company_id, role = excluded.role, full_name = excluded.full_name;

-- 2) tengja við starfsmannaspjald Phong Ha
update employees
   set user_id = (select id from auth.users where email = 'bjarniludviks+google@icloud.com')
 where id = '00000000-0000-0000-0000-0000000e0003';

-- 3) hreinsa eldri vaktir á tímabilinu svo ekkert tvítakist
delete from shifts
 where employee_id = '00000000-0000-0000-0000-0000000e0003'
   and date >= date_trunc('week', current_date)::date
   and date <  date_trunc('week', current_date)::date + 14;

-- 4) vaktaplan: mán–lau þessa viku og þá næstu, frí á sunnudögum
insert into shifts (company_id, location_id, employee_id, shift_type_id, date, start_time, end_time, status, published)
select '00000000-0000-0000-0000-0000000000c0',
       '00000000-0000-0000-0000-0000000000a1',
       '00000000-0000-0000-0000-0000000e0003',
       t.shift_type_id, d::date, t.start_time, t.end_time, 'published', true
from generate_series(date_trunc('week', current_date)::date,
                     date_trunc('week', current_date)::date + 13, interval '1 day') d
join lateral (
  select case extract(isodow from d)
           when 1 then '00000000-0000-0000-0000-0000000000b1'::uuid
           when 2 then '00000000-0000-0000-0000-0000000000b3'::uuid
           when 3 then null::uuid
           when 4 then '00000000-0000-0000-0000-0000000000b1'::uuid
           when 5 then '00000000-0000-0000-0000-0000000000b3'::uuid
           when 6 then '00000000-0000-0000-0000-0000000000b4'::uuid
           else null::uuid end as shift_type_id,
         case extract(isodow from d)
           when 1 then '08:00'::time when 2 then '16:00'::time
           when 4 then '08:00'::time when 5 then '16:00'::time
           when 6 then '12:00'::time else null::time end as start_time,
         case extract(isodow from d)
           when 1 then '16:00'::time when 2 then '24:00'::time
           when 4 then '16:00'::time when 5 then '24:00'::time
           when 6 then '20:00'::time else null::time end as end_time
) t on true
where t.shift_type_id is not null;

-- 5) staðfesting
select e.full_name, u.email, u.role,
       (select count(*) from shifts s where s.employee_id = e.id and s.date >= current_date) as vaktir_framundan
from employees e join users u on u.id = e.user_id
where e.id = '00000000-0000-0000-0000-0000000e0003';
