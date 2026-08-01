-- Planos recorrentes de revisão e edição segura de funcionários pelo gerente.

alter table public.hoof_feet
  add column if not exists intervalo_revisao_dias integer,
  add column if not exists revisoes_necessarias integer;

alter table public.hoof_feet
  drop constraint if exists hoof_feet_intervalo_revisao_dias_check,
  add constraint hoof_feet_intervalo_revisao_dias_check
    check (intervalo_revisao_dias is null or intervalo_revisao_dias between 1 and 365),
  drop constraint if exists hoof_feet_revisoes_necessarias_check,
  add constraint hoof_feet_revisoes_necessarias_check
    check (revisoes_necessarias is null or revisoes_necessarias between 1 and 24);

create or replace function public.hoof_admin_edit_employee(
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
  clean_name text;
  clean_login text;
  clean_code text;
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

  clean_name := trim(coalesce(p_payload ->> 'name', ''));
  clean_login := trim(coalesce(p_payload ->> 'login_name', ''));
  clean_code := trim(coalesce(p_payload ->> 'employee_code', ''));
  if length(clean_name) < 2 or length(clean_name) > 80
     or length(clean_login) < 2 or length(clean_login) > 80
     or length(clean_code) < 1 or length(clean_code) > 30 then
    return jsonb_build_object('ok', false, 'message', 'Revise nome, login e código.');
  end if;

  update public.employees
  set name = clean_name,
      login_name = clean_login,
      employee_code = clean_code,
      updated_at = now()
  where id = target_employee.id;

  insert into public.hoof_admin_audit (
    client_id, employee_id, action, target_type, target_id, details
  ) values (
    selected_session.client_id,
    selected_session.employee_id,
    'edit_employee',
    'employee',
    target_employee.id::text,
    jsonb_build_object(
      'name', clean_name,
      'login_name', clean_login,
      'employee_code', clean_code
    )
  );

  return jsonb_build_object('ok', true, 'id', target_employee.id::text);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'message', 'Login ou código já cadastrado nesta empresa.');
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'message', 'Funcionário inválido.');
end;
$$;

revoke all on function public.hoof_admin_edit_employee(text, jsonb) from public;
grant execute on function public.hoof_admin_edit_employee(text, jsonb) to anon, authenticated;
