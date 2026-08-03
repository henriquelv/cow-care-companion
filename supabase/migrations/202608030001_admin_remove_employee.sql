-- Exclusão operacional segura de funcionários, sem apagar o histórico clínico.

create or replace function public.hoof_admin_remove_employee(
  p_manager_token text,
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
  target_employee public.employees%rowtype;
begin
  select * into selected_session from public.hoof_current_session() limit 1;
  select * into manager_session from public.hoof_current_manager(p_manager_token) limit 1;
  if selected_session.id is null or manager_session.id is null then
    return jsonb_build_object('ok', false, 'message', 'Acesso gerente expirado.');
  end if;
  if not public.hoof_session_is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Permissão de administrador removida.');
  end if;

  select * into target_employee
  from public.employees
  where id = (p_payload ->> 'employee_id')::uuid
    and client_id = selected_session.client_id;
  if target_employee.id is null then
    return jsonb_build_object('ok', false, 'message', 'Funcionário inválido.');
  end if;
  if target_employee.id = selected_session.employee_id then
    return jsonb_build_object('ok', false, 'message', 'Você não pode excluir seu próprio acesso.');
  end if;

  update public.employees
  set status = 'blocked',
      is_admin = false,
      updated_at = now()
  where id = target_employee.id;

  update public.employee_sessions
  set revoked_at = now()
  where employee_id = target_employee.id
    and revoked_at is null;

  insert into public.hoof_admin_audit (
    client_id, employee_id, action, target_type, target_id, details
  ) values (
    selected_session.client_id,
    selected_session.employee_id,
    'remove_employee',
    'employee',
    target_employee.id::text,
    jsonb_build_object(
      'name', target_employee.name,
      'history_preserved', true,
      'sessions_revoked', true
    )
  );

  return jsonb_build_object('ok', true, 'id', target_employee.id::text);
exception
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'message', 'Funcionário inválido.');
end;
$$;

revoke all on function public.hoof_admin_remove_employee(text, jsonb) from public;
grant execute on function public.hoof_admin_remove_employee(text, jsonb) to anon, authenticated;
