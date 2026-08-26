-- Features operacionais por funcionário e solicitações de atendimento por fazenda.

alter table public.employees
  add column if not exists can_view_financial boolean not null default false;

update public.employees employee
set can_view_financial = true,
    updated_at = now()
from public.clients client
where employee.client_id = client.id
  and client.activation_code = 'HULLSJOB'
  and employee.employee_code in ('001', '002');

create table if not exists public.limping_requests (
  id uuid primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  tag text not null,
  note text,
  photo_storage_path text,
  status text not null default 'new'
    check (status in ('new', 'accepted', 'scheduled', 'attended', 'refused')),
  scheduled_date date,
  created_by uuid references public.employees(id) on delete set null,
  created_by_name text,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  visit_id text references public.hoof_visits(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_limping_requests_farm_status
  on public.limping_requests(farm_id, status, scheduled_date);

alter table public.limping_requests enable row level security;

drop policy if exists "hoof limping request session read" on public.limping_requests;
create policy "hoof limping request session read" on public.limping_requests
for select to anon, authenticated
using (public.hoof_session_can_access_farm(farm_id));

drop policy if exists "hoof limping request session insert" on public.limping_requests;
create policy "hoof limping request session insert" on public.limping_requests
for insert to anon, authenticated
with check (
  public.hoof_session_can_access_farm(farm_id)
  and created_by = public.hoof_session_employee_id()
);

drop policy if exists "hoof limping request session update" on public.limping_requests;
create policy "hoof limping request session update" on public.limping_requests
for update to anon, authenticated
using (public.hoof_session_can_access_farm(farm_id))
with check (public.hoof_session_can_access_farm(farm_id));

create or replace function public.hoof_employee_permissions()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'can_view_financial', employee.can_view_financial,
    'is_admin', employee.is_admin
  )
  from public.hoof_current_session() session
  join public.employees employee
    on employee.id = session.employee_id
   and employee.client_id = session.client_id
   and employee.status = 'active'
  limit 1;
$$;

create or replace function public.hoof_admin_financial_permissions(p_manager_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  selected_session public.employee_sessions%rowtype;
  manager_session public.hoof_manager_sessions%rowtype;
begin
  select * into selected_session from public.hoof_current_session() limit 1;
  select * into manager_session from public.hoof_current_manager(p_manager_token) limit 1;
  if selected_session.id is null or manager_session.id is null or not public.hoof_session_is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Acesso gerente expirado.');
  end if;
  return jsonb_build_object(
    'ok', true,
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'employee_id', employee.id,
        'can_view_financial', employee.can_view_financial
      ))
      from public.employees employee
      where employee.client_id = selected_session.client_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.hoof_admin_set_financial_permission(
  p_manager_token text,
  p_employee_id uuid,
  p_allowed boolean
)
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
  if selected_session.id is null or manager_session.id is null or not public.hoof_session_is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Acesso gerente expirado.');
  end if;
  update public.employees
  set can_view_financial = coalesce(p_allowed, false), updated_at = now()
  where id = p_employee_id and client_id = selected_session.client_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Funcionário inválido.');
  end if;
  insert into public.hoof_admin_audit (client_id, employee_id, action, target_type, target_id, details)
  values (
    selected_session.client_id,
    selected_session.employee_id,
    'set_financial_permission',
    'employee',
    p_employee_id::text,
    jsonb_build_object('allowed', coalesce(p_allowed, false))
  );
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.hoof_employee_permissions() from public;
revoke all on function public.hoof_admin_financial_permissions(text) from public;
revoke all on function public.hoof_admin_set_financial_permission(text, uuid, boolean) from public;
grant execute on function public.hoof_employee_permissions() to anon, authenticated;
grant execute on function public.hoof_admin_financial_permissions(text) to anon, authenticated;
grant execute on function public.hoof_admin_set_financial_permission(text, uuid, boolean) to anon, authenticated;
