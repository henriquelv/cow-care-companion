-- Permite à conta mestra autenticar-se a partir do código de qualquer empresa ativa.
create or replace function public.authenticate_hoof_platform_employee(
  p_activation_code text,
  p_login text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_client public.clients%rowtype;
  selected_employee public.employees%rowtype;
  allowed_farms jsonb;
  raw_session_token text;
  session_expires_at timestamptz := now() + interval '30 days';
  request_device_id text := coalesce(nullif(public.hoof_request_header('x-hoof-device-id'), ''), gen_random_uuid()::text);
  request_ip_hash text := encode(
    digest(coalesce(split_part(public.hoof_request_header('x-forwarded-for'), ',', 1), 'unknown'), 'sha256'),
    'hex'
  );
  attempt_key text := 'platform:000';
  recent_failures integer;
begin
  if trim(p_login) <> '000' then
    return null;
  end if;

  select * into selected_client
  from public.clients
  where activation_code = upper(trim(p_activation_code))
    and status = 'active'
  limit 1;
  if selected_client.id is null then
    return null;
  end if;

  select * into selected_employee
  from public.employees
  where is_platform_admin = true
    and employee_code = '000'
    and status = 'active'
  limit 1;
  if selected_employee.id is null then
    return null;
  end if;

  select count(*) into recent_failures
  from public.hoof_login_attempts
  where client_id = selected_employee.client_id
    and login_key = attempt_key
    and ip_hash = request_ip_hash
    and success = false
    and attempted_at > now() - interval '15 minutes';
  if recent_failures >= 8 then
    return jsonb_build_object(
      'error', 'too_many_attempts',
      'message', 'Muitas tentativas. Aguarde 15 minutos e tente novamente.'
    );
  end if;

  if selected_employee.password_hash is null
     or selected_employee.password_hash <> crypt(p_password, selected_employee.password_hash) then
    insert into public.hoof_login_attempts (client_id, login_key, ip_hash, success)
    values (selected_employee.client_id, attempt_key, request_ip_hash, false);
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(farm) order by farm.name), '[]'::jsonb)
  into allowed_farms
  from public.farms farm
  where farm.client_id = selected_client.id
    and farm.status = 'active'
    and exists (
      select 1 from public.licenses license
      where license.farm_id = farm.id
        and license.status = 'active'
        and (license.starts_at is null or license.starts_at <= now())
        and (license.expires_at is null or license.expires_at >= now())
    );
  if jsonb_array_length(allowed_farms) = 0 then
    return jsonb_build_object(
      'error', 'no_active_farm',
      'message', 'Nenhuma fazenda ativa está disponível nesta empresa.'
    );
  end if;

  update public.employee_sessions
  set revoked_at = now()
  where employee_id = selected_employee.id
    and device_id = request_device_id
    and revoked_at is null;

  raw_session_token := encode(gen_random_bytes(32), 'hex');
  insert into public.employee_sessions (token_hash, client_id, employee_id, device_id, expires_at)
  values (
    encode(digest(raw_session_token, 'sha256'), 'hex'),
    selected_employee.client_id,
    selected_employee.id,
    request_device_id,
    session_expires_at
  );

  delete from public.hoof_login_attempts
  where client_id = selected_employee.client_id
    and login_key = attempt_key
    and ip_hash = request_ip_hash;

  return jsonb_build_object(
    'client', jsonb_build_object(
      'id', selected_client.id,
      'name', selected_client.name,
      'activation_code', selected_client.activation_code,
      'status', selected_client.status,
      'max_devices', selected_client.max_devices,
      'grace_period_days', selected_client.grace_period_days
    ),
    'employee', jsonb_build_object(
      'id', selected_employee.id,
      'farm_id', selected_employee.farm_id,
      'client_id', selected_employee.client_id,
      'employee_code', selected_employee.employee_code,
      'login_name', selected_employee.login_name,
      'name', selected_employee.name,
      'status', selected_employee.status,
      'is_admin', true,
      'is_platform_admin', true,
      'can_view_financial', true
    ),
    'farms', allowed_farms,
    'session_token', raw_session_token,
    'session_expires_at', session_expires_at
  );
end;
$$;

create or replace function public.activate_hoof_platform_device(
  p_farm_id uuid,
  p_device_name text default 'Conta mestra'
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
  select * into selected_session from public.hoof_current_session() limit 1;
  if selected_session.id is null or not public.hoof_session_is_platform_admin() then
    return jsonb_build_object('ok', false, 'message', 'Sessão da conta mestra inválida.');
  end if;
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
    left(coalesce(nullif(trim(p_device_name), ''), 'Conta mestra'), 120),
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
    'license_starts_at', selected_license.starts_at,
    'license_expires_at', selected_license.expires_at
  );
end;
$$;

revoke all on function public.authenticate_hoof_platform_employee(text, text, text) from public;
revoke all on function public.activate_hoof_platform_device(uuid, text) from public;
grant execute on function public.authenticate_hoof_platform_employee(text, text, text) to anon, authenticated;
grant execute on function public.activate_hoof_platform_device(uuid, text) to anon, authenticated;
