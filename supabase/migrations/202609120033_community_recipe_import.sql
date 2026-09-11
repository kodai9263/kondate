create unique index if not exists recipes_community_source_url_idx
  on public.recipes ((meta ->> 'source_url'))
  where household_id is null
    and meta ->> 'visibility' = 'community';

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
  nutrition_vegetables_g numeric,
  recipe_source_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid := public.current_household_id();
  created_recipe_id uuid;
  source_url text := nullif(trim(recipe_source_url), '');
  ingredients_text text := recipe_ingredients;
  steps_text text := recipe_steps;
begin
  if target_household_id is null then
    raise exception 'authentication required';
  end if;

  if trim(recipe_name) = '' or recipe_cook_minutes < 0 then
    raise exception 'invalid recipe';
  end if;
  if source_url is not null and source_url !~ '^https://' then
    raise exception 'invalid source url';
  end if;

  insert into public.recipes (
    household_id, name, category, servings_base, cook_minutes,
    image_url, protein_source, meta
  ) values (
    target_household_id, trim(recipe_name), 'main', 4, recipe_cook_minutes,
    nullif(trim(recipe_image_url), ''), recipe_protein_source,
    jsonb_strip_nulls(jsonb_build_object(
      'side', recipe_side,
      'ingredients_text', recipe_ingredients,
      'steps_text', recipe_steps,
      'source_url', source_url
    ))
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
  from regexp_split_to_table(ingredients_text, E'\r?\n') with ordinality as line(text, position)
  where trim(line.text) <> '';

  insert into public.recipe_steps (recipe_id, phase, position, text)
  select created_recipe_id, 'evening', line.position::int - 1, trim(line.text)
  from regexp_split_to_table(steps_text, E'\r?\n') with ordinality as line(text, position)
  where trim(line.text) <> '';

  return created_recipe_id;
end;
$$;

revoke all on function public.create_household_recipe(
  text, text, int, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) from public;
grant execute on function public.create_household_recipe(
  text, text, int, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) to authenticated;

create or replace function public.create_community_recipe(
  recipe_publisher_user_id uuid,
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
  nutrition_vegetables_g numeric,
  recipe_source_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_recipe_id uuid := pg_catalog.gen_random_uuid();
  source_url text := nullif(trim(recipe_source_url), '');
  ingredients_text text := recipe_ingredients;
  steps_text text := recipe_steps;
begin
  if recipe_publisher_user_id is null or trim(recipe_name) = '' or recipe_cook_minutes < 0 then
    raise exception 'invalid recipe';
  end if;
  if source_url is null or source_url !~ '^https://' then
    raise exception 'source url required';
  end if;

  insert into public.recipes (
    id, household_id, name, category, servings_base, cook_minutes,
    image_url, protein_source, meta
  ) values (
    created_recipe_id, null, trim(recipe_name), 'main', 4, recipe_cook_minutes,
    nullif(trim(recipe_image_url), ''), recipe_protein_source,
    jsonb_build_object(
      'visibility', 'community',
      'community_key', 'community:' || created_recipe_id::text,
      'published_by', recipe_publisher_user_id::text,
      'side', recipe_side,
      'ingredients_text', recipe_ingredients,
      'steps_text', recipe_steps,
      'source_url', source_url
    )
  );

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
  from regexp_split_to_table(ingredients_text, E'\r?\n') with ordinality as line(text, position)
  where trim(line.text) <> '';

  insert into public.recipe_steps (recipe_id, phase, position, text)
  select created_recipe_id, 'evening', line.position::int - 1, trim(line.text)
  from regexp_split_to_table(steps_text, E'\r?\n') with ordinality as line(text, position)
  where trim(line.text) <> '';

  return created_recipe_id;
end;
$$;

revoke all on function public.create_community_recipe(
  uuid, text, text, int, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) from public;
grant execute on function public.create_community_recipe(
  uuid, text, text, int, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) to service_role;

comment on function public.create_community_recipe(
  uuid, text, text, int, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) is '管理者が確認した外部レシピを全家庭向けの共有候補として登録する';
