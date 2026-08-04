-- Novas categorias clínicas sem sobrescrever o catálogo personalizado da fazenda.

update public.farm_settings as settings
set payload = jsonb_set(
  settings.payload,
  '{diseases}',
  (
    case
      when jsonb_typeof(settings.payload->'diseases') = 'array' then settings.payload->'diseases'
      else '[]'::jsonb
    end
  )
  || case
    when (settings.payload->'diseases') @> '[{"code":"DOUBLE_SOLE"}]'::jsonb then '[]'::jsonb
    else jsonb_build_array(
      jsonb_build_object(
        'code', 'DOUBLE_SOLE',
        'name', 'Sola Dupla',
        'full', 'Sola Dupla',
        'emoji', '🟣',
        'recheckDays', 30,
        'active', true
      )
    )
  end
  || case
    when (settings.payload->'diseases') @> '[{"code":"LOCOMOTION"}]'::jsonb then '[]'::jsonb
    else jsonb_build_array(
      jsonb_build_object(
        'code', 'LOCOMOTION',
        'name', 'Locomoção',
        'full', 'Problema de Locomoção',
        'emoji', '🚶',
        'recheckDays', 30,
        'active', true
      )
    )
  end,
  true
)
where settings.payload ? 'diseases';
