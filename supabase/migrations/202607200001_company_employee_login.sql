create extension if not exists "pgcrypto";

alter table public.employees add column if not exists client_id uuid references public.clients(id) on delete cascade;
alter table public.employees add column if not exists employee_code text;
alter table public.employees add column if not exists login_name text;
alter table public.employees add column if not exists password_hash text;

update public.employees e
set client_id = f.client_id
from public.farms f
where e.farm_id = f.id
  and e.client_id is null;

create table if not exists public.employee_farms (
  employee_id uuid not null references public.employees(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employee_id, farm_id)
);

create unique index if not exists idx_employees_client_login
  on public.employees(client_id, lower(login_name))
  where client_id is not null and login_name is not null;
create unique index if not exists idx_employees_client_code
  on public.employees(client_id, employee_code)
  where client_id is not null and employee_code is not null;

insert into public.clients (id, name, activation_code, status)
values
  ('10000000-0000-4000-8000-000000000001', 'StarMilk', 'STARMILK', 'active'),
  ('10000000-0000-4000-8000-000000000002', 'Hullsjob', 'HULLSJOB', 'active')
on conflict (activation_code) do update
set name = excluded.name,
    status = excluded.status;

insert into public.farms (id, client_id, name, activation_code, status)
select '20000000-0000-4000-8000-000000000001', id, 'StarMilk', 'STARMILK', 'active'
from public.clients
where activation_code = 'STARMILK'
on conflict (activation_code) do update
set client_id = excluded.client_id,
    name = excluded.name,
    status = excluded.status;

insert into public.farms (id, client_id, name, activation_code, status)
select '20000000-0000-4000-8000-000000000002', id, 'Fazenda Vitória', 'HULLSJOB-VITORIA', 'active'
from public.clients
where activation_code = 'HULLSJOB'
on conflict (activation_code) do update
set client_id = excluded.client_id,
    name = excluded.name,
    status = excluded.status;

delete from public.employees
where name = 'Teste'
  and farm_id in (select id from public.farms where activation_code = 'STARMILK');

insert into public.employees (
  id, farm_id, client_id, employee_code, login_name, password_hash, name, is_admin, admin_pin
)
select '30000000-0000-4000-8000-000000000001', f.id, f.client_id,
       '001', 'StarMilk', crypt('1234', gen_salt('bf')), 'StarMilk', true, null
from public.farms f
where f.activation_code = 'STARMILK'
on conflict do nothing;

insert into public.employees (
  id, farm_id, client_id, employee_code, login_name, password_hash, name, is_admin, admin_pin
)
select seed.id, f.id, f.client_id, seed.employee_code, seed.login_name,
       crypt('1234', gen_salt('bf')), seed.name, false, null
from public.farms f
cross join (values
  ('30000000-0000-4000-8000-000000000002'::uuid, '001', 'Romano', 'Romano'),
  ('30000000-0000-4000-8000-000000000003'::uuid, '002', 'Jeová', 'Jeová'),
  ('30000000-0000-4000-8000-000000000004'::uuid, '003', 'Patrick', 'Patrick')
) as seed(id, employee_code, login_name, name)
where f.activation_code = 'HULLSJOB-VITORIA'
on conflict do nothing;

insert into public.employee_farms (employee_id, farm_id)
select e.id, e.farm_id
from public.employees e
where e.client_id in (
  select id from public.clients where activation_code in ('STARMILK', 'HULLSJOB')
)
on conflict do nothing;

update public.licenses l
set status = 'active',
    starts_at = now(),
    expires_at = now() + interval '15 days',
    updated_at = now()
from public.farms f
where l.farm_id = f.id
  and f.activation_code in ('STARMILK', 'HULLSJOB-VITORIA');

insert into public.licenses (farm_id, status, starts_at, expires_at)
select f.id, 'active', now(), now() + interval '15 days'
from public.farms f
where f.activation_code in ('STARMILK', 'HULLSJOB-VITORIA')
  and not exists (
    select 1 from public.licenses l where l.farm_id = f.id
  );

create or replace function public.authenticate_hoof_employee(
  p_activation_code text,
  p_login text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_client public.clients%rowtype;
  selected_employee public.employees%rowtype;
  allowed_farms jsonb;
begin
  select * into selected_client
  from public.clients
  where activation_code = upper(trim(p_activation_code))
    and status = 'active';

  if selected_client.id is null then
    return null;
  end if;

  select * into selected_employee
  from public.employees
  where client_id = selected_client.id
    and status = 'active'
    and (
      lower(login_name) = lower(trim(p_login))
      or employee_code = trim(p_login)
    )
    and password_hash is not null
    and password_hash = crypt(p_password, password_hash)
  limit 1;

  if selected_employee.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.name), '[]'::jsonb)
  into allowed_farms
  from public.employee_farms ef
  join public.farms f on f.id = ef.farm_id
  where ef.employee_id = selected_employee.id
    and f.client_id = selected_client.id
    and f.status = 'active'
    and exists (
      select 1
      from public.licenses l
      where l.farm_id = f.id
        and l.status = 'active'
        and (l.expires_at is null or l.expires_at >= now())
    );

  return jsonb_build_object(
    'client', jsonb_build_object(
      'id', selected_client.id,
      'name', selected_client.name,
      'activation_code', selected_client.activation_code,
      'status', selected_client.status,
      'max_devices', selected_client.max_devices,
      'grace_period_days', selected_client.grace_period_days
    ),
    'employee', jsonb_build_object(
      'id', selected_employee.id,
      'farm_id', selected_employee.farm_id,
      'client_id', selected_employee.client_id,
      'employee_code', selected_employee.employee_code,
      'login_name', selected_employee.login_name,
      'name', selected_employee.name,
      'status', selected_employee.status,
      'is_admin', selected_employee.is_admin,
      'admin_pin', selected_employee.admin_pin
    ),
    'farms', allowed_farms
  );
end;
$$;

revoke all on function public.authenticate_hoof_employee(text, text, text) from public;
grant execute on function public.authenticate_hoof_employee(text, text, text) to anon, authenticated;
