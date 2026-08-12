-- O produto nao limita mais a quantidade de celulares ou tablets por conta/fazenda.
alter table public.clients alter column max_devices drop not null;
alter table public.clients alter column max_devices drop default;
alter table public.farms alter column max_devices drop not null;
alter table public.farms alter column max_devices drop default;

create or replace function public.hoof_force_unlimited_devices()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.max_devices := null;
  return new;
end;
$$;

drop trigger if exists clients_unlimited_devices on public.clients;
create trigger clients_unlimited_devices
before insert or update of max_devices on public.clients
for each row execute function public.hoof_force_unlimited_devices();

drop trigger if exists farms_unlimited_devices on public.farms;
create trigger farms_unlimited_devices
before insert or update of max_devices on public.farms
for each row execute function public.hoof_force_unlimited_devices();

update public.clients set max_devices = null where max_devices is not null;
update public.farms set max_devices = null where max_devices is not null;
