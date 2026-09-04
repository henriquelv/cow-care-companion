-- Conta central para suporte e administração entre empresas.
-- Senhas continuam armazenadas somente como hash; este acesso pode redefinir PINs, nunca lê-los.
create extension if not exists "pgcrypto";

insert into public.clients (
  id, name, activation_code, status, max_devices, grace_period_days
) values (
  '10000000-0000-4000-8000-000000000000',
  'Administração central',
  '000',
  'active',
  null,
  7
)
on conflict (id) do update
set name = excluded.name,
    activation_code = excluded.activation_code,
    status = 'active',
    max_devices = null,
    grace_period_days = excluded.grace_period_days;

insert into public.farms (
  id, client_id, name, activation_code, status, max_devices, grace_period_days
) values (
  '20000000-0000-4000-8000-000000000000',
  '10000000-0000-4000-8000-000000000000',
  'Administração central',
  '000',
  'active',
  null,
  7
)
on conflict (id) do update
set name = excluded.name,
    activation_code = excluded.activation_code,
    status = 'active',
    max_devices = null,
    grace_period_days = excluded.grace_period_days;

insert into public.licenses (farm_id, status, starts_at, expires_at)
select '20000000-0000-4000-8000-000000000000', 'active', now(), null
where not exists (
  select 1 from public.licenses
  where farm_id = '20000000-0000-4000-8000-000000000000'
    and status = 'active'
);

insert into public.employees (
  id, farm_id, client_id, employee_code, login_name, password_hash, name, status,
  is_admin, is_platform_admin
) values (
  '30000000-0000-4000-8000-000000000000',
  '20000000-0000-4000-8000-000000000000',
  '10000000-0000-4000-8000-000000000000',
  '000',
  '000',
  extensions.crypt('1234', extensions.gen_salt('bf', 12)),
  'Conta mestra',
  'active',
  true,
  true
)
on conflict (id) do update
set farm_id = excluded.farm_id,
    client_id = excluded.client_id,
    employee_code = excluded.employee_code,
    login_name = excluded.login_name,
    name = excluded.name,
    status = 'active',
    is_admin = true,
    is_platform_admin = true,
    updated_at = now();

insert into public.employee_farms (employee_id, farm_id)
values (
  '30000000-0000-4000-8000-000000000000',
  '20000000-0000-4000-8000-000000000000'
)
on conflict do nothing;

create or replace function public.hoof_session_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select employee.is_platform_admin
    from public.employees employee
    where employee.id = public.hoof_session_employee_id()
      and employee.status = 'active'
  ), false);
$$;

grant execute on function public.hoof_session_is_platform_admin() to anon, authenticated;

