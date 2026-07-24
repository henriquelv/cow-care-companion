with default_catalog as (
  select jsonb_build_array(
    jsonb_build_object('code', 'SH', 'name', 'Laminite', 'full', 'Hemorragia de Sola / Laminite', 'emoji', '🟡', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'SU', 'name', 'Úlcera Sola', 'full', 'Úlcera de Sola', 'emoji', '🔴', 'recheckDays', 21, 'active', true),
    jsonb_build_object('code', 'BU', 'name', 'Fratura Sola', 'full', 'Fratura de Sola', 'emoji', '🟠', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'SOLE_ABSCESS', 'name', 'Abscesso', 'full', 'Abscesso de Sola', 'emoji', '🟤', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'WU', 'name', 'Úlcera Parede', 'full', 'Úlcera de Parede', 'emoji', '🧱', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'TU', 'name', 'Necrose', 'full', 'Úlcera da Ponta / Necrose', 'emoji', '⚫', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'LB', 'name', 'Linha Branca', 'full', 'Linha Branca', 'emoji', '⬜', 'recheckDays', 21, 'active', true),
    jsonb_build_object('code', 'DD', 'name', 'Derm. Digital', 'full', 'Dermatite Digital', 'emoji', '🦠', 'recheckDays', 7, 'active', true),
    jsonb_build_object('code', 'HHE', 'name', 'Talão c/ Lama', 'full', 'Talão por Lama / Esterco', 'emoji', '💧', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'HI', 'name', 'Hiperplasia', 'full', 'Hiperplasia Interdigital', 'emoji', '🌿', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'FF', 'name', 'Fleimão', 'full', 'Fleimão / Podridão do Pé', 'emoji', '🦨', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'J', 'name', 'Inf. Articular', 'full', 'Infecção Articular', 'emoji', '🔩', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'LM', 'name', 'Les. Membro', 'full', 'Lesão de Membro', 'emoji', '🦵', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'TS', 'name', 'Sola Fina', 'full', 'Sola Fina', 'emoji', '📏', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'P', 'name', 'Perfuração', 'full', 'Perfuração', 'emoji', '📌', 'recheckDays', 30, 'active', true),
    jsonb_build_object('code', 'X', 'name', 'Descarte', 'full', 'Descarte — Retirar do Lote', 'emoji', '❌', 'recheckDays', 30, 'active', true)
  ) as diseases
)
insert into public.farm_settings (id, farm_id, dias_para_preventivo, payload)
select
  farm.id,
  farm.id,
  180,
  jsonb_build_object('diseases', default_catalog.diseases)
from public.farms farm
cross join default_catalog
on conflict (farm_id) do update
set payload = coalesce(public.farm_settings.payload, '{}'::jsonb)
    || jsonb_build_object('diseases', excluded.payload -> 'diseases'),
    updated_at = now();
