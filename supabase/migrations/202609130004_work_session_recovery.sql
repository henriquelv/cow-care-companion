-- Impede sessoes de trabalho duplicadas e permite reparar sessoes esquecidas pela conta mestra.

insert into public.hoof_admin_audit (client_id, action, target_type, details)
select
  farm.client_id,
  'system_close_stale_work_sessions',
  'hoof_work_session',
  jsonb_build_object('count', count(*), 'reason', 'Sessao aberta por mais de 12 horas')
from public.hoof_work_sessions work_session
join public.farms farm on farm.id = work_session.farm_id
where work_session.status = 'active'
  and work_session.started_at < now() - interval '12 hours'
group by farm.client_id;

update public.hoof_work_sessions
set status = 'cancelled',
    ended_at = coalesce(ended_at, now()),
    updated_at = now()
where status = 'active'
  and started_at < now() - interval '12 hours';

create or replace function public.protect_hoof_work_session_fields()
returns trigger
language plpgsql
security definer
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
      raise exception 'Sessao de funcionario invalida';
    end if;
    new.employee_id := session_employee_id;
    new.employee_name := session_employee_name;
    new.device_id := public.hoof_session_device_id();
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();

    if new.status = 'active' and exists (
      select 1
      from public.hoof_work_sessions existing
      where existing.farm_id = new.farm_id
        and existing.employee_id = new.employee_id
        and existing.status = 'active'
        and existing.started_at > new.started_at
    ) then
      new.status := 'cancelled';
      new.ended_at := coalesce(new.ended_at, new.started_at);
    elsif new.status = 'active' then
      update public.hoof_work_sessions existing
      set status = 'cancelled',
          ended_at = coalesce(existing.ended_at, new.started_at),
          updated_at = now()
      where existing.farm_id = new.farm_id
        and existing.employee_id = new.employee_id
        and existing.status = 'active'
        and existing.started_at <= new.started_at;
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.farm_id is distinct from old.farm_id
     or new.employee_id is distinct from old.employee_id
     or new.employee_name is distinct from old.employee_name
     or new.device_id is distinct from old.device_id
     or new.started_at is distinct from old.started_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Identificacao da visita a fazenda e imutavel';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.hoof_platform_close_stale_work_sessions(p_manager_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_session public.employee_sessions%rowtype;
  repaired_count integer := 0;
begin
  if not public.hoof_platform_authorized(p_manager_token) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Acesso central expirado. Confirme o PIN novamente.'
    );
  end if;
  select * into selected_session from public.hoof_current_session() limit 1;

  update public.hoof_work_sessions
  set status = 'cancelled',
      ended_at = coalesce(ended_at, now()),
      updated_at = now()
  where status = 'active'
    and started_at < now() - interval '12 hours';
  get diagnostics repaired_count = row_count;

  insert into public.hoof_admin_audit (
    client_id, employee_id, action, target_type, details
  ) values (
    selected_session.client_id,
    selected_session.employee_id,
    'platform_close_stale_work_sessions',
    'hoof_work_session',
    jsonb_build_object('count', repaired_count, 'older_than_hours', 12)
  );

  return jsonb_build_object('ok', true, 'repaired_count', repaired_count);
end;
$$;

revoke all on function public.hoof_platform_close_stale_work_sessions(text) from public;
grant execute on function public.hoof_platform_close_stale_work_sessions(text) to anon, authenticated;
