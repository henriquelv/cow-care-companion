alter table public.hoof_visits
  add column if not exists work_session_id uuid;

create index if not exists idx_hoof_visits_work_session
  on public.hoof_visits(farm_id, work_session_id)
  where work_session_id is not null;

create table if not exists public.hoof_work_sessions (
  id uuid primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  employee_name text not null,
  device_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (status = 'active' or ended_at is not null)
);

create index if not exists idx_hoof_work_sessions_farm_started
  on public.hoof_work_sessions(farm_id, started_at desc);
create index if not exists idx_hoof_work_sessions_employee_started
  on public.hoof_work_sessions(employee_id, started_at desc);

alter table public.hoof_work_sessions enable row level security;
grant select, insert, update on public.hoof_work_sessions to anon, authenticated;

drop policy if exists "hoof work session read" on public.hoof_work_sessions;
drop policy if exists "hoof work session insert" on public.hoof_work_sessions;
drop policy if exists "hoof work session update" on public.hoof_work_sessions;

create policy "hoof work session read" on public.hoof_work_sessions
  for select to anon, authenticated
  using (public.hoof_session_can_access_farm(farm_id));

create policy "hoof work session insert" on public.hoof_work_sessions
  for insert to anon, authenticated
  with check (
    public.hoof_session_can_access_farm(farm_id)
    and employee_id = public.hoof_session_employee_id()
    and device_id = public.hoof_session_device_id()
  );

create policy "hoof work session update" on public.hoof_work_sessions
  for update to anon, authenticated
  using (
    public.hoof_session_can_access_farm(farm_id)
    and employee_id = public.hoof_session_employee_id()
    and device_id = public.hoof_session_device_id()
  )
  with check (
    public.hoof_session_can_access_farm(farm_id)
    and employee_id = public.hoof_session_employee_id()
    and device_id = public.hoof_session_device_id()
  );

create or replace function public.protect_hoof_work_session_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  session_employee_id uuid;
  session_employee_name text;
begin
  if tg_op = 'INSERT' then
    session_employee_id := public.hoof_session_employee_id();
    select name into session_employee_name from public.employees where id = session_employee_id;
    if session_employee_id is null or session_employee_name is null then
      raise exception 'Sessão de funcionário inválida';
    end if;
    new.employee_id := session_employee_id;
    new.employee_name := session_employee_name;
    new.device_id := public.hoof_session_device_id();
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.farm_id is distinct from old.farm_id
     or new.employee_id is distinct from old.employee_id
     or new.employee_name is distinct from old.employee_name
     or new.device_id is distinct from old.device_id
     or new.started_at is distinct from old.started_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Identificação da visita à fazenda é imutável';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_hoof_work_session_fields on public.hoof_work_sessions;
create trigger protect_hoof_work_session_fields
before insert or update on public.hoof_work_sessions
for each row execute function public.protect_hoof_work_session_fields();
