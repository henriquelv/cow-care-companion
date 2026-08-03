-- A agenda geral do funcionário deve considerar somente visitas operacionais ativas.

create or replace function public.hoof_employee_agenda()
returns setof public.hoof_visits
language sql
stable
security definer
set search_path = public, extensions
as $$
  select visit.*
  from public.hoof_current_session() session
  join public.employee_farms assignment on assignment.employee_id = session.employee_id
  join public.farms farm on farm.id = assignment.farm_id
  join public.hoof_visits visit
    on visit.farm_id = farm.id and visit.employee_id = session.employee_id
  where farm.client_id = session.client_id
    and farm.status = 'active'
    and visit.status = 'active'
    and exists (
      select 1 from public.licenses license
      where license.farm_id = farm.id
        and license.status = 'active'
        and (license.starts_at is null or license.starts_at <= now())
        and (license.expires_at is null or license.expires_at >= now())
    )
  order by visit.created_at desc;
$$;

revoke all on function public.hoof_employee_agenda() from public;
grant execute on function public.hoof_employee_agenda() to anon, authenticated;
