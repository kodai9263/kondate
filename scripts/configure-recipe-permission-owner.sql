-- 本番への適用は別途承認後。psql -v owner_email=指定メール -f ... で実行する。
-- 登録済みの管理者を上書きしない。認証済みメールに対応する一人を指定する。
\set ON_ERROR_STOP on
begin;
select set_config('app.recipe_permission_owner_email', :'owner_email', true) is not null as target_set;
do $$
declare target_user uuid;
begin
  if (select count(*) from auth.users where lower(email)=lower(current_setting('app.recipe_permission_owner_email')) and email_confirmed_at is not null and not coalesce(is_anonymous,false)) <> 1 then
    raise exception '確認済みメールのアカウントを一意に特定できません。';
  end if;
  select id into target_user from auth.users where lower(email)=lower(current_setting('app.recipe_permission_owner_email')) and email_confirmed_at is not null and not coalesce(is_anonymous,false);
  if exists(select 1 from public.recipe_permission_owner where user_id <> target_user) then
    raise exception '別の管理者が登録されています。変更は個別に確認してください。';
  end if;
  insert into public.recipe_permission_owner(user_id) values(target_user) on conflict do nothing;
end $$;
commit;
