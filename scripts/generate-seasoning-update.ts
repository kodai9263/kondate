import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { officialRecipeDetails, type OfficialRecipeDetail } from "../src/lib/nutrition/recipeDetails";
import { auditedCommunityRecipe } from "../src/lib/recipes/communityRecipeDetails";
import household from "./data/household-seasoning-update.json";

// 監査開始時点の定義。後日再生成しても更新前の照合条件を変えない。
const baselineRef = "8524b56";
function baseline(path: string) {
  const source = execFileSync("git", ["show", `${baselineRef}:${path}`], { encoding: "utf8" });
  const context = { module: { exports: {} } };
  runInNewContext(transformSync(source, { loader: "ts", format: "cjs" }).code, context);
  return context.module.exports as Record<string, unknown>;
}
const before = baseline("src/lib/nutrition/recipeDetails.ts").officialRecipeDetails as Record<string, OfficialRecipeDetail>;
const sharedBefore = baseline("src/lib/recipes/communityRecipeDetails.ts").auditedCommunityRecipe as typeof auditedCommunityRecipe;
const hash = (lines: string[]) => createHash("md5").update(lines.join("\n")).digest("hex");
const seeds = Object.entries(officialRecipeDetails)
  .filter(([key, detail]) => JSON.stringify(detail) !== JSON.stringify(before[key]))
  .map(([key, detail]) => ({ key, before: before[key], after: detail }));
seeds.push({ key: `community:${auditedCommunityRecipe.id}`, before: sharedBefore.detail, after: auditedCommunityRecipe.detail });
const updates = [
  ...seeds.map((seed) => ({ key: seed.key, ingredientsHash: hash(seed.before.ingredients), stepsHash: hash(seed.before.steps), ingredients: seed.after.ingredients.join("\n"), steps: seed.after.steps.join("\n") })),
  { key: `household:${household.id}`, ingredientsHash: hash(household.before.ingredients), stepsHash: hash(household.before.steps), ingredients: household.after.ingredients.join("\n"), steps: household.after.steps.join("\n") },
];
const q = (value: string) => `'${value.replaceAll("'", "''")}'`;
const values = updates.map((u) => `(${[u.key, u.ingredientsHash, u.stepsHash, u.ingredients, u.steps].map(q).join(", ")})`);
const sql = `-- scripts/generate-seasoning-update.ts で生成。スキーマ変更を伴わない、監査済み料理だけのデータ更新。
-- 本番適用前に承認を得ること。更新前と一致しない編集があれば全体を中止する。
begin;
create temporary table seasoning_seed (
  catalog_key text primary key, old_ingredients_hash text, old_steps_hash text,
  ingredients_text text, steps_text text
) on commit drop;
insert into seasoning_seed values
${values.join(",\n")};

-- 照合と書き込みの間に料理・工程が編集されないようにする。
lock table public.recipes, public.recipe_steps in share row exclusive mode;
create temporary table seasoning_targets on commit drop as
select r.id, seed.*,
  coalesce((select string_agg(s.text, E'\\n' order by s.position) from public.recipe_steps s where s.recipe_id=r.id and s.phase='seasoning'), '') as actual_ingredients,
  coalesce((select string_agg(s.text, E'\\n' order by s.position) from public.recipe_steps s where s.recipe_id=r.id and s.phase='evening'), '') as actual_steps
from seasoning_seed seed join public.recipes r on (
  (r.household_id is null and r.meta->>'nutrition_catalog_id'=seed.catalog_key)
  or (seed.catalog_key=${q(`community:${auditedCommunityRecipe.id}`)} and r.id=${q(auditedCommunityRecipe.id)}::uuid
      and r.household_id is null and r.meta->>'visibility'='community' and r.meta->>'source_url'=${q(auditedCommunityRecipe.sourceUrl)})
  or (seed.catalog_key=${q(`household:${household.id}`)} and r.id=${q(household.id)}::uuid
      and r.household_id is not null and r.meta->>'step_customization'='true' and r.meta->>'source_recipe_id'=${q(household.sourceRecipeId)})
) where r.archived_at is null;

do $$ begin
  if exists(select 1 from seasoning_seed s left join seasoning_targets t using(catalog_key) group by s.catalog_key having count(t.id)<>1) then
    raise exception '更新対象が未登録・重複・別の状態です。再調査してください';
  end if;
  if exists(select 1 from seasoning_targets t where
    not ((md5(actual_ingredients)=old_ingredients_hash and md5(actual_steps)=old_steps_hash)
      or (actual_ingredients=ingredients_text and actual_steps=steps_text))
    or exists(select 1 from public.recipe_steps s where s.recipe_id=t.id and s.phase='morning')
  ) then raise exception '監査後に材料または工程が変わっています。上書きせず中止しました'; end if;
end $$;

-- 再適用時は何も変更せず、チェックも保持する。
delete from seasoning_targets t using public.recipes r where r.id=t.id
  and t.actual_ingredients=t.ingredients_text and t.actual_steps=t.steps_text
  and r.meta->>'ingredients_text'=t.ingredients_text and r.meta->>'steps_text'=t.steps_text
  and r.meta->>'seasoning_group_version'='1';

-- 意味が変わった工程の、当日以降のチェックだけを戻す。
update public.task_states ts set checked=false, checked_at=now()
from public.plan_entries pe, seasoning_targets t
where ts.plan_entry_id=pe.id and pe.recipe_id=t.id
  and pe.date >= (timezone('Asia/Tokyo',now()))::date and ts.checked;

update public.recipes r set meta=r.meta || jsonb_build_object(
  'ingredients_text', t.ingredients_text, 'steps_text', t.steps_text, 'seasoning_group_version', 1
) from seasoning_targets t where r.id=t.id;

insert into public.recipe_steps(recipe_id,phase,position,text)
select t.id, p.name, line.position::int-1, line.text
from seasoning_targets t
cross join lateral (values('seasoning',t.ingredients_text),('evening',t.steps_text)) p(name,contents)
cross join lateral regexp_split_to_table(p.contents,E'\\n') with ordinality line(text,position)
on conflict(recipe_id,phase,position) do update set text=excluded.text;

delete from public.recipe_steps s using seasoning_targets t
where s.recipe_id=t.id and (
  (s.phase='seasoning' and s.position>=cardinality(string_to_array(t.ingredients_text,E'\\n')))
  or (s.phase='evening' and s.position>=cardinality(string_to_array(t.steps_text,E'\\n')))
);
select count(*) as updated_recipes from seasoning_targets;
commit;
`;
mkdirSync("scripts/sql", { recursive: true });
writeFileSync("scripts/sql/update-seasoning-groups.sql", sql);
console.log(`${updates.length}品の更新SQLを生成しました（DBへの適用はしていません）。`);
