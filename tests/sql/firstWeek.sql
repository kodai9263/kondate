create function pg_temp.check_true(value boolean, label text) returns void language plpgsql as $$
begin if value is not true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then
    if position(expected in sqlerrm) = 0 then raise; end if;
    raise notice 'PASS: rejected %',expected; return;
  end;
  raise exception 'FAIL: expected %',expected;
end; $$;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000051','first@example.test'),('10000000-0000-4000-8000-000000000052','other@example.test');
select household_id as home from profiles where id = '10000000-0000-4000-8000-000000000051' \gset
select household_id as other_home from profiles where id = '10000000-0000-4000-8000-000000000052' \gset
select id as recipe from recipes where household_id is null and category <> 'breakfast' and cook_minutes <= 40 limit 1 \gset
-- 以前に保存していた献立は保持する。
insert into plan_entries(household_id,date,meal_type,recipe_id,servings) values(:'home','2026-09-01','dinner',:'recipe',4);
insert into recipes(household_id,name,category,servings_base,cook_minutes) values(:'home','秘密の料理','main',4,20) returning id as secret_recipe \gset
set role anon;
select pg_temp.check_true((select count(*) > 0 from recipes),'未登録で公開メニューを閲覧');
select pg_temp.check_true((select count(*) = 0 from recipes where household_id is not null),'未登録に家庭の料理を公開しない');
select pg_temp.check_true((select count(*) > 0 from recipe_steps),'未登録で公開作り方を閲覧');
select pg_temp.expect_error('select configure_first_week(''2026-12-29'',2,0,''{}'')','permission denied');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000051',false);
select pg_temp.check_true((select count(*) = 1 from plan_entries where date = '2026-09-01'),'以前の献立を閲覧できる');
select pg_temp.expect_error(format('insert into plan_entries(household_id,date,meal_type,recipe_id,servings) values(%L,''2026-12-29'',''dinner'',%L,4)',:'home',:'recipe'),'paid_plan_required');
select configure_first_week('2026-12-29',2,0,'{}');
select pg_temp.check_true((select start_date is null from household_first_weeks),'設定だけでは体験を確定しない');
select configure_first_week('2026-12-30',2,1,'{卵}');
select configure_first_week('2026-12-29',2,0,'{}');
select jsonb_agg(jsonb_build_object('date',to_char(d,'YYYY-MM-DD'),'recipeId',:'recipe','locked',false)) as entries from generate_series('2026-12-29'::date,'2027-01-04'::date,'1 day') d \gset
select save_first_week(:'entries'::jsonb,4);
select pg_temp.check_true((select count(*) = 7 from plan_entries where date between '2026-12-29' and '2027-01-04'),'年をまたぐ7日分を保存');
select save_first_week(:'entries'::jsonb,3);
select save_first_week((select jsonb_agg(e || jsonb_build_object('sideMode','none')) from jsonb_array_elements(:'entries'::jsonb) e),3);
select pg_temp.check_true((select bool_and(side_mode = 'none') from plan_entries where date between '2026-12-29'and '2027-01-04'),'無料の副菜なし指定を保存');
select save_first_week(:'entries'::jsonb,3);
select pg_temp.check_true((select start_date = date '2026-12-29' from household_first_weeks),'無料期間を固定');
select pg_temp.expect_error('select configure_first_week(''2027-01-05'',2,0,''{}'')','first_week_already_started');
select pg_temp.expect_error('update household_first_weeks set start_date = ''2027-01-05''','permission denied');
select pg_temp.expect_error('delete from household_first_weeks','permission denied');
select pg_temp.expect_error(format('insert into plan_entries(household_id,date,meal_type,recipe_id,servings) values(%L,''2027-01-05'',''dinner'',%L,4)',:'home',:'recipe'),'paid_plan_required');
select pg_temp.expect_error('update plan_entries set servings = 5 where date = ''2026-09-01''','paid_plan_required');
select pg_temp.expect_error(format('select save_first_week(%L,4)',replace(:'entries','2027-01-04','2027-01-05')),'invalid_first_week');
select pg_temp.expect_error(format('select save_first_week(%L,4)',replace(:'entries','2027-01-04','2026-12-29')),'invalid_first_week');
select update_first_week_shopping('2026-12-29','add','{"name":"牛乳"}');
select update_first_week_shopping('2026-12-29','check','{"category":"肉","name":"planned-v1:test","position":0,"source":"auto","checked":true}');
select pg_temp.check_true((select checked from shopping_items where name = 'planned-v1:test'),'無料リストのチェックを保存');
select update_first_week_shopping('2026-12-29','dismiss','{"category":"調味料(在庫確認)","name":"planned-v1:soy","position":0}');
select update_first_week_shopping('2026-12-29','restore');
select pg_temp.check_true((select not dismissed from shopping_items where name = 'planned-v1:soy'),'無料リストの調味料を再表示');
select pg_temp.expect_error('select update_first_week_shopping(''2027-01-05'',''add'',''{"name":"牛乳"}'')','first_week_not_started');
select pg_temp.expect_error(format('select add_manual_shopping_item(''2027-01-05'',''無料対象外'')'),'paid_plan_required');
select pg_temp.expect_error('update shopping_lists set week_start = ''2027-01-05''','paid_plan_required');
select pg_temp.expect_error('update household_settings set shopping_period_mode = ''custom'', shopping_range_start = ''2026-12-29'', shopping_range_end = ''2027-01-05''','paid_plan_required');
insert into recipe_favorites(household_id,recipe_key) values(:'home','official:salmon');
select pg_temp.check_true((select count(*) = 1 from recipe_favorites),'無料のお気に入り保存');
select pg_temp.expect_error(format('insert into recipe_favorites(household_id,recipe_key) values(%L,''official:salmon'')',:'other_home'),'row-level security');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000052',false);
select pg_temp.check_true((select count(*) = 0 from household_first_weeks),'他家庭の無料期間を閲覧できない');
select pg_temp.expect_error(format('select save_first_week(%L,4)',:'entries'),'setup_required');
reset role;
-- モニターの有効期間も通常の有料契約と同様に維持する。
update household_subscriptions set status = 'trialing',current_period_end = now() + interval '14 days' where household_id = :'home';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000051',false);
insert into plan_entries(household_id,date,meal_type,recipe_id,servings) values(:'home','2027-01-05','dinner',:'recipe',4);
select add_manual_shopping_item('2027-01-05','モニター対象');
select pg_temp.check_true((select count(*) = 1 from plan_entries where date = '2027-01-05'),'有効なモニターは期間外も利用可能');
reset role;
update household_subscriptions set status = 'canceled' where household_id = :'home';
set role authenticated;
select update_first_week_shopping('2026-12-29','add','{"name":"解約後も無料対象"}');
select pg_temp.expect_error('update plan_entries set servings = 5 where date = ''2027-01-05''','paid_plan_required');
select pg_temp.check_true((select count(*) = 1 from plan_entries where date = '2027-01-05'),'解約後も過去データを保持');
reset role;
