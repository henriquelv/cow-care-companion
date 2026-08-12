-- Mantem apenas a licenca mais recente de cada fazenda de producao ativa e sem vencimento.
with ranked_licenses as (
  select
    license.id,
    row_number() over (
      partition by license.farm_id
      order by license.created_at desc, license.id desc
    ) as position
  from public.licenses license
  join public.farms farm on farm.id = license.farm_id
  where farm.activation_code in ('STARMILK', 'HULLSJOB-VITORIA')
)
update public.licenses license
set status = case when ranked.position = 1 then 'active' else 'expired' end,
    starts_at = case when ranked.position = 1 then coalesce(license.starts_at, now()) else license.starts_at end,
    expires_at = case when ranked.position = 1 then null else license.expires_at end,
    updated_at = now()
from ranked_licenses ranked
where license.id = ranked.id;

insert into public.licenses (farm_id, status, starts_at, expires_at)
select farm.id, 'active', now(), null
from public.farms farm
where farm.activation_code in ('STARMILK', 'HULLSJOB-VITORIA')
  and farm.status = 'active'
  and not exists (
    select 1 from public.licenses license where license.farm_id = farm.id
  );
