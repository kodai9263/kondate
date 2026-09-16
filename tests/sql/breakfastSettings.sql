create function pg_temp.check_true(value boolean, label text) returns void language plpgsql as $$
begin
  if value is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm) = 0 then raise; end if;
    raise notice 'PASS: rejected %', expected;
    return;
  end;
  raise exception 'FAIL: expected rejection %', expected;
end;
$$;
insert into auth.users (id, email) values ('10000000-0000-4000-8000-000000000011', 'breakfast@example.test'), ('10000000-0000-4000-8000-000000000012', 'other-breakfast@example.test');
select household_id as home from profiles where id = '10000000-0000-4000-8000-000000000011' \gset
select household_id as other_home from profiles where id = '10000000-0000-4000-8000-000000000012' \gset
select (timezone('Asia/Tokyo', now()))::date as today \gset
select :'today'::date + 1 as tomorrow \gset
select pg_temp.check_true((select not enabled and items = '[]'::jsonb from household_breakfast_versions where household_id = :'home'), '新規家庭はオフ・0件');
-- 旧家庭の移行を再現する。
delete from household_breakfast_versions where household_id = :'home';
update household_settings set breakfast_choices = array['A','C','I'] where household_id = :'home';
select initialize_household_breakfast(:'home');
select initialize_household_breakfast(:'home');
select pg_temp.check_true((select count(*) = 1 from household_breakfast_versions where household_id = :'home'), '移行は二重登録しない');
select pg_temp.check_true((select items -> 0 ->> 'sourceKey' = 'A' and jsonb_array_length(items) = 3 from household_breakfast_versions where household_id = :'home'), '旧選択だけ引き継ぐ');
select pg_temp.check_true(breakfast_item_for_date(:'home', '2026-08-23') ->> 'sourceKey' = 'A', '移行時は28日周期を維持');
select revision as rev from household_breakfast_versions where household_id = :'home' \gset
select jsonb_build_object('enabled',true,'items',jsonb_build_array(jsonb_build_object('id','20000000-0000-4000-8000-000000000001','sourceKey',null,'name','レンジ朝食','shoppingItems',jsonb_build_array('卵','ヨーグルト'),'tasks',jsonb_build_array('用意する','用意する'),'minutes',null))) as config \gset
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000011', false);
select pg_temp.check_true((select count(*) = 1 from household_breakfast_versions), '他の家庭の設定は見えない');
select ensure_today_plan(:'today');
select plan_entry_id as today_entry from v_daily_plan where date = :'today' and meal_type = 'breakfast' \gset
select recipe_id as today_recipe from plan_entries where id = :'today_entry' \gset
select id as today_step from recipe_steps where recipe_id = :'today_recipe' order by position limit 1 \gset
select set_task_checked(:'today_entry', :'today_step', true);
select save_household_breakfast(:'rev', :'config') ->> 'revision' as new_rev \gset
select pg_temp.check_true((select count(*) = 2 from household_breakfast_versions), '翌日用の版を追加');
select pg_temp.expect_error(format('select save_household_breakfast(%L,%L)', :'rev', :'config'), 'breakfast_conflict');
select pg_temp.check_true((save_household_breakfast(:'new_rev', :'config') ->> 'changed')::boolean = false, '変更なし保存で順番を変えない');
select ensure_today_plan(:'today');
select pg_temp.check_true((select recipe_id = :'today_recipe' from plan_entries where id = :'today_entry'), '保存後も今日のレシピを維持');
select pg_temp.check_true((select checked from task_states where plan_entry_id = :'today_entry' and step_id = :'today_step'), '保存後も今日の完了チェックを維持');
select pg_temp.expect_error(format('select save_recipe_step_customization(%L,%L,%L)', :'today_recipe','上書き','上書き'), 'breakfast_snapshot_readonly');
select pg_temp.expect_error(format('update household_breakfast_versions set enabled = false where household_id = %L', :'home'), 'permission denied');
select pg_temp.expect_error(format('select save_household_breakfast(%L,%L)', :'new_rev', '{"enabled":true,"items":[]}'), 'invalid_breakfast_settings');
select set_shopping_item_checked(:'tomorrow', '朝ごはん', '卵', 0, true);
reset role;
select pg_temp.check_true(breakfast_item_for_date(:'home', :'tomorrow') ->> 'name' = 'レンジ朝食', '翌日から新しい朝食');
select pg_temp.check_true((select count(*) = 2 from breakfast_week_items(:'home', :'tomorrow')), '7日分の同じ買うものを重複させない');
select jsonb_set(:'config', '{items,0,shoppingItems}', '["ヨーグルト"]') as reduced \gset
set role authenticated;
select save_household_breakfast(:'new_rev', :'reduced') ->> 'revision' as reduced_rev \gset
select pg_temp.check_true((select not checked from shopping_items where category = '朝ごはん' and name = '卵'), '外れた品はその場でチェックを解除');
select pg_temp.expect_error(format('select set_shopping_item_checked(%L,%L,%L,0,true)', :'tomorrow', '朝ごはん','卵'), 'invalid_breakfast_shopping_item');
select save_household_breakfast(:'reduced_rev', :'config') ->> 'revision' as restored_rev \gset
select pg_temp.check_true((select not checked from shopping_items where category = '朝ごはん' and name = '卵'), '再追加しても未購入');
select save_household_breakfast(:'restored_rev', jsonb_set(:'config','{enabled}','false')) ->> 'revision' as off_rev \gset
reset role;
select pg_temp.check_true(breakfast_item_for_date(:'home', :'tomorrow') is null, 'オフは翌日から適用');
select pg_temp.check_true((select jsonb_array_length(items) = 1 from household_breakfast_versions where revision = :'off_rev'), 'オフでも朝食の内容を保持');
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000012', false);
select pg_temp.expect_error(format('select save_household_breakfast(%L,%L)', :'off_rev', :'config'), 'breakfast_conflict');
select pg_temp.check_true((select count(*) = 1 from household_breakfast_versions), '別家庭の版は読み取れない');
reset role;
set role anon;
select pg_temp.expect_error(format('select save_household_breakfast(%L,%L)', :'off_rev', :'config'), 'permission denied');
reset role;

