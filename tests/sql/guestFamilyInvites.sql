\set owner '10000000-0000-4000-8000-000000000001'
\set outsider '10000000-0000-4000-8000-000000000002'
\set guest '10000000-0000-4000-8000-000000000003'
\set second_guest '10000000-0000-4000-8000-000000000004'
\set token '20000000-0000-4000-8000-000000000001'
\set pending_token '20000000-0000-4000-8000-000000000002'
\set expired_token '20000000-0000-4000-8000-000000000003'
\set invite_id '30000000-0000-4000-8000-000000000001'
\set pending_id '30000000-0000-4000-8000-000000000002'

create function pg_temp.check_true(value boolean, label text) returns void language plpgsql as $$
begin
  if value is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected in sqlerrm) = 0 then raise; end if;
    raise notice 'PASS: rejected %', expected;
    return;
  end;
  raise exception 'FAIL: expected rejection %', expected;
end;
$$;

insert into auth.users (id, email) values (:'owner', 'owner@example.test'), (:'outsider', 'other@example.test');
select household_id as owner_home from profiles where id = :'owner' \gset
select household_id as other_home from profiles where id = :'outsider' \gset
update household_subscriptions set status = 'active' where household_id = :'owner_home';

set role authenticated;
select set_config('request.jwt.claim.sub', :'owner', false);
insert into household_invites (id, household_id, created_by, invite_token) values
  (:'invite_id', :'owner_home', :'owner', :'token'), (:'pending_id', :'owner_home', :'owner', :'pending_token');
insert into household_invites (household_id, created_by, invite_token, expires_at)
values (:'owner_home', :'owner', :'expired_token', now() - interval '1 day');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check_true((select count(*) = 1 from get_household_invite(:'token')), '未ログインでも招待を確認できる');
select pg_temp.check_true((select count(*) = 0 from get_household_invite(:'expired_token')), '期限切れの招待は見えない');
reset role;

select pg_temp.expect_error(format('insert into auth.users (id, is_anonymous) values (%L, true)', :'second_guest'), 'valid family invite required');
select pg_temp.expect_error(format('insert into auth.users (id, is_anonymous, raw_user_meta_data) values (%L, true, %L)', :'second_guest', jsonb_build_object('family_invite_token', :'expired_token')), 'invite is invalid or expired');
insert into auth.users (id, is_anonymous, raw_user_meta_data)
values (:'guest', true, jsonb_build_object('family_invite_token', :'token'));
select pg_temp.check_true((select household_id = :'owner_home' from profiles where id = :'guest'), '匿名ユーザーの作成と参加を同時に確定');
select pg_temp.check_true((select count(*) = 2 from households), '匿名参加で不要な家族グループを作らない');
select pg_temp.check_true((select count(*) = 0 from monitor_trial_claims), '匿名参加でモニター枠を消費しない');
select pg_temp.expect_error(format('insert into auth.users (id, is_anonymous, raw_user_meta_data) values (%L, true, %L)', :'second_guest', jsonb_build_object('family_invite_token', :'token')), 'invite is invalid or expired');
select pg_temp.check_true((select count(*) = 0 from auth.users where id = :'second_guest'), '使い回し失敗時はユーザー作成もロールバック');

insert into shopping_lists (household_id, week_start) values (:'owner_home', current_date) returning id as list_id \gset
insert into shopping_items (list_id, name, source) values (:'list_id', '共有する牛乳', 'manual') returning id as item_id \gset
insert into recipes (household_id, name) values (:'owner_home', '家族のレシピ') returning id as recipe_id \gset
insert into recipe_steps (recipe_id, phase, position, text) values (:'recipe_id', 'evening', 0, '混ぜる') returning id as step_id \gset
insert into plan_entries (household_id, date, meal_type, recipe_id) values (:'owner_home', current_date, 'dinner', :'recipe_id') returning id as plan_id \gset
insert into task_states (plan_entry_id, step_id, checked) values (:'plan_id', :'step_id', false);
insert into realtime.messages values ('broadcast');

set role authenticated;
select set_config('request.jwt.claim.sub', :'guest', false);
select set_config('request.jwt.claim.is_anonymous', 'true', false);
select pg_temp.check_true(accept_household_invite(:'token') = :'owner_home', '成功後の再試行は同じ参加として扱う');
select pg_temp.check_true((select count(*) = 1 from get_household_invite(:'token')), '参加した端末では使用済みリンクを再表示できる');
select pg_temp.check_true((select count(*) = 1 from shopping_items where id = :'item_id'), '参加者は家族の買い物を読める');
select pg_temp.check_true((select count(*) = 0 from household_settings where household_id = :'other_home'), '別の家族の設定は読めない');
select pg_temp.check_true((select count(*) = 0 from household_invites), '匿名参加者は未使用の招待を取得できない');
select pg_temp.expect_error(format('insert into household_invites (household_id, created_by) values (%L, %L)', :'owner_home', :'guest'), 'row-level security');
select pg_temp.expect_error(format('select revoke_household_invite(%L)', :'invite_id'), 'registered account required');
select pg_temp.expect_error(format('select join_household_invite(%L, %L)', :'outsider', :'pending_token'), 'permission denied');
select pg_temp.expect_error(format('update profiles set household_id = %L where id = %L', :'other_home', :'guest'), 'household_id cannot be changed directly');
select set_config('realtime.topic', 'shopping-list:' || :'list_id' || ':member:' || :'guest', false);
select pg_temp.check_true((select count(*) = 1 from realtime.messages), '自分用の家族通知を購読できる');
select set_config('realtime.topic', 'shopping-list:' || :'list_id' || ':member:' || :'owner', false);
select pg_temp.check_true((select count(*) = 0 from realtime.messages), '他の参加者用の通知を購読できない');
select pg_temp.check_true(set_manual_shopping_item_checked(:'item_id', true), '匿名参加者が買い物を更新できる');
select pg_temp.check_true(set_task_checked(:'plan_id', :'step_id', true), '匿名参加者がタスクを更新できる');
reset role;

