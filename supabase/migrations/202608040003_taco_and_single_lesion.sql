-- Taco e uma lesão clínica por casco.

alter table public.hoof_feet
  add column if not exists taco_action text,
  add column if not exists taco_side text;

alter table public.hoof_feet
  drop constraint if exists hoof_feet_taco_action_check,
  add constraint hoof_feet_taco_action_check
    check (taco_action is null or taco_action in ('apply', 'remove', 'maintain')),
  drop constraint if exists hoof_feet_taco_side_check,
  add constraint hoof_feet_taco_side_check
    check (taco_side is null or taco_side in ('left', 'right')),
  drop constraint if exists hoof_feet_taco_complete_check,
  add constraint hoof_feet_taco_complete_check
    check ((taco_action is null and taco_side is null) or (taco_action is not null and taco_side is not null));

update public.farm_settings as settings
set payload = jsonb_set(
  settings.payload,
  '{diseases}',
  coalesce(
    (
      select jsonb_agg(
        case
          when disease->>'code' = 'FF' then
            disease || jsonb_build_object(
              'name', 'Flegmão',
              'full', 'Flegmão / Podridão do Pé'
            )
          else disease
        end
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(settings.payload->'diseases') = 'array' then settings.payload->'diseases'
          else '[]'::jsonb
        end
      ) as disease
      where disease->>'code' <> 'HHE'
    ),
    '[]'::jsonb
  ),
  true
)
where settings.payload ? 'diseases';
