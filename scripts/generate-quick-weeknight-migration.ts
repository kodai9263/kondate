import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { quickWeeknightRecipes } from "../src/lib/nutrition/quickWeeknightRecipes";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const values = quickWeeknightRecipes.map((recipe) => {
  const nutrition = recipe.nutrition;
  return `(${[
    quote(recipe.id), quote(recipe.name), quote(recipe.side), recipe.cookMinutes,
    recipe.totalMinutes, quote(recipe.proteinSource), nutrition.energyKcal,
    nutrition.proteinG, nutrition.fatG, nutrition.carbsG, nutrition.fiberG,
    nutrition.saltG, nutrition.vegetablesG, quote(recipe.ingredients.join("\n")),
    quote(recipe.steps.join("\n")), `${quote(JSON.stringify(recipe.notes))}::jsonb`,
  ].join(", ")})`;
});

const sql = `-- 平日の定番メニュー15品。4人分の材料・工程とアプリ内カタログを同時に追加する。
-- 既存の家庭レシピ、公式レシピ、保存済み献立は更新しない。
create temporary table quick_weeknight_seed (
  catalog_key text primary key, recipe_name text not null, side_name text not null,
  cook_minutes int not null, total_minutes int not null, protein_source text not null,
  energy_kcal numeric not null, protein_g numeric not null, fat_g numeric not null,
  carbs_g numeric not null, fiber_g numeric not null, salt_g numeric not null,
  vegetables_g numeric not null, ingredients_text text not null,
  steps_text text not null, recipe_notes jsonb not null
) on commit drop;

insert into quick_weeknight_seed values
  ${values.join(",\n  ")};

insert into public.recipes (
  household_id, name, category, servings_base, prep_minutes, cook_minutes,
  image_url, protein_source, tags, meta
)
select null, seed.recipe_name, 'main', 4, 0, seed.cook_minutes,
  case seed.protein_source
    when 'meat' then '/images/chicken-teriyaki.png'
    when 'soy' then '/images/tofu-hamburg.png'
    when 'noodle' then '/images/udon.png'
    else '/images/family-dinner.png'
  end,
  seed.protein_source, array['時短', '平日'],
  jsonb_build_object(
    'nutrition_catalog_id', seed.catalog_key,
    'side', seed.side_name,
    'ingredients_text', seed.ingredients_text,
    'steps_text', seed.steps_text,
    'total_minutes', seed.total_minutes,
    'recipe_notes', seed.recipe_notes,
    'servings_base', 4,
    'recipe_detail_version', 2
  )
from quick_weeknight_seed seed
where not exists (
  select 1 from public.recipes recipe
  where recipe.household_id is null
    and recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
);

insert into public.recipe_nutrition (
  recipe_id, energy_kcal, protein_g, fat_g, carbs_g, fiber_g,
  salt_g, vegetables_g, source
)
select recipe.id, seed.energy_kcal, seed.protein_g, seed.fat_g,
  seed.carbs_g, seed.fiber_g, seed.salt_g, seed.vegetables_g, 'user_estimate'
from quick_weeknight_seed seed
join public.recipes recipe on recipe.household_id is null
  and recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
on conflict (recipe_id) do nothing;

insert into public.recipe_steps (recipe_id, phase, position, text)
select recipe.id, phase.name, line.position::int - 1, trim(line.text)
from quick_weeknight_seed seed
join public.recipes recipe on recipe.household_id is null
  and recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
cross join lateral (
  values ('seasoning', seed.ingredients_text), ('evening', seed.steps_text)
) phase(name, contents)
cross join lateral regexp_split_to_table(phase.contents, E'\\r?\\n')
  with ordinality as line(text, position)
where trim(line.text) <> ''
on conflict (recipe_id, phase, position) do nothing;
`;

writeFileSync(resolve(process.argv[2] ?? "supabase/migrations/20260927013000_add_quick_weeknight_menus.sql"), sql);
