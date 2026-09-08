create temporary table breakfast_choice_seed (
  breakfast_key text primary key,
  recipe_name text not null,
  cook_minutes integer not null,
  tasks text[] not null
) on commit drop;

insert into breakfast_choice_seed values
  ('A', 'ごはん・味噌汁・納豆・バナナ', 10, array['ご飯を温める','味噌汁を温める','納豆を出す','バナナを切る']),
  ('B', 'ごはん・味噌汁・目玉焼き・ミニトマト', 12, array['ご飯を温める','味噌汁を温める','目玉焼きを焼く','ミニトマトを洗う']),
  ('C', 'ごはん・味噌汁・鮭フレーク・ヨーグルト', 10, array['ご飯を温める','味噌汁を温める','鮭フレークを出す','ヨーグルトを出す']),
  ('D', 'トースト・チーズ・ヨーグルト・果物', 10, array['パンを焼く','チーズをのせる','ヨーグルトを出す','果物を切る']),
  ('E', 'おにぎり・味噌汁・卵焼き・果物', 12, array['おにぎりを作る','味噌汁を温める','卵焼きを作る','果物を切る']),
  ('F', 'しらすごはん・味噌汁・のり・ヨーグルト', 8, array['ご飯を温める','味噌汁を温める','しらすとのりを出す','ヨーグルトを出す']),
  ('G', 'ハムチーズトースト・ゆで卵・果物', 10, array['ハムとチーズをのせてパンを焼く','ゆで卵を出す','果物を切る']),
  ('H', 'ツナマヨトースト・スープ・ヨーグルト', 10, array['ツナとマヨネーズを混ぜる','パンにのせて焼く','スープを温める','ヨーグルトを出す']),
  ('I', 'コーンフレーク・牛乳・バナナ・チーズ', 5, array['コーンフレークと牛乳を用意する','バナナを切る','チーズを出す']),
  ('J', 'お茶漬け・卵焼き・浅漬け・ヨーグルト', 10, array['お茶漬けを作る','卵焼きを作る','浅漬けを出す','ヨーグルトを出す']);

insert into public.recipes (household_id, name, category, servings_base, prep_minutes, cook_minutes, tags, meta)
select null, seed.recipe_name, 'breakfast', 5, 0, seed.cook_minutes, '{}'::text[],
  jsonb_build_object('source', 'menu-data.json', 'breakfast_key', seed.breakfast_key)
from breakfast_choice_seed seed
on conflict do nothing;

update public.recipes recipe
set cook_minutes = seed.cook_minutes,
    meta = recipe.meta || jsonb_build_object('source', 'menu-data.json', 'breakfast_key', seed.breakfast_key)
from breakfast_choice_seed seed
where recipe.household_id is null and recipe.name = seed.recipe_name;

insert into public.recipe_steps (recipe_id, phase, position, text)
select recipe.id, 'morning', (task.ordinality - 1)::integer, task.text
from breakfast_choice_seed seed
join public.recipes recipe on recipe.household_id is null and recipe.name = seed.recipe_name
cross join lateral unnest(seed.tasks) with ordinality as task(text, ordinality)
where not exists (
  select 1 from public.recipe_steps current_step
  where current_step.recipe_id = recipe.id
    and current_step.phase = 'morning'
    and current_step.position = task.ordinality - 1
    and current_step.text = task.text
);

alter table public.household_settings
  add column if not exists breakfast_choices text[] not null
  default array['A','B','C','D']::text[];

alter table public.household_settings
  alter column breakfast_choices set default '{}'::text[];

alter table public.household_settings
  drop constraint if exists household_settings_breakfast_choices_check;

alter table public.household_settings
  add constraint household_settings_breakfast_choices_check check (
    cardinality(breakfast_choices) <= 10
    and breakfast_choices <@ array['A','B','C','D','E','F','G','H','I','J']::text[]
  );

