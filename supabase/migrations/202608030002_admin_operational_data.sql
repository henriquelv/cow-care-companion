-- Gestão administrativa de visitas e animais com cancelamento auditável.

alter table public.hoof_visits
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.employees(id) on delete set null,
  add column if not exists cancellation_scope text;

alter table public.hoof_visits
  drop constraint if exists hoof_visits_cancellation_scope_check,
  add constraint hoof_visits_cancellation_scope_check
    check (cancellation_scope is null or cancellation_scope in ('visit', 'animal'));

create or replace function public.hoof_admin_manage_data(
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
  manager_session public.hoof_manager_sessions%rowtype;
  target_visit public.hoof_visits%rowtype;
  target_farm public.farms%rowtype;
  visit_row record;
  clean_tag text;
  clean_reason text;
  cancelled_count integer := 0;
begin
  select * into selected_session from public.hoof_current_session() limit 1;
  select * into manager_session from public.hoof_current_manager(p_manager_token) limit 1;
  if selected_session.id is null or manager_session.id is null then
    return jsonb_build_object('ok', false, 'message', 'Acesso gerente expirado.');
  end if;
  if not public.hoof_session_is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Permissão de administrador removida.');
  end if;

  clean_reason := trim(coalesce(p_payload ->> 'reason', ''));
  if length(clean_reason) < 3 or length(clean_reason) > 300 then
    return jsonb_build_object('ok', false, 'message', 'Informe um motivo de 3 a 300 caracteres.');
  end if;

  if p_action = 'cancel_visit' then
    select visit.* into target_visit
    from public.hoof_visits visit
    join public.farms farm on farm.id = visit.farm_id
    where visit.id = p_payload ->> 'visit_id'
      and farm.client_id = selected_session.client_id
      and public.hoof_session_can_access_farm(visit.farm_id);

    if target_visit.id is null then
      return jsonb_build_object('ok', false, 'message', 'Visita inválida ou fora da fazenda atual.');
    end if;
    if target_visit.status = 'cancelled' then
      return jsonb_build_object('ok', true, 'id', target_visit.id, 'already_cancelled', true);
    end if;

    update public.hoof_visits
    set status = 'cancelled',
        cancellation_reason = clean_reason,
        cancelled_at = now(),
        cancelled_by = selected_session.employee_id,
        cancellation_scope = 'visit',
        updated_at = now()
    where id = target_visit.id;

    insert into public.hoof_corrections (
      id, farm_id, original_visit_id, correction_visit_id, reason, employee_id, device_id
    ) values (
      gen_random_uuid()::text,
      target_visit.farm_id,
      target_visit.id,
      null,
      'Visita excluída: ' || clean_reason,
      selected_session.employee_id,
      selected_session.device_id
    );

    insert into public.hoof_admin_audit (
      client_id, employee_id, action, target_type, target_id, details
    ) values (
      selected_session.client_id,
      selected_session.employee_id,
      'cancel_visit',
      'hoof_visit',
      target_visit.id,
      jsonb_build_object('tag', target_visit.tag, 'reason', clean_reason)
    );

    return jsonb_build_object('ok', true, 'id', target_visit.id);

  elsif p_action = 'remove_animal' then
    select * into target_farm
    from public.farms
    where id = (p_payload ->> 'farm_id')::uuid
      and client_id = selected_session.client_id
      and public.hoof_session_can_access_farm(id);
    if target_farm.id is null then
      return jsonb_build_object('ok', false, 'message', 'Fazenda inválida.');
    end if;

    clean_tag := trim(coalesce(p_payload ->> 'tag', ''));
    if length(clean_tag) < 1 or length(clean_tag) > 80 then
      return jsonb_build_object('ok', false, 'message', 'Animal inválido.');
    end if;

    update public.animals
    set status = 'blocked', updated_at = now()
    where farm_id = target_farm.id
      and lower(tag) = lower(clean_tag);

    for visit_row in
      select visit.id
      from public.hoof_visits visit
      where visit.farm_id = target_farm.id
        and lower(visit.tag) = lower(clean_tag)
        and visit.status <> 'cancelled'
    loop
      update public.hoof_visits
      set status = 'cancelled',
          cancellation_reason = clean_reason,
          cancelled_at = now(),
          cancelled_by = selected_session.employee_id,
          cancellation_scope = 'animal',
          updated_at = now()
      where id = visit_row.id;

      insert into public.hoof_corrections (
        id, farm_id, original_visit_id, correction_visit_id, reason, employee_id, device_id
      ) values (
        gen_random_uuid()::text,
        target_farm.id,
        visit_row.id,
        null,
        'Animal excluído: ' || clean_reason,
        selected_session.employee_id,
        selected_session.device_id
      );
      cancelled_count := cancelled_count + 1;
    end loop;

    insert into public.hoof_admin_audit (
      client_id, employee_id, action, target_type, target_id, details
    ) values (
      selected_session.client_id,
      selected_session.employee_id,
      'remove_animal',
      'animal',
      clean_tag,
      jsonb_build_object(
        'farm_id', target_farm.id,
        'reason', clean_reason,
        'visits_cancelled', cancelled_count
      )
    );

    return jsonb_build_object(
      'ok', true,
      'id', clean_tag,
      'visits_cancelled', cancelled_count
    );
  end if;

  return jsonb_build_object('ok', false, 'message', 'Ação administrativa inválida.');
exception
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'message', 'Identificador inválido.');
end;
$$;

revoke all on function public.hoof_admin_manage_data(text, text, jsonb) from public;
grant execute on function public.hoof_admin_manage_data(text, text, jsonb) to anon, authenticated;
