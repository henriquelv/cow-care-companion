-- Lixeira administrativa auditável para visitas e animais removidos por engano.

create or replace function public.hoof_admin_trash(p_manager_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_session public.employee_sessions%rowtype;
  manager_session public.hoof_manager_sessions%rowtype;
begin
  select * into selected_session from public.hoof_current_session() limit 1;
  select * into manager_session from public.hoof_current_manager(p_manager_token) limit 1;

  if selected_session.id is null or manager_session.id is null then
    return jsonb_build_object('ok', false, 'message', 'Acesso gerente expirado.');
  end if;
  if not public.hoof_session_is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Permissão de administrador removida.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'retention_days', 30,
    'visits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', visit.id,
          'farm_id', visit.farm_id,
          'farm_name', farm.name,
          'tag', visit.tag,
          'visit_date', visit.date,
          'employee_name', coalesce(visit.employee_name, visit.visitante_nome),
          'reason', visit.cancellation_reason,
          'cancelled_at', visit.cancelled_at,
          'cancelled_by_name', cancelled_by.name,
          'scope', visit.cancellation_scope
        ) order by visit.cancelled_at desc
      )
      from public.hoof_visits visit
      join public.farms farm on farm.id = visit.farm_id
      left join public.employees cancelled_by on cancelled_by.id = visit.cancelled_by
      where farm.client_id = selected_session.client_id
        and public.hoof_session_can_access_farm(visit.farm_id)
        and visit.status = 'cancelled'
        and visit.cancelled_at >= now() - interval '30 days'
        and coalesce(visit.cancellation_scope, 'visit') = 'visit'
    ), '[]'::jsonb),
    'animals', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'farm_id', animal.farm_id,
          'farm_name', farm.name,
          'tag', animal.tag,
          'lote', animal.lote,
          'sex', animal.sex,
          'removed_at', removal.cancelled_at,
          'reason', removal.cancellation_reason,
          'cancelled_by_name', removal.cancelled_by_name,
          'visits_cancelled', removal.visits_cancelled
        ) order by removal.cancelled_at desc
      )
      from public.animals animal
      join public.farms farm on farm.id = animal.farm_id
      cross join lateral (
        select
          max(visit.cancelled_at) as cancelled_at,
          (array_agg(visit.cancellation_reason order by visit.cancelled_at desc))[1]
            as cancellation_reason,
          (array_agg(cancelled_by.name order by visit.cancelled_at desc))[1]
            as cancelled_by_name,
          count(*)::integer as visits_cancelled
        from public.hoof_visits visit
        left join public.employees cancelled_by on cancelled_by.id = visit.cancelled_by
        where visit.farm_id = animal.farm_id
          and lower(visit.tag) = lower(animal.tag)
          and visit.status = 'cancelled'
          and visit.cancellation_scope = 'animal'
      ) removal
      where farm.client_id = selected_session.client_id
        and public.hoof_session_can_access_farm(animal.farm_id)
        and animal.status = 'blocked'
        and removal.cancelled_at is not null
        and removal.cancelled_at >= now() - interval '30 days'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.hoof_admin_restore_animal(
  p_manager_token text,
  p_farm_id uuid,
  p_tag text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_session public.employee_sessions%rowtype;
  manager_session public.hoof_manager_sessions%rowtype;
  target_farm public.farms%rowtype;
  clean_tag text := trim(coalesce(p_tag, ''));
  clean_reason text := trim(coalesce(p_reason, ''));
  restored_visits integer := 0;
begin
  select * into selected_session from public.hoof_current_session() limit 1;
  select * into manager_session from public.hoof_current_manager(p_manager_token) limit 1;

  if selected_session.id is null or manager_session.id is null then
    return jsonb_build_object('ok', false, 'message', 'Acesso gerente expirado.');
  end if;
  if not public.hoof_session_is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Permissão de administrador removida.');
  end if;
  if length(clean_reason) < 3 or length(clean_reason) > 300 then
    return jsonb_build_object('ok', false, 'message', 'Informe um motivo de 3 a 300 caracteres.');
  end if;

  select * into target_farm
  from public.farms
  where id = p_farm_id
    and client_id = selected_session.client_id
    and public.hoof_session_can_access_farm(id);

  if target_farm.id is null or clean_tag = '' then
    return jsonb_build_object('ok', false, 'message', 'Animal inválido ou fora da fazenda atual.');
  end if;

  update public.animals
  set status = 'active', updated_at = now()
  where farm_id = target_farm.id
    and lower(tag) = lower(clean_tag)
    and status = 'blocked';

  update public.hoof_visits
  set status = 'active',
      cancellation_reason = null,
      cancelled_at = null,
      cancelled_by = null,
      cancellation_scope = null,
      updated_at = now()
  where farm_id = target_farm.id
    and lower(tag) = lower(clean_tag)
    and status = 'cancelled'
    and cancellation_scope = 'animal';
  get diagnostics restored_visits = row_count;

  insert into public.hoof_admin_audit (
    client_id, employee_id, action, target_type, target_id, details
  ) values (
    selected_session.client_id,
    selected_session.employee_id,
    'restore_animal',
    'animal',
    clean_tag,
    jsonb_build_object(
      'farm_id', target_farm.id,
      'reason', clean_reason,
      'visits_restored', restored_visits
    )
  );

  return jsonb_build_object(
    'ok', true,
    'id', clean_tag,
    'visits_restored', restored_visits
  );
end;
$$;

revoke all on function public.hoof_admin_trash(text) from public;
revoke all on function public.hoof_admin_restore_animal(text, uuid, text, text) from public;
grant execute on function public.hoof_admin_trash(text) to anon, authenticated;
grant execute on function public.hoof_admin_restore_animal(text, uuid, text, text) to anon, authenticated;
