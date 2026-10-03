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
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000051','trial@example.test'),('10000000-0000-4000-8000-000000000052','other@example.test');
select household_id as home from profiles where id = '10000000-0000-4000-8000-000000000051' \gset
select household_id as other_home from profiles where id = '10000000-0000-4000-8000-000000000052' \gset
select id as recipe from recipes where household_id is null and category <> 'breakfast' and cook_minutes <= 40 limit 1 \gset
select pg_temp.check_true((select t.started_at = h.created_at and t.expires_at = h.created_at + interval '336 hours' from household_free_trials t join households h on h.id = t.household_id where h.id = :'home'),'家庭作成時点から14日間を一度だけ付与');
insert into plan_entries(household_id,date,meal_type,recipe_id,servings) values(:'home','2026-09-01','dinner',:'recipe',4);
set role anon;
select pg_temp.check_true((select count(*) > 0 from recipes),'メニュー閲覧は登録不要');
select pg_temp.check_true((select count(*) = 0 from recipes where household_id is not null),'家庭の料理は非公開');
select pg_temp.expect_error('select * from household_free_trials','permission denied');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000051',false);
select pg_temp.expect_error(format('insert into plan_entries(household_id,date,meal_type,recipe_id,servings) values(%L,''2026-12-29'',''dinner'',%L,4)',:'home',:'recipe'),'paid_plan_required');
select configure_first_week('2026-12-29',2,0,'{}');
select jsonb_agg(jsonb_build_object('date',to_char(d,'YYYY-MM-DD'),'recipeId',:'recipe','locked',false,'sideMode','none')) as entries from generate_series('2026-12-29'::date,'2027-01-04'::date,'1 day') d \gset
select save_first_week(:'entries'::jsonb,4);
select pg_temp.check_true((select count(*) = 7 from plan_entries where date between '2026-12-29' and '2027-01-04'),'年またぎの7日分と副菜指定を保存');
select pg_temp.check_true((select bool_and(side_mode = 'none') from plan_entries where date between '2026-12-29' and '2027-01-04'),'副菜なしを保持');
select pg_temp.expect_error(format('select save_first_week(%L,4)',replace(:'entries','2027-01-04','2027-01-05')),'invalid_first_week');
select configure_first_week('2027-01-05',2,1,'{}');
insert into plan_entries(household_id,date,meal_type,recipe_id,servings) values(:'home','2027-01-05','dinner',:'recipe',4);
update plan_entries set servings = 5 where date = '2026-09-01';
select pg_temp.check_true((select count(*) = 1 from plan_entries where date = '2027-01-05'),'体験期間中は翌週も保存可能');
select update_first_week_shopping('2026-12-29','add','{"name":"牛乳"}');
select add_manual_shopping_item('2027-01-05','翌週のパン');
update household_settings set shopping_period_mode = 'custom', shopping_range_start = '2026-12-29', shopping_range_end = '2027-01-05';
select pg_temp.check_true((select shopping_range_end = '2027-01-05' from household_settings),'体験中は買い物期間切替可能');
insert into shopping_completions(household_id,list_id,range_start,range_end,period_mode,items,contributions,completed_by)
  select household_id,id,'2027-01-05','2027-01-05','today','[]','[]',auth.uid() from shopping_lists where week_start = '2027-01-05';
select pg_temp.expect_error('update household_free_trials set started_at = now(), expires_at = now() + interval ''336 hours''','permission denied');
select pg_temp.expect_error('delete from household_free_trials','permission denied');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000052',false);
select pg_temp.check_true((select count(*) = 1 from household_free_trials),'他家庭の体験記録は閲覧不可');
select pg_temp.check_true(not kondate_private.has_planning_access(:'home'),'他家庭の権限を利用できない');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000051',false);
select set_config('request.jwt.claim.is_anonymous','true',false);
select pg_temp.check_true(not kondate_private.has_planning_access(:'home'),'未登録ゲストに無料体験権限を付与しない');
select set_config('request.jwt.claim.is_anonymous','false',false);
reset role;
-- 一時DBのみで時計を進める。終了日時と同時刻は無料対象外。
update household_free_trials set started_at = now() - interval '336 hours', expires_at = now() where household_id = :'home';
set role authenticated;
select pg_temp.check_true(not kondate_private.has_planning_access(:'home'),'終了日時を過ぎたら即時終了');
select pg_temp.expect_error('update plan_entries set servings = 6 where date = ''2027-01-05''','paid_plan_required');
select pg_temp.expect_error(format('select save_first_week(%L,4)',:'entries'),'paid_plan_required');
select pg_temp.expect_error('select update_first_week_shopping(''2026-12-29'',''restore'')','paid_plan_required');
select pg_temp.expect_error('select add_manual_shopping_item(''2027-01-05'',''期限切れ追加'')','paid_plan_required');
select pg_temp.expect_error('update shopping_items set checked = true','paid_plan_required');
select pg_temp.expect_error('delete from shopping_completions','paid_plan_required');
select pg_temp.expect_error(format('insert into shopping_completions(household_id,list_id,range_start,range_end,period_mode,items,contributions,completed_by) select household_id,id,''2027-01-05'',''2027-01-05'',''today'',''[]'',''[]'',auth.uid() from shopping_lists where week_start = ''2027-01-05'''),'paid_plan_required');
select pg_temp.expect_error('update household_settings set shopping_period_mode = ''today''','paid_plan_required');
select pg_temp.check_true((select count(*) = 9 from plan_entries),'終了後も献立データを保持');
select pg_temp.check_true((select count(*) = 2 from shopping_items),'終了後も買い物データを保持');
insert into recipe_favorites(household_id,recipe_key) values(:'home','official:salmon');
select pg_temp.check_true((select count(*) = 1 from recipe_favorites),'終了後もお気に入りは無料');
reset role;
update household_subscriptions set status = 'trialing', current_period_end = now() + interval '20 days' where household_id = :'home';
set role authenticated;
select pg_temp.check_true(kondate_private.has_planning_access(:'home'),'既存モニターの有効期間を短縮しない');
update plan_entries set servings = 6 where date = '2027-01-05';
reset role;
update household_subscriptions set status = 'active', current_period_end = null where household_id = :'home';
set role authenticated;
select pg_temp.check_true(kondate_private.has_planning_access(:'home'),'有料契約は体験期限に影響されない');
reset role;
update household_subscriptions set status = 'canceled' where household_id = :'home';
set role authenticated;
select pg_temp.check_true(not kondate_private.has_planning_access(:'home'),'解約で無料体験を再付与しない');
select pg_temp.check_true((select expires_at = now() from household_free_trials),'設定変更や解約で体験を延長しない');
reset role;
