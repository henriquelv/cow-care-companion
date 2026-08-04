-- Restauração auditável para cancelamentos administrativos feitos por engano.

create or replace function public.hoof_admin_restore_visit(
  p_manager_token text,
  p_visit_id text,
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
  target_visit public.hoof_visits%rowtype;
  clean_reason text := trim(coalesce(p_reason, ''));
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

  select visit.* into target_visit
  from public.hoof_visits visit
  join public.farms farm on farm.id = visit.farm_id
  where visit.id = p_visit_id
    and farm.client_id = selected_session.client_id
    and public.hoof_session_can_access_farm(visit.farm_id);

  if target_visit.id is null then
    return jsonb_build_object('ok', false, 'message', 'Visita inválida ou fora da fazenda atual.');
  end if;
  if target_visit.status <> 'cancelled' then
    return jsonb_build_object('ok', true, 'id', target_visit.id, 'already_active', true);
  end if;

  update public.hoof_visits
  set status = 'active',
      cancellation_reason = null,
      cancelled_at = null,
      cancelled_by = null,
      cancellation_scope = null,
      updated_at = now()
  where id = target_visit.id;

  insert into public.hoof_admin_audit (
    client_id, employee_id, action, target_type, target_id, details
  ) values (
    selected_session.client_id,
    selected_session.employee_id,
    'restore_visit',
    'hoof_visit',
    target_visit.id,
    jsonb_build_object(
      'tag', target_visit.tag,
      'reason', clean_reason,
      'previous_cancellation_reason', target_visit.cancellation_reason,
      'previous_cancelled_at', target_visit.cancelled_at
    )
  );

  return jsonb_build_object('ok', true, 'id', target_visit.id);
end;
$$;

revoke all on function public.hoof_admin_restore_visit(text, text, text) from public;
grant execute on function public.hoof_admin_restore_visit(text, text, text) to anon, authenticated;
