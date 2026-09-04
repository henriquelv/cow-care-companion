-- A confirmação administrativa da conta mestra aceita aparelho ativado em qualquer fazenda.
create or replace function public.authenticate_hoof_manager(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_session public.employee_sessions%rowtype;
  selected_employee public.employees%rowtype;
  raw_manager_token text;
  manager_expires_at timestamptz := now() + interval '15 minutes';
  request_ip_hash text := encode(
    digest(coalesce(split_part(public.hoof_request_header('x-forwarded-for'), ',', 1), 'unknown'), 'sha256'),
    'hex'
  );
  attempt_key text;
  recent_failures integer;
begin
  select * into selected_session from public.hoof_current_session() limit 1;
  if selected_session.id is null then
    return jsonb_build_object('ok', false, 'message', 'Sessão expirada. Entre novamente.');
  end if;

  select * into selected_employee
  from public.employees
  where id = selected_session.employee_id
    and status = 'active'
    and (is_admin = true or is_platform_admin = true);
  if selected_employee.id is null then
    return jsonb_build_object('ok', false, 'message', 'Este funcionário não é administrador.');
  end if;

  if not exists (
    select 1
    from public.devices device
    join public.farms farm on farm.id = device.farm_id
    where device.employee_id = selected_session.employee_id
      and device.device_id = selected_session.device_id
      and device.status = 'active'
      and farm.status = 'active'
      and (
        selected_employee.is_platform_admin = true
        or farm.client_id = selected_session.client_id
      )
  ) then
    return jsonb_build_object('ok', false, 'message', 'Ative este aparelho em uma fazenda antes de administrar.');
  end if;

  attempt_key := 'manager:' || selected_employee.id::text;
  select count(*) into recent_failures
  from public.hoof_login_attempts
  where client_id = selected_session.client_id
    and login_key = attempt_key
    and ip_hash = request_ip_hash
    and success = false
    and attempted_at > now() - interval '15 minutes';
  if recent_failures >= 5 then
    return jsonb_build_object(
      'ok', false,
      'message', 'Muitas tentativas. Aguarde 15 minutos e tente novamente.'
    );
  end if;

  if selected_employee.password_hash is null
     or selected_employee.password_hash <> crypt(p_password, selected_employee.password_hash) then
    insert into public.hoof_login_attempts (client_id, login_key, ip_hash, success)
    values (selected_session.client_id, attempt_key, request_ip_hash, false);
    return jsonb_build_object('ok', false, 'message', 'PIN incorreto.');
  end if;

  update public.hoof_manager_sessions
  set revoked_at = now()
  where employee_session_id = selected_session.id and revoked_at is null;

  raw_manager_token := encode(gen_random_bytes(32), 'hex');
  insert into public.hoof_manager_sessions (token_hash, employee_session_id, expires_at)
  values (
    encode(digest(raw_manager_token, 'sha256'), 'hex'),
    selected_session.id,
    manager_expires_at
  );

  delete from public.hoof_login_attempts
  where client_id = selected_session.client_id
    and login_key = attempt_key
    and ip_hash = request_ip_hash;

  insert into public.hoof_admin_audit (client_id, employee_id, action, details)
  values (
    selected_session.client_id,
    selected_employee.id,
    'manager_session_started',
    jsonb_build_object('platform_admin', selected_employee.is_platform_admin)
  );

  return jsonb_build_object(
    'ok', true,
    'manager_token', raw_manager_token,
    'expires_at', manager_expires_at
  );
end;
$$;

revoke all on function public.authenticate_hoof_manager(text) from public;
grant execute on function public.authenticate_hoof_manager(text) to anon, authenticated;