create or replace function public.update_current_household_account(
  display_name_input text,
  household_name_input text,
  adult_count_input integer,
  child_count_input integer,
  shopping_day_input integer,
  allergies_input text[],
  breakfast_choices_input text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  target_household_id uuid;
  normalized_allergies text[] := coalesce(allergies_input, '{}'::text[]);
  normalized_breakfast_choices text[] := coalesce(breakfast_choices_input, '{}'::text[]);
begin
  if target_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  if char_length(trim(display_name_input)) not between 1 and 40
    or char_length(trim(household_name_input)) not between 1 and 60
    or adult_count_input not between 1 and 10
    or child_count_input not between 0 and 10
    or shopping_day_input not between 0 and 6
    or cardinality(normalized_allergies) > 30
    or cardinality(normalized_breakfast_choices) > 10
    or not normalized_breakfast_choices <@ array['A','B','C','D','E','F','G','H','I','J']::text[]
    or exists (
      select 1 from unnest(normalized_allergies) as allergy
      where allergy is null or char_length(trim(allergy)) not between 1 and 40
    )
  then
    raise exception using errcode = '22023', message = 'invalid account settings';
  end if;

  select profile.household_id into target_household_id
  from public.profiles as profile where profile.id = target_user_id;
  if target_household_id is null then
    raise exception using errcode = 'P0002', message = 'profile not found';
  end if;

  update public.profiles set display_name = trim(display_name_input) where id = target_user_id;
  update public.households set name = trim(household_name_input) where id = target_household_id;

  insert into public.household_settings (
    household_id, default_servings, adult_count, child_count, shopping_day, allergies, breakfast_choices
  ) values (
    target_household_id, ceil(adult_count_input + child_count_input * 0.6)::integer,
    adult_count_input, child_count_input, shopping_day_input, normalized_allergies, normalized_breakfast_choices
  )
  on conflict (household_id) do update set
    default_servings = excluded.default_servings,
    adult_count = excluded.adult_count,
    child_count = excluded.child_count,
    shopping_day = excluded.shopping_day,
    allergies = excluded.allergies,
    breakfast_choices = excluded.breakfast_choices;
end;
$$;

revoke all on function public.update_current_household_account(text, text, integer, integer, integer, text[], text[]) from public;
grant execute on function public.update_current_household_account(text, text, integer, integer, integer, text[], text[]) to authenticated;

create or replace function public.ensure_today_plan(target_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid := public.current_household_id();
  rotation_day integer;
  target_servings integer := 5;
  selected_breakfasts text[] := '{}'::text[];
  selected_breakfast_key text;
begin
  if target_household_id is null then raise exception 'household_not_found'; end if;
  if target_date <> (timezone('Asia/Tokyo', now()))::date then raise exception 'invalid_plan_date'; end if;

  rotation_day := mod(mod(target_date - date '2026-07-26', 28) + 28, 28);
  select coalesce(settings.default_servings, 5), coalesce(settings.breakfast_choices, '{}'::text[])
  into target_servings, selected_breakfasts
  from public.household_settings settings where settings.household_id = target_household_id;

  target_servings := coalesce(target_servings, 5);
  selected_breakfasts := coalesce(selected_breakfasts, '{}'::text[]);

  insert into public.plan_entries (household_id, date, meal_type, recipe_id, servings)
  select target_household_id, target_date, 'dinner', entry.recipe_id, target_servings
  from public.template_entries entry
  where entry.template_id = '00000000-0000-0000-0000-000000000001'
    and entry.day_index = rotation_day and entry.meal_type = 'dinner'
  on conflict (household_id, date, meal_type) do nothing;

  if cardinality(selected_breakfasts) = 0 then
    delete from public.plan_entries
    where household_id = target_household_id and date = target_date and meal_type = 'breakfast';
    return;
  end if;

  selected_breakfast_key := selected_breakfasts[mod(rotation_day, cardinality(selected_breakfasts)) + 1];
  insert into public.plan_entries (household_id, date, meal_type, recipe_id, servings)
  select target_household_id, target_date, 'breakfast', recipe.id, target_servings
  from public.recipes recipe
  where recipe.household_id is null and recipe.meta ->> 'breakfast_key' = selected_breakfast_key
  limit 1
  on conflict (household_id, date, meal_type) do update set
    recipe_id = excluded.recipe_id,
    servings = excluded.servings;
end;
$$;

revoke all on function public.ensure_today_plan(date) from public;
grant execute on function public.ensure_today_plan(date) to authenticated;

comment on column public.household_settings.breakfast_choices
  is '家庭の朝食ローテーションに含める候補キー。空配列は朝食を表示しない';
