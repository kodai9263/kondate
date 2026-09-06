create unique index if not exists recipes_active_step_customization_idx
  on public.recipes (household_id, ((meta ->> 'source_recipe_id')))
  where archived_at is null
    and meta ->> 'step_customization' = 'true';

create or replace function public.save_recipe_step_customization(
  target_recipe_id uuid,
  morning_steps_text text,
  evening_steps_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid := public.current_household_id();
  source_recipe public.recipes%rowtype;
  customized_recipe_id uuid;
begin
  if target_household_id is null then
    raise exception 'authentication required';
  end if;

  select * into source_recipe
  from public.recipes
  where id = target_recipe_id
    and archived_at is null;

  if not found or (source_recipe.household_id is not null and source_recipe.household_id <> target_household_id) then
    raise exception 'recipe not found';
  end if;

  if source_recipe.household_id is null then
    select id into customized_recipe_id
    from public.recipes
    where household_id = target_household_id
      and archived_at is null
      and meta ->> 'step_customization' = 'true'
      and meta ->> 'source_recipe_id' = target_recipe_id::text
    limit 1;

    if customized_recipe_id is null then
      insert into public.recipes (
        household_id, name, category, servings_base, prep_minutes, cook_minutes,
        freezable, bento_ok, storage_note, tags, seasons, meta, image_url, protein_source
      ) values (
        target_household_id, source_recipe.name, source_recipe.category, source_recipe.servings_base,
        source_recipe.prep_minutes, source_recipe.cook_minutes, source_recipe.freezable,
        source_recipe.bento_ok, source_recipe.storage_note, source_recipe.tags, source_recipe.seasons,
        source_recipe.meta || jsonb_build_object(
          'step_customization', true,
          'source_recipe_id', source_recipe.id::text
        ),
        source_recipe.image_url, source_recipe.protein_source
      ) returning id into customized_recipe_id;

      insert into public.recipe_nutrition (
        recipe_id, energy_kcal, protein_g, fat_g, carbs_g,
        fiber_g, salt_g, vegetables_g, source
      )
      select customized_recipe_id, energy_kcal, protein_g, fat_g, carbs_g,
             fiber_g, salt_g, vegetables_g, source
      from public.recipe_nutrition
      where recipe_id = target_recipe_id;

      insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category, position)
      select customized_recipe_id, name, quantity, unit, category, position
      from public.recipe_ingredients
      where recipe_id = target_recipe_id;

      insert into public.recipe_steps (recipe_id, phase, position, text, minutes)
      select customized_recipe_id, phase, position, text, minutes
      from public.recipe_steps
      where recipe_id = target_recipe_id
        and phase = 'seasoning';
    end if;

    update public.plan_entries
    set recipe_id = customized_recipe_id
    where household_id = target_household_id
      and recipe_id = target_recipe_id
      and date >= (timezone('Asia/Tokyo', now()))::date;
  else
    customized_recipe_id := target_recipe_id;
  end if;

  delete from public.recipe_steps
  where recipe_id = customized_recipe_id
    and phase in ('morning', 'evening');

  insert into public.recipe_steps (recipe_id, phase, position, text)
  select customized_recipe_id, 'morning', line.position::int - 1, trim(line.text)
  from regexp_split_to_table(coalesce(morning_steps_text, ''), E'\\r?\\n')
    with ordinality as line(text, position)
  where trim(line.text) <> '';

  insert into public.recipe_steps (recipe_id, phase, position, text)
  select customized_recipe_id, 'evening', line.position::int - 1, trim(line.text)
  from regexp_split_to_table(coalesce(evening_steps_text, ''), E'\\r?\\n')
    with ordinality as line(text, position)
  where trim(line.text) <> '';

  return customized_recipe_id;
end;
$$;

create or replace function public.reset_recipe_step_customization(target_recipe_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid := public.current_household_id();
  customized_recipe_id uuid;
begin
  if target_household_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.recipes
    where id = target_recipe_id
      and household_id is null
      and archived_at is null
  ) then
    raise exception 'official recipe not found';
  end if;

  select id into customized_recipe_id
  from public.recipes
  where household_id = target_household_id
    and archived_at is null
    and meta ->> 'step_customization' = 'true'
    and meta ->> 'source_recipe_id' = target_recipe_id::text
  limit 1;

  if customized_recipe_id is null then
    return false;
  end if;

  update public.plan_entries
  set recipe_id = target_recipe_id
  where household_id = target_household_id
    and recipe_id = customized_recipe_id
    and date >= (timezone('Asia/Tokyo', now()))::date;

  update public.recipes
  set archived_at = now()
  where id = customized_recipe_id
    and household_id = target_household_id;

  return true;
end;
$$;

revoke all on function public.save_recipe_step_customization(uuid, text, text) from public;
revoke all on function public.reset_recipe_step_customization(uuid) from public;
grant execute on function public.save_recipe_step_customization(uuid, text, text) to authenticated;
grant execute on function public.reset_recipe_step_customization(uuid) to authenticated;

comment on function public.save_recipe_step_customization(uuid, text, text)
  is '公式レシピを変更せず家庭用の工程アレンジ版を作成し、今日以降の献立へ反映する';
comment on function public.reset_recipe_step_customization(uuid)
  is '家庭用の工程アレンジを非表示にし、今日以降の献立を公式レシピへ戻す';
