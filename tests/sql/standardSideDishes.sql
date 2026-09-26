begin;
create function pg_temp.check_side(value boolean, label text) returns void language plpgsql as $$
begin
  if value is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
insert into auth.users (id,email) values
 ('10000000-0000-4000-8000-000000000024','side-a@example.test'),
 ('10000000-0000-4000-8000-000000000025','side-b@example.test');
select household_id as home from profiles where id='10000000-0000-4000-8000-000000000024' \gset
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000024',true);
insert into side_dishes(id,household_id,name,ingredients_text,steps_text) values
 ('20000000-0000-5000-8000-000000000024',:'home','冷ややっこ','絹ごし豆腐 300g','4等分に切る。') on conflict(id) do nothing;
insert into side_dishes(id,household_id,name,ingredients_text,steps_text) values
 ('20000000-0000-5000-8000-000000000024',:'home','冷ややっこ','変更されてはいけない','変更されてはいけない') on conflict(id) do nothing;
select pg_temp.check_side((select count(*)=1 from side_dishes where household_id=:'home'),'副菜の再選択で重複しない');
select pg_temp.check_side((select ingredients_text='絹ごし豆腐 300g' from side_dishes where id='20000000-0000-5000-8000-000000000024'),'保存済みの材料を上書きしない');
select id as recipe_id from recipes where category <> 'breakfast' limit 1 \gset
insert into plan_entries(household_id,date,meal_type,recipe_id,servings,status,locked,side_mode,side_dish_id) values
 (:'home','2026-09-01','dinner',:'recipe_id',4,'planned',false,'custom','20000000-0000-5000-8000-000000000024')
 on conflict(household_id,date,meal_type) do update set side_mode=excluded.side_mode,side_dish_id=excluded.side_dish_id;
select pg_temp.check_side((select side_dish->>'name'='冷ややっこ' from v_daily_plan where date='2026-09-01' and meal_type='dinner'),'今日の献立ビューから保存した副菜を読み直せる');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000025',true);
select pg_temp.check_side((select count(*)=0 from side_dishes where id='20000000-0000-5000-8000-000000000024'),'他家庭の副菜を参照できない');
select pg_temp.check_side((select count(*)=0 from v_daily_plan where side_dish->>'id'='20000000-0000-5000-8000-000000000024'),'他家庭の献立ビューからも参照できない');
do $$
begin
  begin
    update side_dishes set name='改ざん' where id='20000000-0000-5000-8000-000000000024';
    if found then raise exception 'FAIL: 他家庭の副菜を書き換えられた'; end if;
    raise notice 'PASS: 他家庭の副菜を書き換えられない';
  end;
end;
$$;
rollback;
