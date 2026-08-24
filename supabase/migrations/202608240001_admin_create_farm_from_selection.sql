-- Cria uma fazenda dentro da empresa da sessao atual sem permitir acesso cruzado.
create or replace function public.hoof_admin_create_farm(
  p_manager_token text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_session public.employee_sessions%rowtype;
  manager_session public.hoof_manager_sessions%rowtype;
  created_farm public.farms%rowtype;
  clean_name text;
begin
  select * into selected_session from public.hoof_current_session() limit 1;
  select * into manager_session from public.hoof_current_manager(p_manager_token) limit 1;

  if selected_session.id is null or manager_session.id is null then
    return jsonb_build_object('ok', false, 'message', 'Acesso gerente expirado.');
  end if;

  if not public.hoof_session_is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Somente administradores podem criar fazendas.');
  end if;

  clean_name := trim(coalesce(p_name, ''));
  if length(clean_name) < 2 or length(clean_name) > 80 then
    return jsonb_build_object('ok', false, 'message', 'Informe um nome de fazenda válido.');
  end if;

  if exists (
    select 1
    from public.farms farm
    where farm.client_id = selected_session.client_id
      and lower(trim(farm.name)) = lower(clean_name)
      and farm.status <> 'expired'
  ) then
    return jsonb_build_object('ok', false, 'message', 'Já existe uma fazenda com esse nome nesta empresa.');
  end if;

  insert into public.farms (
    client_id,
    name,
    activation_code,
    status,
    max_devices,
    grace_period_days
  ) values (
    selected_session.client_id,
    clean_name,
    null,
    'active',
    null,
    7
  ) returning * into created_farm;

  insert into public.licenses (farm_id, status, starts_at, expires_at)
  values (created_farm.id, 'active', now(), null);

  insert into public.employee_farms (employee_id, farm_id)
  values (selected_session.employee_id, created_farm.id)
  on conflict do nothing;

  insert into public.hoof_admin_audit (
    client_id,
    employee_id,
    action,
    target_type,
    target_id,
    details
  ) values (
    selected_session.client_id,
    selected_session.employee_id,
    'create_farm',
    'farm',
    created_farm.id::text,
    jsonb_build_object('name', clean_name, 'source', 'farm_selection')
  );

  return jsonb_build_object(
    'ok', true,
    'id', created_farm.id,
    'farm', to_jsonb(created_farm),
    'message', 'Fazenda criada e vinculada ao administrador.'
  );
end;
$$;

revoke all on function public.hoof_admin_create_farm(text, text) from public;
grant execute on function public.hoof_admin_create_farm(text, text) to anon, authenticated;
