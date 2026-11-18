\set ON_ERROR_STOP on
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000071','source-owner@example.test'),
('10000000-0000-4000-8000-000000000072','source-family@example.test'),
('10000000-0000-4000-8000-000000000073','source-other@example.test');
select set_config('app.allow_household_transfer','on',false);
update public.profiles set household_id=(select household_id from public.profiles where id='10000000-0000-4000-8000-000000000071') where id='10000000-0000-4000-8000-000000000072';
select set_config('app.allow_household_transfer','off',false);
insert into public.recipes(id,household_id,name,category,meta) values
('20000000-0000-4000-8000-000000000071',(select household_id from public.profiles where id='10000000-0000-4000-8000-000000000071'),'自分の料理','main','{}'),
('20000000-0000-4000-8000-000000000072',null,'共有の料理','main','{}'),
('20000000-0000-4000-8000-000000000073',null,'保留中の料理','main','{}');
insert into public.recipe_content_holds(recipe_id,household_id,recipe_name,review_key) values ('20000000-0000-4000-8000-000000000073',null,'保留中の料理','source-test');

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',false);
do $$ begin
  begin
    perform public.save_recipe_source_permission('20000000-0000-4000-8000-000000000071','{}','{}');
    raise exception 'unset owner accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.recipe_permission_owner(user_id) values (auth.uid());
    raise exception 'self promotion accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.recipe_permission_owner(user_id) values ('10000000-0000-4000-8000-000000000071');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',false);
select public.save_recipe_source_permission(id,
  '{"provider_name":"YouTube","author_name":"作者A","source_url":"https://youtu.be/test","video_start_seconds":90}',
  '{"status":"requested","allowed_scope":"","checked_on":null,"evidence":"非公開の依頼記録"}')
from (values ('20000000-0000-4000-8000-000000000071'::uuid),('20000000-0000-4000-8000-000000000072'::uuid),('20000000-0000-4000-8000-000000000073'::uuid)) as ids(id);
do $$ begin
  if (select count(*) from public.recipe_source_permissions) <> 3 then raise exception 'owner cannot read records'; end if;
  if (select count(*) from public.recipe_sources) <> 3 then raise exception 'owner cannot read held source'; end if;
  begin
    perform public.save_recipe_source_permission('20000000-0000-4000-8000-000000000071',
      '{"provider_name":"rollback","author_name":"","source_url":"","video_start_seconds":null}',
      '{"status":"approved","allowed_scope":"","checked_on":null,"evidence":""}');
    raise exception 'approved without evidence accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.recipe_sources where provider_name='rollback') then raise exception 'partial save'; end if;
end $$;
select public.save_recipe_source_permission('20000000-0000-4000-8000-000000000073',
  '{"provider_name":"YouTube","author_name":"作者A","source_url":"https://youtu.be/test","video_start_seconds":90}',
  '{"status":"approved","allowed_scope":"材料のみ","checked_on":"2026-11-17","evidence":"承諾の返信を記録"}');
do $$ begin
  if not exists(select 1 from public.recipe_content_holds where recipe_id='20000000-0000-4000-8000-000000000073') then raise exception 'approval published content'; end if;
end $$;
-- 同じ家族も一般ユーザー。出典のみ読め、承諾記録は取得・更新できない。
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000072',false);
do $$ begin
  if exists(select 1 from public.recipe_source_permissions) then raise exception 'family sees permissions'; end if;
  if exists(select 1 from public.recipe_permission_owner) then raise exception 'owner identity leaked'; end if;
  if (select count(*) from public.recipe_sources) <> 2 then raise exception 'public attribution visibility incorrect'; end if;
  update public.recipe_source_permissions set evidence='改ざん';
  if found then raise exception 'family updated permissions'; end if;
  update public.recipe_sources set author_name='改ざん';
  if found then raise exception 'family updated sources'; end if;
  begin
    insert into public.recipe_source_permissions(recipe_id) values ('20000000-0000-4000-8000-000000000074');
    raise exception 'family inserted permissions';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_recipe_source_permission('20000000-0000-4000-8000-000000000071','{}','{}');
    raise exception 'family invoked save';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000073',false);
do $$ begin
  if exists(select 1 from public.recipe_source_permissions) then raise exception 'other family sees permissions'; end if;
  if (select count(*) from public.recipe_sources) <> 1 then raise exception 'other household or held source leaked'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform * from public.recipe_source_permissions; raise exception 'anon reads permissions'; exception when insufficient_privilege then null; end;
  begin perform public.save_recipe_source_permission('20000000-0000-4000-8000-000000000071','{}','{}'); raise exception 'anon invokes save'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.recipe_sources where recipe_id='20000000-0000-4000-8000-000000000071') then raise exception 'anon sees private source'; end if;
end $$;
reset role;
-- 権限取り消し後は同じ認証セッションでも取得・保存を拒否する。
delete from public.recipe_permission_owner;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',false);
do $$ begin
  if exists(select 1 from public.recipe_source_permissions) then raise exception 'revoked owner reads permissions'; end if;
  begin perform public.save_recipe_source_permission('20000000-0000-4000-8000-000000000071','{}','{}'); raise exception 'revoked owner saves'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select '管理者・家族・別家庭・匿名・直接API・権限取消・原子保存・公開状態維持: 成功' as result;
-- 管理者設定用スクリプトも、架空の認証済みアカウントで確認する。
alter table auth.users add column email_confirmed_at timestamptz;
update auth.users set email_confirmed_at=now() where id in ('10000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000073');
\set owner_email 'source-owner@example.test'
\ir ../../scripts/configure-recipe-permission-owner.sql
\ir ../../scripts/configure-recipe-permission-owner.sql
do $$ begin
  if (select user_id from public.recipe_permission_owner) <> '10000000-0000-4000-8000-000000000071'::uuid then raise exception 'configured wrong owner'; end if;
end $$;
