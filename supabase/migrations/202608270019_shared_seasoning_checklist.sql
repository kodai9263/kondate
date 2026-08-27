alter table public.recipe_steps
  drop constraint if exists recipe_steps_phase_check;

alter table public.recipe_steps
  add constraint recipe_steps_phase_check
  check (phase in ('morning', 'seasoning', 'evening'));

insert into public.recipe_steps (recipe_id, phase, position, text)
select
  r.id,
  'seasoning',
  ingredient.position::int - 1,
  trim(ingredient.text)
from public.recipes r
cross join lateral regexp_split_to_table(
  coalesce(r.meta ->> 'ingredients_text', ''),
  E'\\r?\\n'
) with ordinality as ingredient(text, position)
where trim(ingredient.text) <> ''
on conflict (recipe_id, phase, position) do nothing;

create or replace function public.create_household_recipe(
  recipe_name text,
  recipe_side text,
  recipe_cook_minutes int,
  recipe_protein_source text,
  recipe_image_url text,
  recipe_ingredients text,
  recipe_steps text,
  nutrition_energy_kcal numeric,
  nutrition_protein_g numeric,
  nutrition_fat_g numeric,
  nutrition_carbs_g numeric,
  nutrition_fiber_g numeric,
  nutrition_salt_g numeric,
  nutrition_vegetables_g numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid;
  created_recipe_id uuid;
  ingredients_text text := recipe_ingredients;
  steps_text text := recipe_steps;
begin
  target_household_id := public.current_household_id();
  if target_household_id is null then
    raise exception 'authentication required';
  end if;

  if trim(recipe_name) = '' or recipe_cook_minutes < 0 then
    raise exception 'invalid recipe';
  end if;

  insert into public.recipes (
    household_id, name, category, servings_base, cook_minutes,
    image_url, protein_source, meta
  ) values (
    target_household_id, trim(recipe_name), 'main', 4, recipe_cook_minutes,
    nullif(trim(recipe_image_url), ''), recipe_protein_source,
    jsonb_build_object('side', recipe_side, 'ingredients_text', ingredients_text, 'steps_text', steps_text)
  ) returning id into created_recipe_id;

  insert into public.recipe_nutrition (
    recipe_id, energy_kcal, protein_g, fat_g, carbs_g,
    fiber_g, salt_g, vegetables_g, source
  ) values (
    created_recipe_id, nutrition_energy_kcal, nutrition_protein_g, nutrition_fat_g,
    nutrition_carbs_g, nutrition_fiber_g, nutrition_salt_g, nutrition_vegetables_g,
    'user_estimate'
  );

  insert into public.recipe_steps (recipe_id, phase, position, text)
  select created_recipe_id, 'seasoning', line.position::int - 1, trim(line.text)
  from regexp_split_to_table(ingredients_text, E'\\r?\\n') with ordinality as line(text, position)
  where trim(line.text) <> '';

  insert into public.recipe_steps (recipe_id, phase, position, text)
  select created_recipe_id, 'evening', line.position::int - 1, trim(line.text)
  from regexp_split_to_table(steps_text, E'\\r?\\n') with ordinality as line(text, position)
  where trim(line.text) <> '';

  return created_recipe_id;
end;
$$;

revoke all on function public.create_household_recipe(
  text, text, int, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from public;
grant execute on function public.create_household_recipe(
  text, text, int, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric
) to authenticated;

comment on constraint recipe_steps_phase_check on public.recipe_steps
  is '朝の仕込み、調味料と材料の準備、夜の調理手順を区別する';
