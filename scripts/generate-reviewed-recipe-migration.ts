import { writeFileSync } from "node:fs";
import { quickWeeknightRecipes } from "../src/lib/nutrition/quickWeeknightRecipes";
import drafts from "../src/lib/nutrition/reviewedRecipes.json";
import inventory from "./data/standard-recipe-review-2026-11-14.json";
import breakfasts from "../src/lib/breakfast/templates.json";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const retained = new Set(quickWeeknightRecipes.map((recipe) => recipe.id));
const held = inventory.filter((row) => !row.catalog_key || !retained.has(row.catalog_key));
const output = process.argv[2];
if (!output || held.length !== 126) throw new Error("反映先または確認対象件数が不正です");
const lines = [
  "-- 標準レシピの出所確認。家庭内の料理・副菜・朝食設定・保存済み献立は更新しない。",
  "-- 元レシピと工程は削除せず保留し、独立したIDで差し替えを追加する。",
  "create temporary table reviewed_recipe_seed (item jsonb not null) on commit drop;",
  `insert into reviewed_recipe_seed values (${quote(JSON.stringify(drafts))}::jsonb);`,
  `insert into public.recipe_content_holds (recipe_id, household_id, recipe_name, review_key)
select r.id, null, r.name, 'standard-provenance-review-2026-11-14'
from public.recipes r
where r.household_id is null and r.id in (${held.map((r) => `${quote(r.id)}::uuid`).join(",")})
on conflict (recipe_id) do nothing;`,
  `insert into public.recipes (id, household_id, name, category, servings_base, prep_minutes, cook_minutes, protein_source, meta)
select (d->>'id')::uuid, null, d->>'name', 'main', (d->>'servings')::int, 0,
(d->>'totalMinutes')::int, d->>'proteinSource', jsonb_build_object(
'nutrition_catalog_id', 'reviewed-' || lower(d->>'key'), 'side', '',
'ingredients_text', (select string_agg(value, E'\\n') from jsonb_array_elements_text(d->'ingredients')),
'steps_text', (select string_agg(value, E'\\n') from jsonb_array_elements_text(d->'steps')),
'recipe_notes', d->'notes', 'total_minutes', (d->>'totalMinutes')::int,
'servings_base', (d->>'servings')::int, 'provenance', d->'provenance')
from reviewed_recipe_seed s cross join lateral jsonb_array_elements(s.item) d
on conflict (id) do nothing;`,
  `insert into public.recipe_steps (recipe_id, phase, position, text)
select r.id, phase.name, entry.position::int - 1, entry.value
from reviewed_recipe_seed s cross join lateral jsonb_array_elements(s.item) d
join public.recipes r on r.id = (d->>'id')::uuid and r.household_id is null
  and r.meta->>'nutrition_catalog_id' = 'reviewed-' || lower(d->>'key')
cross join lateral (values ('seasoning', d->'ingredients'), ('evening', d->'steps')) phase(name, contents)
cross join lateral jsonb_array_elements_text(phase.contents) with ordinality entry(value, position)
on conflict (recipe_id, phase, position) do nothing;`,
  ...breakfasts.map((item) => `update public.breakfast_templates set item = ${quote(JSON.stringify(item))}::jsonb where key = ${quote(item.sourceKey)};`),
];
writeFileSync(output, lines.join("\n\n") + "\n");
