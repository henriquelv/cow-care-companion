create extension if not exists "pgcrypto";

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  activation_code text not null unique,
  status text not null default 'active' check (status in ('active', 'blocked', 'expired')),
  max_devices integer not null default 10,
  grace_period_days integer not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  activation_code text unique,
  status text not null default 'active' check (status in ('active', 'blocked', 'expired')),
  max_devices integer not null default 10,
  grace_period_days integer not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.farms add column if not exists client_id uuid references public.clients(id) on delete cascade;
alter table public.farms alter column activation_code drop not null;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  employee_code text,
  login_name text,
  password_hash text,
  name text not null,
  status text not null default 'active' check (status in ('active', 'blocked')),
  is_admin boolean not null default false,
  admin_pin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees add column if not exists client_id uuid references public.clients(id) on delete cascade;
alter table public.employees add column if not exists employee_code text;
alter table public.employees add column if not exists login_name text;
alter table public.employees add column if not exists password_hash text;

create table if not exists public.employee_farms (
  employee_id uuid not null references public.employees(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employee_id, farm_id)
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  device_id text not null,
  device_name text,
  status text not null default 'active' check (status in ('active', 'blocked')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, device_id)
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'blocked', 'expired')),
  starts_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hoof_visits (
  id text primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  tag text not null,
  sex text not null default 'vaca',
  lote text,
  date date not null,
  created_at timestamptz not null default now(),
  preventivo boolean not null default false,
  visitante_nome text,
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text,
  device_id text,
  status text not null default 'active' check (status in ('active', 'corrected', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.hoof_feet (
  id text primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  visit_id text not null references public.hoof_visits(id) on delete cascade,
  foot text not null,
  ok boolean not null default true,
  zones jsonb not null default '[]'::jsonb,
  diseases jsonb not null default '[]'::jsonb,
  treatments jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  nota text,
  recheck boolean,
  recheck_date date,
  resolved boolean,
  data_liberacao date,
  numero_revisoes integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.animals (
  id text primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  tag text not null,
  sex text not null default 'vaca',
  lote text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, tag)
);

create table if not exists public.farm_lotes (
  id text primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, name)
);

create table if not exists public.hoof_media (
  id text primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  visit_id text references public.hoof_visits(id) on delete cascade,
  foot text,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.hoof_corrections (
  id text primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  original_visit_id text not null references public.hoof_visits(id) on delete cascade,
  correction_visit_id text references public.hoof_visits(id) on delete set null,
  reason text,
  employee_id uuid references public.employees(id) on delete set null,
  device_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.farm_settings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  dias_para_preventivo integer not null default 180,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id)
);

create index if not exists idx_hoof_visits_farm_date on public.hoof_visits(farm_id, date desc);
create index if not exists idx_hoof_visits_farm_tag on public.hoof_visits(farm_id, tag);
create index if not exists idx_hoof_feet_farm_visit on public.hoof_feet(farm_id, visit_id);
create index if not exists idx_animals_farm_tag on public.animals(farm_id, tag);
create index if not exists idx_devices_farm_device on public.devices(farm_id, device_id);
create index if not exists idx_farms_client on public.farms(client_id, name);
create unique index if not exists idx_employees_client_login
  on public.employees(client_id, lower(login_name))
  where client_id is not null and login_name is not null;
create unique index if not exists idx_employees_client_code
  on public.employees(client_id, employee_code)
  where client_id is not null and employee_code is not null;

insert into public.clients (name, activation_code, status)
values ('StarMilk', 'STARMILK', 'active')
on conflict (activation_code) do update
set name = excluded.name,
    status = excluded.status;

insert into public.farms (client_id, name, activation_code, status)
select id, 'StarMilk', 'STARMILK', 'active'
from public.clients
where activation_code = 'STARMILK'
on conflict (activation_code) do update
set client_id = excluded.client_id,
    name = excluded.name,
    status = excluded.status;

insert into public.clients (name, activation_code, status)
values ('Hullsjob', 'HULLSJOB', 'active')
on conflict (activation_code) do update
set name = excluded.name,
    status = excluded.status;

insert into public.farms (client_id, name, activation_code, status)
select id, 'Fazenda Vitória', 'HULLSJOB-VITORIA', 'active'
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
  farm_id, client_id, employee_code, login_name, password_hash, name, is_admin, admin_pin
)
select f.id, f.client_id, '001', 'StarMilk', crypt('1234', gen_salt('bf')), 'StarMilk', true, null
from public.farms f
where f.activation_code = 'STARMILK'
on conflict do nothing;

insert into public.employees (
  farm_id, client_id, employee_code, login_name, password_hash, name, is_admin, admin_pin
)
select f.id, f.client_id, seed.employee_code, seed.login_name,
       crypt('1234', gen_salt('bf')), seed.name, false, null
from public.farms f
cross join (values
  ('001', 'Romano', 'Romano'),
  ('002', 'Jeová', 'Jeová'),
  ('003', 'Patrick', 'Patrick')
) as seed(employee_code, login_name, name)
where f.activation_code = 'HULLSJOB-VITORIA'
on conflict do nothing;

insert into public.employee_farms (employee_id, farm_id)
select e.id, e.farm_id
from public.employees e
where e.client_id in (
  select id from public.clients where activation_code in ('STARMILK', 'HULLSJOB')
)
on conflict do nothing;

insert into public.licenses (farm_id, status, starts_at, expires_at)
select id, 'active', now(), now() + interval '15 days'
from public.farms
where activation_code = 'STARMILK'
  and not exists (
    select 1
    from public.licenses
    where licenses.farm_id = farms.id
  );

insert into public.licenses (farm_id, status, starts_at, expires_at)
select id, 'active', now(), now() + interval '15 days'
from public.farms
where activation_code = 'HULLSJOB-VITORIA'
  and not exists (
    select 1
    from public.licenses
    where licenses.farm_id = farms.id
  );
