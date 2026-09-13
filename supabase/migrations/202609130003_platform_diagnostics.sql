-- Diagnostico operacional exclusivo da conta mestra da plataforma.

create or replace function public.hoof_platform_diagnostics(p_manager_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  central_client uuid := '10000000-0000-4000-8000-000000000000'::uuid;
  clients_total bigint;
  clients_active bigint;
  farms_total bigint;
  farms_active bigint;
  employees_total bigint;
  employees_active bigint;
  devices_active bigint;
  devices_stale bigint;
  licenses_invalid bigint;
  visits_active bigint;
  visits_without_animal bigint;
  visits_incomplete_feet bigint;
  feet_wrong_farm bigint;
  employees_without_farm bigint;
  work_sessions_stale bigint;
  requests_waiting bigint;
begin
  if not public.hoof_platform_authorized(p_manager_token) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Acesso central expirado. Confirme o PIN novamente.'
    );
  end if;

  select count(*), count(*) filter (where status = 'active')
  into clients_total, clients_active
  from public.clients
  where id <> central_client;

  select count(*), count(*) filter (where status = 'active')
  into farms_total, farms_active
  from public.farms
  where client_id <> central_client;

  select count(*), count(*) filter (where status = 'active')
  into employees_total, employees_active
  from public.employees
  where client_id <> central_client
    and is_platform_admin is not true;

  select
    count(*) filter (where device.status = 'active'),
    count(*) filter (
      where device.status = 'active'
        and (device.last_seen_at is null or device.last_seen_at < now() - interval '30 days')
    )
  into devices_active, devices_stale
  from public.devices device
  join public.farms farm on farm.id = device.farm_id
  where farm.client_id <> central_client;

  select count(*) into licenses_invalid
  from public.farms farm
  where farm.client_id <> central_client
    and farm.status = 'active'
    and not exists (
      select 1
      from public.licenses license
      where license.farm_id = farm.id
        and license.status = 'active'
        and (license.starts_at is null or license.starts_at <= now())
        and (license.expires_at is null or license.expires_at >= now())
    );

  select count(*) into visits_active
  from public.hoof_visits visit
  join public.farms farm on farm.id = visit.farm_id
  where farm.client_id <> central_client
    and visit.status = 'active'
    and coalesce(visit.payload ->> 'is_test', 'false') <> 'true';

  select count(*) into visits_without_animal
  from public.hoof_visits visit
  join public.farms farm on farm.id = visit.farm_id
  where farm.client_id <> central_client
    and visit.status = 'active'
    and coalesce(visit.payload ->> 'is_test', 'false') <> 'true'
    and not exists (
      select 1
      from public.animals animal
      where animal.farm_id = visit.farm_id
        and lower(animal.tag) = lower(visit.tag)
        and animal.status = 'active'
    );

  select count(*) into visits_incomplete_feet
  from public.hoof_visits visit
  join public.farms farm on farm.id = visit.farm_id
  where farm.client_id <> central_client
    and visit.status = 'active'
    and coalesce(visit.payload ->> 'is_test', 'false') <> 'true'
    and (
      select count(distinct foot.foot)
      from public.hoof_feet foot
      where foot.visit_id = visit.id
        and foot.farm_id = visit.farm_id
        and foot.foot in ('FE', 'FD', 'TE', 'TD')
    ) < 4
    and case
      when jsonb_typeof(visit.payload -> 'feet') = 'array'
        then jsonb_array_length(visit.payload -> 'feet')
      else 0
    end < 4;

  select count(*) into feet_wrong_farm
  from public.hoof_feet foot
  join public.hoof_visits visit on visit.id = foot.visit_id
  where foot.farm_id <> visit.farm_id;

  select count(*) into employees_without_farm
  from public.employees employee
  where employee.client_id <> central_client
    and employee.status = 'active'
    and employee.is_platform_admin is not true
    and not exists (
      select 1 from public.employee_farms assignment
      where assignment.employee_id = employee.id
    );

  select count(*) into work_sessions_stale
  from public.hoof_work_sessions work_session
  join public.farms farm on farm.id = work_session.farm_id
  where farm.client_id <> central_client
    and work_session.status = 'active'
    and work_session.started_at < now() - interval '12 hours';

  select count(*) into requests_waiting
  from public.limping_requests request
  join public.farms farm on farm.id = request.farm_id
  where farm.client_id <> central_client
    and request.status in ('new', 'accepted', 'scheduled')
    and request.created_at < now() - interval '7 days';

  return jsonb_build_object(
    'ok', true,
    'checked_at', now(),
    'server_status', 'online',
    'counts', jsonb_build_object(
      'clients_total', clients_total,
      'clients_active', clients_active,
      'farms_total', farms_total,
      'farms_active', farms_active,
      'employees_total', employees_total,
      'employees_active', employees_active,
      'devices_active', devices_active,
      'devices_stale', devices_stale,
      'licenses_invalid', licenses_invalid,
      'visits_active', visits_active,
      'requests_waiting', requests_waiting
    ),
    'integrity', jsonb_build_object(
      'visits_without_animal', visits_without_animal,
      'visits_incomplete_feet', visits_incomplete_feet,
      'feet_wrong_farm', feet_wrong_farm,
      'employees_without_farm', employees_without_farm,
      'work_sessions_stale', work_sessions_stale
    ),
    'issues_total',
      licenses_invalid + visits_without_animal + visits_incomplete_feet + feet_wrong_farm
      + employees_without_farm + work_sessions_stale,
    'recent_events', coalesce((
      select jsonb_agg(to_jsonb(event_row) order by event_row.created_at desc)
      from (
        select
          audit.action,
          audit.target_type,
          audit.target_id,
          audit.created_at,
          client.name as client_name,
          employee.name as employee_name
        from public.hoof_admin_audit audit
        join public.clients client on client.id = audit.client_id
        left join public.employees employee on employee.id = audit.employee_id
        where audit.client_id <> central_client
        order by audit.created_at desc
        limit 20
      ) event_row
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.hoof_platform_diagnostics(text) from public;
grant execute on function public.hoof_platform_diagnostics(text) to anon, authenticated;
