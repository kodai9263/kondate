create function pg_temp.check_true(value boolean, label text) returns void language plpgsql as $$
begin if value is not true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000091','deletion-owner@example.test'),
('10000000-0000-4000-8000-000000000092','deletion-member@example.test');
select household_id as home from profiles where id='10000000-0000-4000-8000-000000000091' \gset
set local app.allow_household_transfer='on';
update profiles set household_id=:'home' where id='10000000-0000-4000-8000-000000000092';
insert into apple_purchase_accounts(token,user_id,household_id) values
('20000000-0000-4000-8000-000000000091','10000000-0000-4000-8000-000000000091',:'home');
select jsonb_build_object('environment','Production','transaction_id','delete-test','original_transaction_id','delete-test',
'app_account_token','20000000-0000-4000-8000-000000000091','product_id','app.kyounogohan.mobile.family.monthly',
'plan_id','family_monthly','purchased_at',now(),'expires_at',now()+interval '1 day','signed_at',now(),'is_upgraded',false) as tx \gset
select record_apple_transaction(:'tx');
insert into storage.objects(id,bucket_id,name,owner_id) values
('30000000-0000-4000-8000-000000000091','recipe-images',:'home'||'/own.jpg','10000000-0000-4000-8000-000000000091'),
('30000000-0000-4000-8000-000000000092','recipe-images',:'home'||'/family.jpg','10000000-0000-4000-8000-000000000092');
select request_id as receipt from begin_account_deletion('10000000-0000-4000-8000-000000000091') \gset
select pg_temp.check_true((select count(*)=1 from profiles where household_id=:'home'),'家族のプロフィールを残す');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000091',true);
select pg_temp.check_true(public.current_household_id() is null,'旧トークンから家族を参照できない');
select pg_temp.check_true((select count(*)=1 from households where id=:'home'),'共有家族を残す');
select pg_temp.check_true((select jsonb_array_length(storage_objects)=1 from account_deletion_requests where id=:'receipt'),'本人の写真だけを削除対象にする');
select pg_temp.check_true((select user_id is null and household_id is null and deleted_at is not null from apple_purchase_accounts where token='20000000-0000-4000-8000-000000000091'),'購入者を切り離す');
select record_apple_transaction(:'tx');
select pg_temp.check_true((select count(*)=0 from apple_subscription_transactions where transaction_id='delete-test'),'遅延通知で復活しない');
select pg_temp.check_true((select request_id=:'receipt' from begin_account_deletion('10000000-0000-4000-8000-000000000091')),'再受付は同じ受付番号');
-- Storage APIによる削除とAuthサービスによる削除だけを隔離fixtureで代替する。
delete from storage.objects where owner_id='10000000-0000-4000-8000-000000000091';
select finish_account_deletion_data(:'receipt');
delete from auth.users where id='10000000-0000-4000-8000-000000000091';
select complete_account_deletion(:'receipt');
select pg_temp.check_true((select status='completed' and storage_objects='[]'::jsonb from account_deletion_requests where id=:'receipt'),'共有家族からの退会完了');
select request_id as last_receipt from begin_account_deletion('10000000-0000-4000-8000-000000000092') \gset
select pg_temp.check_true((select last_member from account_deletion_requests where id=:'last_receipt'),'最後の一人を判定');
delete from storage.objects where owner_id='10000000-0000-4000-8000-000000000092';
select finish_account_deletion_data(:'last_receipt');
delete from auth.users where id='10000000-0000-4000-8000-000000000092';
select complete_account_deletion(:'last_receipt');
select pg_temp.check_true((select count(*)=0 from households where id=:'home'),'最後の家族データを削除');
select pg_temp.check_true(not has_function_privilege('authenticated','public.begin_account_deletion(uuid)','execute'),'利用者から特権関数を直接呼べない');
select pg_temp.check_true(not has_table_privilege('authenticated','public.account_deletion_requests','select'),'他人の受付を参照できない');
