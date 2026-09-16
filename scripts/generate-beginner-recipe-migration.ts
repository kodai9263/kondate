import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { officialNutritionRecipes } from "../src/lib/nutrition/catalog";
import { officialRecipeDetails } from "../src/lib/nutrition/recipeDetails";
import { auditedCommunityRecipe } from "../src/lib/recipes/communityRecipeDetails";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const seeds = officialNutritionRecipes.map((recipe) => ({ key: recipe.id, side: recipe.side, ...officialRecipeDetails[recipe.id] }));
seeds.push({ key: `community:${auditedCommunityRecipe.id}`, side: "", ...auditedCommunityRecipe.detail });
const values = seeds.map((seed) => `(${quote(seed.key)}, ${quote(seed.side)}, ${quote(seed.ingredients.join("\n"))}, ${quote(seed.steps.join("\n"))}, ${seed.totalMinutes}, ${quote(JSON.stringify(seed.notes))}::jsonb)`);

const sql = `-- scripts/generate-beginner-recipe-migration.ts で生成。95品を4人分の初心者向け工程へ統一する。
-- 家庭のアレンジと他の共有レシピは対象外。アプリと同じリリースで適用する。
create temporary table beginner_recipe_seed (
  catalog_key text primary key, side text not null, ingredients_text text not null,
  steps_text text not null, total_minutes integer not null, recipe_notes jsonb not null
) on commit drop;
insert into beginner_recipe_seed values
  ${values.join(",\n  ")};

create temporary table beginner_recipe_targets on commit drop as
select r.id, seed.*
from public.recipes r join beginner_recipe_seed seed on (
  r.meta ->> 'nutrition_catalog_id' = seed.catalog_key
  or (seed.catalog_key = ${quote(`community:${auditedCommunityRecipe.id}`)}
      and r.id = ${quote(auditedCommunityRecipe.id)}::uuid
      and r.meta ->> 'visibility' = 'community'
      and r.meta ->> 'source_url' = ${quote(auditedCommunityRecipe.sourceUrl)})
)
where r.household_id is null and r.archived_at is null
  and (r.meta ->> 'recipe_detail_version' is distinct from '2'
    or r.meta ->> 'ingredients_text' is distinct from seed.ingredients_text
    or r.meta ->> 'steps_text' is distinct from seed.steps_text
    or r.meta ->> 'total_minutes' is distinct from seed.total_minutes::text
    or r.meta -> 'recipe_notes' is distinct from seed.recipe_notes);

-- 工程の意味が変わるため、当日以降の対象献立のチェックを戻す。
update public.task_states ts set checked = false, checked_at = now()
from public.plan_entries pe, beginner_recipe_targets target
where ts.plan_entry_id = pe.id and pe.recipe_id = target.id
  and pe.date >= (timezone('Asia/Tokyo', now()))::date
  and ts.checked;

update public.recipes r
set servings_base = 4, prep_minutes = 0,
  meta = r.meta || jsonb_build_object(
    'side', target.side, 'ingredients_text', target.ingredients_text, 'steps_text', target.steps_text,
    'total_minutes', target.total_minutes, 'recipe_notes', target.recipe_notes,
    'servings_base', 4, 'recipe_detail_version', 2
  )
from beginner_recipe_targets target where r.id = target.id;

insert into public.recipe_steps (recipe_id, phase, position, text)
select target.id, phase.name, line.position::int - 1, trim(line.text)
from beginner_recipe_targets target
cross join lateral (values ('seasoning', target.ingredients_text), ('evening', target.steps_text)) phase(name, contents)
cross join lateral regexp_split_to_table(phase.contents, E'\\r?\\n') with ordinality as line(text, position)
where trim(line.text) <> ''
on conflict (recipe_id, phase, position) do update set text = excluded.text;

-- 朝に作業済みという前提をなくし、夕方の工程だけで作れるようにする。
delete from public.recipe_steps step using beginner_recipe_targets target
where step.recipe_id = target.id and (
  step.phase = 'morning'
  or (step.phase = 'seasoning' and step.position >= cardinality(regexp_split_to_array(target.ingredients_text, E'\\r?\\n')))
  or (step.phase = 'evening' and step.position >= cardinality(regexp_split_to_array(target.steps_text, E'\\r?\\n')))
);
`;
writeFileSync(resolve(process.argv[2] ?? "supabase/migrations/202609160035_beginner_recipe_details.sql"), sql);