select pg_temp.check_true((select count(*) > 0 from realtime.test_broadcasts where topic like '%:member:' || :'guest'), '参加中は本人宛に更新通知を送る');
select pg_temp.check_true((select count(*) = 0 from realtime.test_broadcasts where topic not like '%:member:%'), '全員共通の旧チャンネルへ内容を送らない');

set role authenticated;
select set_config('request.jwt.claim.sub', :'outsider', false);
select set_config('request.jwt.claim.is_anonymous', 'false', false);
select pg_temp.expect_error(format('select revoke_household_invite(%L)', :'invite_id'), 'invite not found');
select pg_temp.check_true((select count(*) = 0 from shopping_items where id = :'item_id'), '招待されていない登録ユーザーは家族データを読めない');
select pg_temp.expect_error(format('insert into household_invites (household_id, created_by) values (%L, %L)', :'other_home', :'outsider'), 'row-level security');
select set_config('request.jwt.claim.sub', :'owner', false);
select revoke_household_invite(:'invite_id');
select revoke_household_invite(:'invite_id');
select pg_temp.check_true((select count(*) = 1 from shopping_items where id = :'item_id'), '共有解除しても家族の買い物を保持');
select revoke_household_invite(:'pending_id');
select pg_temp.check_true((select count(*) = 0 from get_household_invite(:'pending_token')), '未使用リンクも無効化できる');
reset role;
select pg_temp.check_true((select count(*) = 3 from households), '共有解除は対象者用の空グループを1つだけ作成');
select pg_temp.check_true((select count(*) = 1 from auth.users where id = :'guest'), '共有解除でアカウントを削除しない');

truncate realtime.test_broadcasts;
update shopping_items set checked = false where id = :'item_id';
update task_states set checked = false where plan_entry_id = :'plan_id';
select pg_temp.check_true((select count(*) = 0 from realtime.test_broadcasts where topic like '%:member:' || :'guest'), '解除後は古い接続先にも更新内容を送らない');
select pg_temp.check_true((select count(*) = 2 from realtime.test_broadcasts where topic like '%:member:' || :'owner'), '解除後も残った家族へ買い物とタスクを通知');

set role authenticated;
select set_config('request.jwt.claim.sub', :'guest', false);
select set_config('request.jwt.claim.is_anonymous', 'true', false);
select pg_temp.check_true((select count(*) = 0 from shopping_items where id = :'item_id'), '既存セッションでも解除後の買い物は読めない');
select pg_temp.check_true((select count(*) = 0 from task_states where plan_entry_id = :'plan_id'), '既存セッションでも解除後のタスクは読めない');
select pg_temp.expect_error(format('select set_manual_shopping_item_checked(%L, true)', :'item_id'), 'shopping_item_not_found');
select pg_temp.expect_error(format('select set_task_checked(%L, %L, true)', :'plan_id', :'step_id'), 'task_not_found');
select pg_temp.expect_error(format('select accept_household_invite(%L)', :'token'), 'invite is invalid or revoked');
select set_config('realtime.topic', 'shopping-list:' || :'list_id' || ':member:' || :'guest', false);
select pg_temp.check_true((select count(*) = 0 from realtime.messages), '解除後は通知の新規購読も拒否');
reset role;

-- 登録済みユーザーの既存データと通常の参加フローも維持する。
set role authenticated;
select set_config('request.jwt.claim.sub', :'owner', false);
select set_config('request.jwt.claim.is_anonymous', 'false', false);
insert into household_invites (household_id, created_by) values (:'owner_home', :'owner') returning invite_token as registered_token, id as registered_invite \gset
select set_config('request.jwt.claim.sub', :'outsider', false);
select pg_temp.check_true(accept_household_invite(:'registered_token') = :'owner_home', '登録済みアカウントも参加できる');
reset role;
select pg_temp.check_true((select count(*) = 1 from households where id = :'other_home'), '登録済みアカウントの元の家族は削除しない');
select pg_temp.check_true((select count(*) = 0 from get_monitor_campaign_status() where claimed <> 0), '登録済みの通常参加もモニター枠を変更しない');

-- 発行後の家族プラン終了も、匿名ユーザー作成時に再確認する。
insert into household_invites (household_id, created_by)
values (:'owner_home', :'owner') returning invite_token as unpaid_token \gset
update household_subscriptions set status = 'free' where household_id = :'owner_home';
select pg_temp.expect_error(format('insert into auth.users (id, is_anonymous, raw_user_meta_data) values (%L, true, %L)', :'second_guest', jsonb_build_object('family_invite_token', :'unpaid_token')), 'family subscription required');
select pg_temp.check_true((select count(*) = 0 from get_household_invite(:'unpaid_token')), '家族プラン終了後は未使用リンクを表示しない');
update household_subscriptions set status = 'active' where household_id = :'owner_home';
select pg_temp.expect_error(format('insert into auth.users (id, is_anonymous, raw_user_meta_data) values (%L, true, %L)', :'second_guest', jsonb_build_object('family_invite_token', :'pending_token')), 'invite is invalid or revoked');
