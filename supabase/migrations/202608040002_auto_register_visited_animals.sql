-- Toda visita ativa deve possuir um animal correspondente na mesma fazenda.

create or replace function public.register_animal_from_hoof_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_tag text := trim(coalesce(new.tag, ''));
  clean_lote text := nullif(upper(trim(coalesce(new.lote, ''))), '');
begin
  if new.status <> 'active' or clean_tag = '' then
    return new;
  end if;

  update public.animals
  set sex = coalesce(nullif(new.sex, ''), animals.sex, 'vaca'),
      lote = coalesce(clean_lote, animals.lote),
      status = 'active',
      updated_at = now()
  where farm_id = new.farm_id
    and lower(trim(tag)) = lower(clean_tag);

  if not found then
    insert into public.animals (id, farm_id, tag, sex, lote, status)
    values (
      new.farm_id::text || '_' || clean_tag,
      new.farm_id,
      clean_tag,
      coalesce(nullif(new.sex, ''), 'vaca'),
      clean_lote,
      'active'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.register_animal_from_hoof_visit() from public;

drop trigger if exists register_animal_from_hoof_visit on public.hoof_visits;
create trigger register_animal_from_hoof_visit
after insert or update of tag, sex, lote, status on public.hoof_visits
for each row execute function public.register_animal_from_hoof_visit();

with latest_visit as (
  select distinct on (visit.farm_id, lower(trim(visit.tag)))
    visit.farm_id,
    trim(visit.tag) as tag,
    coalesce(nullif(visit.sex, ''), 'vaca') as sex,
    nullif(upper(trim(coalesce(visit.lote, ''))), '') as lote
  from public.hoof_visits visit
  where visit.status = 'active'
    and trim(visit.tag) <> ''
  order by visit.farm_id, lower(trim(visit.tag)), visit.created_at desc
)
insert into public.animals (id, farm_id, tag, sex, lote, status)
select
  latest.farm_id::text || '_' || latest.tag,
  latest.farm_id,
  latest.tag,
  latest.sex,
  latest.lote,
  'active'
from latest_visit latest
where not exists (
  select 1
  from public.animals animal
  where animal.farm_id = latest.farm_id
    and lower(trim(animal.tag)) = lower(latest.tag)
)
on conflict do nothing;
