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
    raise notice 'PASS: rejected %', expected; return;
  end;
  raise exception 'FAIL: expected rejection %', expected;
end;
$$;
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000021', 'shopping@example.test'),
  ('10000000-0000-4000-8000-000000000022', 'other-shopping@example.test'),
  ('10000000-0000-4000-8000-000000000023', 'shopping-family@example.test') on conflict (id) do nothing;
select household_id as home from profiles where id = '10000000-0000-4000-8000-000000000021' \gset
select household_id as other_home from profiles where id = '10000000-0000-4000-8000-000000000022' \gset
select set_config('app.allow_household_transfer', 'on', false);
update profiles set household_id = :'home' where id = '10000000-0000-4000-8000-000000000023';
select (timezone('Asia/Tokyo', now()))::date as today \gset
-- 直近の買い物日を昨日に固定し、今日からへの切替を曜日に依存せず確認。
select :'today'::date - 1 as cycle \gset
select extract(dow from :'cycle'::date)::int as weekday \gset
select :'cycle'::date + ((7 - :weekday) % 7) as storage \gset
update household_settings set shopping_day = :weekday where household_id in (:'home', :'other_home');
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000021', false);
select id as old_manual from add_manual_shopping_item(:'storage', '洗剤') \gset
select id as old_list from shopping_lists where week_start = :'storage' \gset
select :'cycle'::date + 6 as cycle_end \gset
select :'today'::date + 13 as custom_end \gset
select pg_temp.check_true((update_planned_shopping(:'storage', :'cycle', :'cycle_end', 'week', 'check', '{"category":"肉","name":"planned-v1:amount100","position":0,"checked":true}') ->> 'ok')::boolean, '自動品を保存');
select pg_temp.check_true((select checked from shopping_items where name = 'planned-v1:amount100'), 'チェック状態が永続化');
select set_manual_shopping_item_checked(:'old_manual', true);
select complete_planned_shopping(
  :'storage', :'cycle', :'cycle_end', 'week',
  jsonb_build_array(jsonb_build_object(
    'source','auto','category','肉','name','planned-v1:amount100','label','豚肉 100g','position',0,
    'contributions',jsonb_build_array(jsonb_build_object(
      'key','meal-key-1','date',:'cycle','meal','夕食','original','豚肉 100g','scale',1
    ))
  )),
  array[:'old_manual'::uuid]
) ->> 'completion_id' as completion_id \gset
select pg_temp.check_true((select count(*) = 1 from shopping_completions where id = :'completion_id'), '買い物完了を家族に保存');
select pg_temp.check_true((select count(*) = 0 from shopping_items where id = :'old_manual' or name = 'planned-v1:amount100'), '購入済み品を現在のリストから除外');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000022', false);
select pg_temp.check_true((select count(*) = 0 from shopping_completions where id = :'completion_id'), '別家庭は買い物完了を読めない');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000021', false);
select pg_temp.check_true((undo_planned_shopping_completion(:'completion_id', :'storage', :'cycle', :'cycle_end', 'week') ->> 'ok')::boolean, '直前の買い物完了を取り消す');
select pg_temp.check_true((select count(*) = 0 from shopping_completions where id = :'completion_id'), '取り消した完了記録を削除');
select pg_temp.check_true((select checked from shopping_items where name = 'planned-v1:amount100'), '自動品のチェックを復元');
select pg_temp.check_true((select checked from shopping_items where name = '洗剤'), '手動品のチェックを復元');
select update_planned_shopping(:'storage', :'cycle', :'cycle_end', 'week', 'period', '{"mode":"today"}');
select pg_temp.check_true((select shopping_period_mode = 'today' from household_settings where household_id = :'home'), '今日だけを保存');
select pg_temp.check_true((select id = :'old_list' from shopping_lists where week_start = :'storage'), '期間変更時に既存リストを維持');
select pg_temp.check_true((select count(*) = 1 from shopping_items where id = :'old_manual' and name = '洗剤'), '既存の手動追加を維持');
select pg_temp.check_true((select checked from shopping_items where name = 'planned-v1:amount100'), '期間変更時に同じ材料の購入済みを維持');
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L)', :'storage', :'cycle', :'cycle_end', 'week', 'restore'), 'shopping_period_changed');
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L)', :'storage'::date - 7, :'today', :'today', 'today', 'restore'), 'shopping_period_changed');
select update_planned_shopping(:'storage', :'today', :'today', 'today', 'check', '{"category":"肉","name":"planned-v1:amount200","position":0,"checked":false}');
select pg_temp.check_true((select not checked from shopping_items where name = 'planned-v1:amount200'), '数量変更した保存キーは未チェック');
select update_planned_shopping(:'storage', :'today', :'today', 'today', 'dismiss', '{"category":"調味料(在庫確認)","name":"planned-v1:soy","position":0}');
select pg_temp.check_true((select dismissed from shopping_items where name = 'planned-v1:soy'), '在庫のある調味料を非表示');
select update_planned_shopping(:'storage', :'today', :'today', 'today', 'restore');
select pg_temp.check_true((select not dismissed from shopping_items where name = 'planned-v1:soy'), '非表示を解除できる');
select update_planned_shopping(:'storage', :'today', :'today', 'today', 'period', jsonb_build_object('mode','custom','start',:'today','end',:'custom_end'));
select pg_temp.check_true((select shopping_range_start = :'today'::date and shopping_range_end = :'custom_end'::date from household_settings where household_id = :'home'), '14日間の指定を保存');
-- 開始日が同じでも終了日やモードが古ければ、数量の異なる期間に保存しない。
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L)', :'storage', :'today', :'today', 'custom', 'restore'), 'shopping_period_changed');
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L)', :'storage', :'today', :'custom_end', 'today', 'restore'), 'shopping_period_changed');
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L,%L)', :'storage', :'today', :'custom_end', 'custom', 'period', jsonb_build_object('mode','custom','start',:'custom_end','end',:'today')), 'invalid_shopping_range');
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L,%L)', :'storage', :'today', :'custom_end', 'custom', 'period', '{"mode":"custom","start":"2026-02-31","end":"2026-03-01"}'), 'invalid_shopping_range');
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L,%L)', :'storage', :'today', :'custom_end', 'custom', 'period', '{"mode":"custom","start":"2026-01-01","end":"2027-01-02"}'), 'invalid_shopping_range');
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L,%L)', :'storage', :'today', :'custom_end', 'custom', 'period', '{"mode":"custom"}'), 'invalid_shopping_range');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000023', false);
select pg_temp.check_true((select shopping_period_mode = 'custom' and shopping_range_start = :'today'::date and shopping_range_end = :'custom_end'::date from household_settings where household_id = :'home'), '家族から同じ指定期間が見える');
select update_planned_shopping(:'storage', :'today', :'custom_end', 'custom', 'check', jsonb_build_object('source','manual','id',:'old_manual','checked',true));
select pg_temp.check_true((select checked from shopping_items where id = :'old_manual'), '家族から手動品のチェックを共有');
select update_planned_shopping(:'storage', :'today', :'custom_end', 'custom', 'period', jsonb_build_object('mode','custom','start',:'today','end',:'today'));
select pg_temp.check_true((select shopping_range_start = shopping_range_end from household_settings where household_id = :'home'), '同日の期間指定も可能');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000022', false);
select pg_temp.check_true((select count(*) = 0 from shopping_lists where id = :'old_list'), '別家庭のリストは見えない');
select pg_temp.check_true((select count(*) = 0 from household_settings where household_id = :'home'), '別家庭の期間設定は見えない');
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L,%L)', :'storage', :'cycle', :'cycle_end', 'week', 'delete', jsonb_build_object('id',:'old_manual')), 'shopping_item_not_found');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000021', false);
select update_planned_shopping(:'storage', :'today', :'today', 'custom', 'period', '{"mode":"week"}');
select pg_temp.check_true((select shopping_period_mode = 'week' and shopping_range_start is null and shopping_range_end is null from household_settings where household_id = :'home'), '7日間に戻せる');
-- 設定の買い物日が変わった場合、古い開始日の保存を受け付けない。
reset role;
update household_settings set shopping_day = extract(dow from :'today'::date)::int where household_id = :'home';
set role authenticated;
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L)', :'storage', :'cycle', :'cycle_end', 'week', 'restore'), 'shopping_period_changed');
reset role;
select pg_temp.check_true((select count(*) >= 2 from realtime.test_broadcasts where event = 'PERIOD_CHANGED'), '期間変更を家族向けに通知');
set role anon;
select pg_temp.expect_error(format('select update_planned_shopping(%L,%L,%L,%L,%L)', :'storage', :'cycle', :'cycle_end', 'week', 'restore'), 'permission denied');
select pg_temp.expect_error(format('select complete_planned_shopping(%L,%L,%L,%L,%L,%L)', :'storage', :'cycle', :'cycle_end', 'week', '[]'::jsonb, array[]::uuid[]), 'permission denied');
