-- Renova as duas contas de producao sem apagar o historico das licencas vencidas.
insert into public.licenses (farm_id, status, starts_at, expires_at)
select farm.id, 'active', now(), now() + interval '15 days'
from public.farms farm
where farm.activation_code in ('STARMILK', 'HULLSJOB-VITORIA')
  and farm.status = 'active'
  and not exists (
    select 1
    from public.licenses license
    where license.farm_id = farm.id
      and license.status = 'active'
      and (license.starts_at is null or license.starts_at <= now())
      and (license.expires_at is null or license.expires_at >= now())
  );
