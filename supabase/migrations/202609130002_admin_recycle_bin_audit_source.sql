-- Inclui na lixeira animais sem visitas, usando a auditoria como fonte da exclusao.

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
    return jsonb_build_object('ok', false, 'message', 'Permissao de administrador removida.');
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
          'removed_at', removal.created_at,
          'reason', removal.details ->> 'reason',
          'cancelled_by_name', removed_by.name,
          'visits_cancelled', coalesce((removal.details ->> 'visits_cancelled')::integer, 0)
        ) order by removal.created_at desc
      )
      from (
        select distinct on ((audit.details ->> 'farm_id')::uuid, lower(audit.target_id))
          audit.*
        from public.hoof_admin_audit audit
        where audit.client_id = selected_session.client_id
          and audit.action = 'remove_animal'
          and audit.target_type = 'animal'
          and audit.created_at >= now() - interval '30 days'
          and audit.details ? 'farm_id'
        order by (audit.details ->> 'farm_id')::uuid, lower(audit.target_id), audit.created_at desc
      ) removal
      join public.farms farm
        on farm.id = (removal.details ->> 'farm_id')::uuid
      join public.animals animal
        on animal.farm_id = farm.id
       and lower(animal.tag) = lower(removal.target_id)
       and animal.status = 'blocked'
      left join public.employees removed_by on removed_by.id = removal.employee_id
      where public.hoof_session_can_access_farm(farm.id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.hoof_admin_trash(text) from public;
grant execute on function public.hoof_admin_trash(text) to anon, authenticated;
