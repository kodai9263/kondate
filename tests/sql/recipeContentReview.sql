\set ON_ERROR_STOP on
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000041','review-one@example.test'),('10000000-0000-4000-8000-000000000042','review-two@example.test');
insert into public.recipes(id,household_id,name,category,meta) values
('20000000-0000-4000-8000-000000000041',(select household_id from public.profiles where id='10000000-0000-4000-8000-000000000041'),'確認待ちの料理','main','{}'),
('20000000-0000-4000-8000-000000000042',null,'確認待ちの共有料理','main','{}');
insert into public.recipe_steps(recipe_id,phase,position,text) values ('20000000-0000-4000-8000-000000000041','evening',0,'非配信本文'),('20000000-0000-4000-8000-000000000042','evening',0,'非配信共有本文');
insert into public.plan_entries(household_id,date,meal_type,recipe_id,servings) select household_id,'2026-11-08','dinner',id,4 from public.recipes where id='20000000-0000-4000-8000-000000000041';
insert into public.recipe_content_holds(recipe_id,household_id,recipe_name,review_key) select id,household_id,name,'test' from public.recipes where id in ('20000000-0000-4000-8000-000000000041','20000000-0000-4000-8000-000000000042');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000041',false);
do $$ begin
 if exists(select 1 from public.recipes where id in ('20000000-0000-4000-8000-000000000041','20000000-0000-4000-8000-000000000042')) then raise exception 'held recipe visible';end if;
 if exists(select 1 from public.recipe_steps where recipe_id in ('20000000-0000-4000-8000-000000000041','20000000-0000-4000-8000-000000000042')) then raise exception 'held steps visible';end if;
 if not exists(select 1 from public.plan_entries where recipe_id='20000000-0000-4000-8000-000000000041') then raise exception 'saved plan lost';end if;
 if (select count(*) from public.recipe_content_holds where review_key='test')<>2 then raise exception 'own hold unavailable';end if;
 if exists(select 1 from public.v_daily_plan where recipe_name='確認待ちの料理') then raise exception 'view leaked';end if;
 begin perform public.household_recipe_editor('20000000-0000-4000-8000-000000000041');raise exception 'editor leaked';exception when others then if sqlerrm<>'recipe_not_found' then raise;end if;end;
 begin perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000041',gen_random_uuid(),null,'{}');raise exception 'editor bypassed';exception when others then if sqlerrm<>'recipe_not_found' then raise;end if;end;
 begin perform public.save_recipe_step_customization('20000000-0000-4000-8000-000000000042','','new');raise exception 'copy bypassed';exception when others then if sqlerrm<>'recipe_not_found' then raise;end if;end;
 begin perform public.reset_recipe_step_customization('20000000-0000-4000-8000-000000000042');raise exception 'reset bypassed';exception when others then if sqlerrm<>'recipe_not_found' then raise;end if;end;
 begin delete from public.recipe_content_holds where review_key='test';raise exception 'hold changed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000042',false);
do $$ begin if (select count(*) from public.recipe_content_holds where review_key='test')<>1 then raise exception 'other family hold leaked';end if;end $$;
reset role;
set role anon;
do $$ begin if exists(select 1 from public.recipe_steps where recipe_id='20000000-0000-4000-8000-000000000042') then raise exception 'anonymous steps leaked';end if;end $$;
reset role;
do $$ begin
 if (select count(*) from public.recipe_steps where text like '非配信%')<>2 then raise exception 'original lost';end if;
 if (select count(*) from public.plan_entries where recipe_id='20000000-0000-4000-8000-000000000041')<>1 then raise exception 'original plan lost';end if;
end $$;
select '原本・予定の保持、本文・子テーブル・ビュー・編集RPC・別家族・匿名の制限: 成功' as result;
