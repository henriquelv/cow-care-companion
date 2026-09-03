-- Perfil operacional compartilhado solicitado pela Hullsjob.
-- Sem administração e sem acesso financeiro.

insert into public.employees (
  id,
  farm_id,
  client_id,
  employee_code,
  login_name,
  password_hash,
  name,
  status,
  is_admin,
  can_view_financial
)
select
  '30000000-0000-4000-8000-000000000005'::uuid,
  farm.id,
  client.id,
  '004',
  'Funcionários da Fazenda',
  extensions.crypt('1234', extensions.gen_salt('bf', 12)),
  'Funcionários da Fazenda',
  'active',
  false,
  false
from public.clients client
join public.farms farm on farm.client_id = client.id
where client.activation_code = 'HULLSJOB'
  and farm.name = 'Fazenda Vitória'
  and not exists (
    select 1
    from public.employees employee
    where employee.client_id = client.id
      and (
        employee.employee_code = '004'
        or lower(employee.login_name) = lower('Funcionários da Fazenda')
      )
  );

insert into public.employee_farms (employee_id, farm_id)
select employee.id, farm.id
from public.employees employee
join public.clients client on client.id = employee.client_id
join public.farms farm on farm.client_id = client.id
where client.activation_code = 'HULLSJOB'
  and employee.employee_code = '004'
  and farm.name = 'Fazenda Vitória'
on conflict do nothing;

update public.employees employee
set status = 'active',
    is_admin = false,
    can_view_financial = false,
    updated_at = now()
from public.clients client
where employee.client_id = client.id
  and client.activation_code = 'HULLSJOB'
  and employee.employee_code = '004';
