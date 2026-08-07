alter table public.recipes
  add column if not exists image_url text,
  add column if not exists protein_source text not null default 'meat'
    check (protein_source in ('fish', 'meat', 'soy', 'egg', 'noodle'));

create table public.recipe_nutrition (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  energy_kcal numeric(7,1) not null check (energy_kcal >= 0),
  protein_g numeric(6,1) not null check (protein_g >= 0),
  fat_g numeric(6,1) not null check (fat_g >= 0),
  carbs_g numeric(6,1) not null check (carbs_g >= 0),
  fiber_g numeric(6,1) not null check (fiber_g >= 0),
  salt_g numeric(5,2) not null check (salt_g >= 0),
  vegetables_g numeric(7,1) not null check (vegetables_g >= 0),
  source text not null default 'user_estimate' check (source in ('official', 'user_estimate', 'calculated')),
  updated_at timestamptz not null default now()
);

alter table public.recipe_nutrition enable row level security;

create policy "recipe nutrition readable" on public.recipe_nutrition
  for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and (r.household_id is null or r.household_id = (select public.current_household_id()))
    )
  );

create policy "household recipe nutrition writable" on public.recipe_nutrition
  for all using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  ) with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  );

create index if not exists recipes_household_id_idx on public.recipes (household_id);
create index if not exists recipes_household_protein_idx on public.recipes (household_id, protein_source);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "household recipe images upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = (select public.current_household_id())::text
  );

create policy "household recipe images delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = (select public.current_household_id())::text
  );

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
    jsonb_build_object('side', recipe_side, 'ingredients_text', recipe_ingredients, 'steps_text', recipe_steps)
  ) returning id into created_recipe_id;

  insert into public.recipe_nutrition (
    recipe_id, energy_kcal, protein_g, fat_g, carbs_g,
    fiber_g, salt_g, vegetables_g, source
  ) values (
    created_recipe_id, nutrition_energy_kcal, nutrition_protein_g, nutrition_fat_g,
    nutrition_carbs_g, nutrition_fiber_g, nutrition_salt_g, nutrition_vegetables_g,
    'user_estimate'
  );

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
