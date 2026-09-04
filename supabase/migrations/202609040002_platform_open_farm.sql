-- A conta mestra pode abrir uma fazenda operacional sem depender do PIN de um funcionário local.
create or replace function public.hoof_session_can_access_farm(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public.hoof_session_is_platform_admin()
  or exists (
    select 1
    from public.hoof_current_session() session
    join public.employee_farms assignment on assignment.employee_id = session.employee_id
    join public.farms farm on farm.id = assignment.farm_id
    join public.clients client on client.id = session.client_id
    join public.employees employee on employee.id = session.employee_id
    where assignment.farm_id = target_farm_id
      and farm.client_id = session.client_id
      and farm.status = 'active'
      and client.status = 'active'
      and employee.client_id = session.client_id
      and employee.status = 'active'
      and exists (
        select 1 from public.licenses license
        where license.farm_id = target_farm_id
          and license.status = 'active'
          and (license.starts_at is null or license.starts_at <= now())
          and (license.expires_at is null or license.expires_at >= now())
      )
      and exists (
        select 1 from public.devices device
        where device.farm_id = target_farm_id
          and device.employee_id = session.employee_id
          and device.device_id = session.device_id
          and device.status = 'active'
      )
  );
$$;

create or replace function public.hoof_platform_activate_farm(
  p_manager_token text,
  p_farm_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_session public.employee_sessions%rowtype;
  selected_farm public.farms%rowtype;
  selected_client public.clients%rowtype;
  selected_license public.licenses%rowtype;
begin
  if not public.hoof_platform_authorized(p_manager_token) then
    return jsonb_build_object('ok', false, 'message', 'Acesso central expirado. Confirme o PIN novamente.');
  end if;
  select * into selected_session from public.hoof_current_session() limit 1;
  select * into selected_farm from public.farms where id = p_farm_id and status = 'active';
  if selected_farm.id is null then
    return jsonb_build_object('ok', false, 'message', 'Fazenda não encontrada ou bloqueada.');
  end if;
  select * into selected_client from public.clients where id = selected_farm.client_id and status = 'active';
  if selected_client.id is null then
    return jsonb_build_object('ok', false, 'message', 'Empresa bloqueada ou inativa.');
  end if;
  select * into selected_license
  from public.licenses
  where farm_id = selected_farm.id
    and status = 'active'
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at >= now())
  order by expires_at desc nulls first
  limit 1;
  if selected_license.id is null then
    return jsonb_build_object('ok', false, 'message', 'Licença da fazenda inativa.');
  end if;

  insert into public.devices (farm_id, employee_id, device_id, device_name, status, last_seen_at)
  values (
    selected_farm.id,
    selected_session.employee_id,
    selected_session.device_id,
    'Conta mestra',
    'active',
    now()
  )
  on conflict (farm_id, device_id) do update
  set employee_id = excluded.employee_id,
      device_name = excluded.device_name,
      status = 'active',
      last_seen_at = now(),
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'client', jsonb_build_object(
      'id', selected_client.id,
      'name', selected_client.name,
      'activation_code', selected_client.activation_code
    ),
    'farm', jsonb_build_object(
      'id', selected_farm.id,
      'name', selected_farm.name,
      'grace_period_days', selected_farm.grace_period_days
    )
  );
end;
$$;

create or replace function public.validate_hoof_access(p_farm_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_session public.employee_sessions%rowtype;
  selected_employee public.employees%rowtype;
  selected_farm public.farms%rowtype;
  selected_client public.clients%rowtype;
  selected_device public.devices%rowtype;
  selected_license public.licenses%rowtype;
begin
  select * into selected_session from public.hoof_current_session() limit 1;
  if selected_session.id is null then
    return jsonb_build_object('ok', false, 'message', 'Sessão expirada. Entre novamente.');
  end if;
  select * into selected_employee
  from public.employees
  where id = selected_session.employee_id and status = 'active';
  if selected_employee.id is null then
    return jsonb_build_object('ok', false, 'message', 'Funcionário bloqueado ou inativo.');
  end if;

  select * into selected_farm from public.farms where id = p_farm_id and status = 'active';
  if selected_farm.id is null then
    return jsonb_build_object('ok', false, 'message', 'Acesso a esta fazenda foi removido.');
  end if;
  select * into selected_client from public.clients where id = selected_farm.client_id and status = 'active';
  if selected_client.id is null then
    return jsonb_build_object('ok', false, 'message', 'Empresa bloqueada ou inativa.');
  end if;
  if not public.hoof_session_is_platform_admin()
     and (selected_farm.client_id <> selected_session.client_id or not public.hoof_session_can_access_farm(p_farm_id)) then
    return jsonb_build_object('ok', false, 'message', 'Acesso a esta fazenda foi removido.');
  end if;

  select * into selected_device
  from public.devices
  where farm_id = p_farm_id
    and device_id = selected_session.device_id
    and employee_id = selected_session.employee_id
    and status = 'active';
  if selected_device.id is null then
    return jsonb_build_object('ok', false, 'message', 'Aparelho bloqueado ou não ativado.');
  end if;
  select * into selected_license
  from public.licenses
  where farm_id = p_farm_id
    and status = 'active'
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at >= now())
  order by expires_at desc nulls first
  limit 1;
  if selected_license.id is null then
    return jsonb_build_object('ok', false, 'message', 'Licença expirada ou bloqueada.');
  end if;

  update public.employee_sessions set last_seen_at = now() where id = selected_session.id;
  update public.devices set last_seen_at = now() where id = selected_device.id;
  return jsonb_build_object(
    'ok', true,
    'employee', jsonb_build_object(
      'id', selected_employee.id,
      'farm_id', selected_employee.farm_id,
      'client_id', selected_employee.client_id,
      'employee_code', selected_employee.employee_code,
      'login_name', selected_employee.login_name,
      'name', selected_employee.name,
      'status', selected_employee.status,
      'is_admin', selected_employee.is_admin,
      'is_platform_admin', selected_employee.is_platform_admin
    ),
    'farm', jsonb_build_object(
      'id', selected_farm.id,
      'name', selected_farm.name,
      'client_id', selected_farm.client_id,
      'status', selected_farm.status,
      'max_devices', selected_farm.max_devices,
      'grace_period_days', selected_farm.grace_period_days
    ),
    'license_expires_at', selected_license.expires_at
  );
end;
$$;

revoke all on function public.hoof_platform_activate_farm(text, uuid) from public;
grant execute on function public.hoof_platform_activate_farm(text, uuid) to anon, authenticated;