create or replace function public.hoof_platform_authorized(p_manager_token text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (select 1 from public.hoof_current_manager(p_manager_token))
    and public.hoof_session_is_platform_admin();
$$;

create or replace function public.hoof_platform_overview(p_manager_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.hoof_platform_authorized(p_manager_token) then
    return jsonb_build_object('ok', false, 'message', 'Acesso central expirado. Confirme o PIN novamente.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', client.id,
        'name', client.name,
        'activation_code', client.activation_code,
        'status', client.status,
        'created_at', client.created_at
      ) order by client.name)
      from public.clients client
      where client.id <> '10000000-0000-4000-8000-000000000000'
    ), '[]'::jsonb),
    'farms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', farm.id,
        'client_id', farm.client_id,
        'name', farm.name,
        'status', farm.status,
        'created_at', farm.created_at
      ) order by farm.name)
      from public.farms farm
      where farm.client_id <> '10000000-0000-4000-8000-000000000000'
    ), '[]'::jsonb),
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', employee.id,
        'client_id', employee.client_id,
        'farm_id', employee.farm_id,
        'name', employee.name,
        'login_name', employee.login_name,
        'employee_code', employee.employee_code,
        'status', employee.status,
        'is_admin', employee.is_admin,
        'updated_at', employee.updated_at
      ) order by employee.name)
      from public.employees employee
      where employee.is_platform_admin is not true
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.hoof_platform_action(
  p_manager_token text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_session public.employee_sessions%rowtype;
  target_client public.clients%rowtype;
  target_farm public.farms%rowtype;
  target_employee public.employees%rowtype;
  created_id uuid;
  clean_name text := trim(coalesce(p_payload ->> 'name', ''));
  clean_login text := trim(coalesce(p_payload ->> 'login_name', ''));
  clean_code text := trim(coalesce(p_payload ->> 'employee_code', ''));
  clean_pin text := coalesce(p_payload ->> 'pin', '');
  requested_status text := coalesce(p_payload ->> 'status', 'active');
  audit_client_id uuid;
begin
  if not public.hoof_platform_authorized(p_manager_token) then
    return jsonb_build_object('ok', false, 'message', 'Acesso central expirado. Confirme o PIN novamente.');
  end if;
  select * into selected_session from public.hoof_current_session() limit 1;

  if p_action = 'create_farm' then
    select * into target_client from public.clients where id = (p_payload ->> 'client_id')::uuid;
    if target_client.id is null or target_client.id = '10000000-0000-4000-8000-000000000000' then
      return jsonb_build_object('ok', false, 'message', 'Empresa inválida.');
    end if;
    if length(clean_name) < 2 or length(clean_name) > 80 then
      return jsonb_build_object('ok', false, 'message', 'Informe um nome de fazenda válido.');
    end if;
    if exists (select 1 from public.farms where client_id = target_client.id and lower(trim(name)) = lower(clean_name)) then
      return jsonb_build_object('ok', false, 'message', 'Já existe uma fazenda com esse nome nesta empresa.');
    end if;
    insert into public.farms (client_id, name, status, max_devices, grace_period_days)
    values (target_client.id, clean_name, 'active', null, 7)
    returning id into created_id;
    insert into public.licenses (farm_id, status, starts_at, expires_at)
    values (created_id, 'active', now(), null);
    audit_client_id := target_client.id;

  elsif p_action = 'update_farm' then
    select * into target_farm from public.farms where id = (p_payload ->> 'farm_id')::uuid;
    if target_farm.id is null or target_farm.client_id = '10000000-0000-4000-8000-000000000000' then
      return jsonb_build_object('ok', false, 'message', 'Fazenda inválida.');
    end if;
    if length(clean_name) between 2 and 80 then
      update public.farms set name = clean_name, updated_at = now() where id = target_farm.id;
    end if;
    if requested_status in ('active', 'blocked', 'expired') then
      update public.farms set status = requested_status, updated_at = now() where id = target_farm.id;
    end if;
    created_id := target_farm.id;
    audit_client_id := target_farm.client_id;

  elsif p_action = 'create_employee' then
    select * into target_farm from public.farms where id = (p_payload ->> 'farm_id')::uuid;
    if target_farm.id is null or target_farm.client_id = '10000000-0000-4000-8000-000000000000' then
      return jsonb_build_object('ok', false, 'message', 'Selecione uma fazenda válida.');
    end if;
    if length(clean_name) < 2 or length(clean_login) < 2 or length(clean_code) < 1 then
      return jsonb_build_object('ok', false, 'message', 'Preencha nome, login e código.');
    end if;
    if clean_pin !~ '^[0-9]{4,6}$' then
      return jsonb_build_object('ok', false, 'message', 'O PIN deve ter de 4 a 6 números.');
    end if;
    insert into public.employees (farm_id, client_id, employee_code, login_name, password_hash, name, status, is_admin)
    values (target_farm.id, target_farm.client_id, clean_code, clean_login, extensions.crypt(clean_pin, extensions.gen_salt('bf', 12)), clean_name, 'active', coalesce((p_payload ->> 'is_admin')::boolean, false))
    returning id into created_id;
    insert into public.employee_farms (employee_id, farm_id) values (created_id, target_farm.id) on conflict do nothing;
    audit_client_id := target_farm.client_id;

  elsif p_action = 'update_employee' then
    select * into target_employee from public.employees where id = (p_payload ->> 'employee_id')::uuid;
    if target_employee.id is null or target_employee.is_platform_admin then
      return jsonb_build_object('ok', false, 'message', 'Funcionário inválido.');
    end if;
    if length(clean_name) between 2 and 120 then
      update public.employees set name = clean_name, updated_at = now() where id = target_employee.id;
    end if;
    if length(clean_login) between 2 and 120 then
      update public.employees set login_name = clean_login, updated_at = now() where id = target_employee.id;
    end if;
    if length(clean_code) between 1 and 30 then
      update public.employees set employee_code = clean_code, updated_at = now() where id = target_employee.id;
    end if;
    if requested_status in ('active', 'blocked') then
      update public.employees set status = requested_status, updated_at = now() where id = target_employee.id;
    end if;
    if p_payload ? 'is_admin' then
      update public.employees set is_admin = coalesce((p_payload ->> 'is_admin')::boolean, false), updated_at = now() where id = target_employee.id;
    end if;
    created_id := target_employee.id;
    audit_client_id := target_employee.client_id;

  elsif p_action = 'reset_employee_pin' then
    select * into target_employee from public.employees where id = (p_payload ->> 'employee_id')::uuid;
    if target_employee.id is null then
      return jsonb_build_object('ok', false, 'message', 'Funcionário inválido.');
    end if;
    if clean_pin !~ '^[0-9]{4,6}$' then
      return jsonb_build_object('ok', false, 'message', 'O PIN deve ter de 4 a 6 números.');
    end if;
    update public.employees
    set password_hash = extensions.crypt(clean_pin, extensions.gen_salt('bf', 12)), updated_at = now()
    where id = target_employee.id;
    update public.employee_sessions set revoked_at = now()
    where employee_id = target_employee.id and revoked_at is null;
    created_id := target_employee.id;
    audit_client_id := target_employee.client_id;

  else
    return jsonb_build_object('ok', false, 'message', 'Ação central inválida.');
  end if;

  insert into public.hoof_admin_audit (client_id, employee_id, action, target_type, target_id, details)
  values (
    audit_client_id,
    selected_session.employee_id,
    'platform_' || p_action,
    case when p_action like '%farm%' then 'farm' else 'employee' end,
    created_id::text,
    p_payload - 'pin'
  );

  return jsonb_build_object('ok', true, 'id', created_id, 'message', 'Alteração salva.');
end;
$$;

revoke all on function public.hoof_platform_authorized(text) from public;
revoke all on function public.hoof_platform_overview(text) from public;
revoke all on function public.hoof_platform_action(text, text, jsonb) from public;
grant execute on function public.hoof_platform_overview(text) to anon, authenticated;
grant execute on function public.hoof_platform_action(text, text, jsonb) to anon, authenticated;
