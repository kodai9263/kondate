insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','recipe-audit@example.test');
insert into recipes(id,name,servings_base,meta) values
 ('8c510234-c753-4c4c-8fc1-343a167ed45e','なすの豚しゃぶ香味だれ',4,'{"visibility":"community","source_url":"https://oceans-nadia.com/user/484627/recipe/526632","ingredients_text":"旧材料"}'),
 ('22222222-2222-4222-8222-222222222222','対象外の共有品',4,'{"visibility":"community","source_url":"https://example.test/other"}');
insert into recipes(id,household_id,name,meta)
select '33333333-3333-4333-8333-333333333333', household_id, '家庭のアレンジ', '{"nutrition_catalog_id":"salmon","step_customization":true,"ingredients_text":"家庭の材料"}' from profiles where id='11111111-1111-4111-8111-111111111111';
insert into recipe_steps(recipe_id,phase,position,text)
select id,'morning',0,'前日の仕込み' from recipes where meta->>'nutrition_catalog_id'='salmon'
on conflict (recipe_id,phase,position) do update set text=excluded.text;
insert into recipe_steps(recipe_id,phase,position,text) values ('33333333-3333-4333-8333-333333333333','evening',0,'家庭の作り方');
insert into plan_entries(household_id,date,meal_type,recipe_id)
select p.household_id, (timezone('Asia/Tokyo',now()))::date+delta,'dinner',r.id
from profiles p, recipes r, generate_series(-1,1) delta
where p.id='11111111-1111-4111-8111-111111111111' and r.household_id is null and r.meta->>'nutrition_catalog_id'='salmon';
insert into task_states(plan_entry_id,step_id,checked,checked_by)
select pe.id,rs.id,true,'11111111-1111-4111-8111-111111111111' from plan_entries pe join recipe_steps rs on rs.recipe_id=pe.recipe_id where rs.phase='evening' and rs.position=0;
