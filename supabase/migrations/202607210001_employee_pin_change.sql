create or replace function public.change_hoof_employee_pin(
  p_employee_id uuid,
  p_current_pin text,
  p_new_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_employee public.employees%rowtype;
begin
  if p_current_pin !~ '^\d{4,6}$' or p_new_pin !~ '^\d{4,6}$' then
    return jsonb_build_object('ok', false, 'message', 'O PIN deve ter de 4 a 6 números.');
  end if;
  if p_current_pin = p_new_pin then
    return jsonb_build_object('ok', false, 'message', 'Escolha um PIN diferente do atual.');
  end if;

  select * into selected_employee
  from public.employees
  where id = p_employee_id
    and status = 'active'
    and password_hash = crypt(p_current_pin, password_hash)
  limit 1;

  if selected_employee.id is null then
    return jsonb_build_object('ok', false, 'message', 'PIN atual incorreto.');
  end if;

  update public.employees
  set password_hash = crypt(p_new_pin, gen_salt('bf')),
      updated_at = now()
  where id = selected_employee.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.change_hoof_employee_pin(uuid, text, text) from public;
grant execute on function public.change_hoof_employee_pin(uuid, text, text) to anon, authenticated;
