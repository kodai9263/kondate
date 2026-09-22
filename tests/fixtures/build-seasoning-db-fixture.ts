import household from "../../scripts/data/household-seasoning-update.json";
const q = (value: string) => `'${value.replaceAll("'", "''")}'`;
console.log(`
insert into recipes(id,household_id,name,servings_base,meta)
select ${q(household.id)}::uuid, household_id, ${q(household.name)}, 4,
  ${q(JSON.stringify({ step_customization: true, source_recipe_id: household.sourceRecipeId, ingredients_text: household.before.ingredients.join("\n"), steps_text: "元の本文が残っている状態" }))}::jsonb
from profiles where id='11111111-1111-4111-8111-111111111111';
insert into recipe_steps(recipe_id,phase,position,text) values
${([['seasoning', household.before.ingredients], ['evening', household.before.steps]] as const).flatMap(([phase, rows]) => rows.map((text, index) => `(${q(household.id)}::uuid,${q(phase)},${index},${q(text)})`)).join(",\n")};

insert into plan_entries(household_id,date,meal_type,recipe_id)
select p.household_id, (timezone('Asia/Tokyo',now()))::date+delta, 'lunch', r.id
from profiles p, recipes r, generate_series(-1,1) delta
where p.id='11111111-1111-4111-8111-111111111111' and r.household_id is null and r.meta->>'nutrition_catalog_id'='chicken-teriyaki';
insert into task_states(plan_entry_id,step_id,checked,checked_by)
select pe.id,s.id,true,'11111111-1111-4111-8111-111111111111' from plan_entries pe
join recipe_steps s on s.recipe_id=pe.recipe_id
where pe.meal_type='lunch' and s.phase='evening' and s.position=0;

create table fixture_recipe_snapshots as select r.id,to_jsonb(r) as recipe,
  (select jsonb_agg(to_jsonb(s) order by s.phase,s.position) from recipe_steps s where s.recipe_id=r.id) as steps
from recipes r;
`);
