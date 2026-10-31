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
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000081','apple-owner@example.test'),
('10000000-0000-4000-8000-000000000082','apple-other@example.test');
select household_id as home from profiles where id='10000000-0000-4000-8000-000000000081' \gset
select household_id as other_home from profiles where id='10000000-0000-4000-8000-000000000082' \gset
update household_subscriptions set status='free',current_period_end=null where household_id=:'home';
insert into apple_purchase_accounts(token,user_id,household_id) values
('20000000-0000-4000-8000-000000000081','10000000-0000-4000-8000-000000000081',:'home'),
('20000000-0000-4000-8000-000000000082','10000000-0000-4000-8000-000000000082',:'other_home');
select jsonb_build_object('environment','Production','transaction_id','1001','original_transaction_id','1001',
'app_account_token','20000000-0000-4000-8000-000000000081','product_id','app.kyounogohan.mobile.family.monthly',
'plan_id','family_monthly','purchased_at',now(),'expires_at',now()+interval '1 day','signed_at',now(),
'revoked_at',null,'is_upgraded',false) as tx \gset
set role service_role;
select record_apple_transaction(:'tx'::jsonb);
select record_apple_transaction(:'tx'::jsonb);
select pg_temp.check_true((select count(*)=1 from apple_subscription_transactions),'購入再送の重複なし');
select pg_temp.check_true(household_has_active_subscription(:'home'),'Apple購入で家族プランが有効');
select pg_temp.check_true((select status='free' from household_subscriptions where household_id=:'home'),'Stripeを上書きしない');
select pg_temp.expect_error(format('select record_apple_transaction(%L)', :'tx'::jsonb || '{"app_account_token":"20000000-0000-4000-8000-000000000082"}'::jsonb),'purchase_owner_mismatch');
select pg_temp.expect_error(format('select record_apple_transaction(%L)', :'tx'::jsonb || '{"environment":"Sandbox"}'::jsonb),'sandbox_not_allowed');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000081',false);
select pg_temp.check_true((select provider='apple' from household_billing_access where household_id=:'home'),'本人にApple契約を表示');
select pg_temp.expect_error('select * from apple_purchase_accounts','permission denied');
select pg_temp.expect_error('select * from apple_subscription_transactions','permission denied');
select pg_temp.expect_error(format('select record_apple_transaction(%L)', :'tx'),'permission denied');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000082',false);
select pg_temp.check_true((select count(*)=0 from household_billing_access where household_id=:'home'),'他の家庭の契約を読めない');
reset role;
set role service_role;
select record_apple_transaction(:'tx'::jsonb || jsonb_build_object('revoked_at',now(),'signed_at',now()+interval '1 second'));
select pg_temp.check_true(not household_has_active_subscription(:'home'),'返金で権利を解除');
select record_apple_transaction(:'tx'::jsonb);
select pg_temp.check_true(not household_has_active_subscription(:'home'),'古い購入の再送で返金を取り消さない');
select record_apple_transaction(:'tx'::jsonb || jsonb_build_object('transaction_id','1002','expires_at',now()+interval '2 days','signed_at',now()+interval '2 seconds'));
select pg_temp.check_true(household_has_active_subscription(:'home'),'新たな更新で権利を反映');
select record_apple_transaction(:'tx'::jsonb || jsonb_build_object('transaction_id','1002','expires_at',now()-interval '1 second','signed_at',now()+interval '3 seconds'));
select pg_temp.check_true(not household_has_active_subscription(:'home'),'期限切れを反映');
reset role;
