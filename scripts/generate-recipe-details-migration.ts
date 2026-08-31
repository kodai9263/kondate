import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { officialRecipeDetails } from "../src/lib/nutrition/recipeDetails";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const values = Object.entries(officialRecipeDetails).map(([catalogKey, recipe]) =>
  `(${sqlString(catalogKey)}, ${sqlString(recipe.ingredients.join("\n"))}, ${sqlString(recipe.steps.join("\n"))})`,
);

const sql = `-- Generated from src/lib/nutrition/recipeDetails.ts. Do not edit by hand.
create temporary table official_recipe_detail_seed (
  catalog_key text primary key,
  ingredients_text text not null,
  steps_text text not null
) on commit drop;

insert into official_recipe_detail_seed (catalog_key, ingredients_text, steps_text) values
  ${values.join(",\n  ")};

update public.recipes r
set meta = r.meta || jsonb_build_object(
  'ingredients_text', seed.ingredients_text,
  'steps_text', seed.steps_text
)
from official_recipe_detail_seed seed
where r.household_id is null
  and r.meta ->> 'nutrition_catalog_id' = seed.catalog_key;

insert into public.recipe_steps (recipe_id, phase, position, text)
select r.id, 'seasoning', line.position::int - 1, trim(line.text)
from official_recipe_detail_seed seed
join public.recipes r
  on r.household_id is null
  and r.meta ->> 'nutrition_catalog_id' = seed.catalog_key
cross join lateral regexp_split_to_table(seed.ingredients_text, E'\\r?\\n')
  with ordinality as line(text, position)
where trim(line.text) <> ''
on conflict (recipe_id, phase, position) do update set text = excluded.text;

insert into public.recipe_steps (recipe_id, phase, position, text)
select r.id, 'evening', line.position::int - 1, trim(line.text)
from official_recipe_detail_seed seed
join public.recipes r
  on r.household_id is null
  and r.meta ->> 'nutrition_catalog_id' = seed.catalog_key
cross join lateral regexp_split_to_table(seed.steps_text, E'\\r?\\n')
  with ordinality as line(text, position)
where trim(line.text) <> ''
on conflict (recipe_id, phase, position) do update set text = excluded.text;

delete from public.recipe_steps step
using public.recipes recipe, official_recipe_detail_seed seed
where step.recipe_id = recipe.id
  and recipe.household_id is null
  and recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
  and (
    (step.phase = 'seasoning' and step.position >= cardinality(regexp_split_to_array(seed.ingredients_text, E'\\r?\\n')))
    or (step.phase = 'evening' and step.position >= cardinality(regexp_split_to_array(seed.steps_text, E'\\r?\\n')))
  );

comment on table public.recipe_steps is
  '朝の仕込み、材料・調味料、夜の調理工程。plan_entries と task_states を通して家族でチェック状態を共有する';
`;

writeFileSync(resolve("supabase/migrations/202608310021_official_recipe_details.sql"), sql);
