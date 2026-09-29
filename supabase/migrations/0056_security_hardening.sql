-- 0056 — öryggistiltekt eftir Supabase security advisor (29.9.2026). Run after 0055.
--
-- SECURITY DEFINER hjálparföll voru keyranleg af óinnskráðum (anon) gegnum
-- /rest/v1/rpc/*. Þau skila engu án innskráningar, en eiga ekki að vera opin.
-- Postgres gefur PUBLIC EXECUTE sjálfgefið — því þarf að taka það af PUBLIC og
-- anon og gefa authenticated (RLS-reglur kalla í þessi föll fyrir innskráða).

do $$
declare f text;
begin
  foreach f in array array[
    'public.auth_company_id()', 'public.auth_employee_id()', 'public.auth_role()',
    'public.channel_company(uuid)', 'public.channel_visible(uuid)', 'public.is_channel_member(uuid)',
    'public.is_manager()', 'public.is_owner()', 'public.my_geofence_mode()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;

  -- Trigger-föll: keyrð af gagnagrunninum sjálfum, aldrei kölluð beint.
  foreach f in array array['public.handle_new_user()', 'public.punches_geofence()'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
    end if;
  end loop;
end $$;

-- search_path fest (advisor: function_search_path_mutable)
alter function public.geo_distance_m(double precision, double precision, double precision, double precision) set search_path = public;