-- 家族共有の有効・失効・解除でアクセス権が切り替わる。
update household_subscriptions set status = 'active', current_period_end = now() + interval '1 day' where household_id = :'home';
insert into household_invites (household_id, created_by, invite_token) values (:'home', '10000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000001') returning id as invitation \gset
set role authenticated;
select accept_household_invite('40000000-0000-4000-8000-000000000001');
select pg_temp.check_true((select count(*) = 2 from household_breakfast_versions), '有効な家族プランなら参加者も設定を読める');
select save_household_breakfast(:'off_rev', :'config') ->> 'revision' as shared_rev \gset
reset role;
update household_subscriptions set current_period_end = now() - interval '1 second' where household_id = :'home';
set role authenticated;
select pg_temp.check_true((select count(*) = 0 from household_breakfast_versions), 'プラン期限後は参加者に設定を公開しない');
select pg_temp.expect_error(format('select save_household_breakfast(%L,%L)', :'shared_rev', :'config'), 'breakfast_access_denied');
select pg_temp.check_true((select count(*) = 0 from recipes where id = :'today_recipe'), '期限後は朝食の確定済みレシピも読めない');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000011', false);
select revoke_household_invite(:'invitation');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000012', false);
select household_id as other_home from profiles where id = '10000000-0000-4000-8000-000000000012' \gset
select pg_temp.check_true((select count(*) = 0 from household_breakfast_versions where household_id = :'home'), '共有解除後は元の家族の設定を読めない');
select pg_temp.expect_error(format('select save_household_breakfast(%L,%L)', :'shared_rev', :'config'), 'breakfast_conflict');
reset role;
-- 別の家庭で「翌日になった状態」を再現し、保存内容から実際の当日工程を作る。
update household_breakfast_versions set enabled = true, items = :'config'::jsonb -> 'items', rotation_start = :'today', legacy_rotation = false where household_id = :'other_home';
set role authenticated;
select ensure_today_breakfast(:'today');
select plan_entry_id as custom_entry from v_daily_plan where date = :'today' and meal_type = 'breakfast' \gset
select recipe_id as custom_recipe from plan_entries where id = :'custom_entry' \gset
select id as custom_step from recipe_steps where recipe_id = :'custom_recipe' order by position limit 1 \gset
select set_task_checked(:'custom_entry', :'custom_step', true);
select ensure_today_breakfast(:'today');
select pg_temp.check_true((select count(*) = 2 and count(distinct id) = 2 from recipe_steps where recipe_id = :'custom_recipe'), '同じ文章の工程にも別のチェックIDを発行する');
select pg_temp.check_true((select count(*) = 1 from task_states where plan_entry_id = :'custom_entry' and checked), '同じ文章でもチェックは1工程だけ');
select pg_temp.check_true((select meta -> 'minutes' = 'null'::jsonb from recipes where id = :'custom_recipe'), '時間未入力を0分表示と区別する');
reset role;
select pg_temp.check_true((select count(*) = 0 from plan_entries where household_id = :'other_home' and meal_type = 'dinner'), '朝食の確定で夕食を勝手に作らない');
