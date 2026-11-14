\set ON_ERROR_STOP on
-- 本番と同じIDの標準と、同じ料理名・カタログキーの家庭内料理を用意する。
insert into public.recipes(id,household_id,name,category,meta) values
('29f4921e-fc77-4bbe-b595-3a704ba17c2e',null,'検証用の標準料理','main','{"nutrition_catalog_id":"salmon"}'),
('20000000-0000-4000-8000-000000000044',(select household_id from public.profiles where id='10000000-0000-4000-8000-000000000041'),'検証用の標準料理','main','{"nutrition_catalog_id":"salmon"}') on conflict(id) do nothing;
insert into public.recipe_steps(recipe_id,phase,position,text) values ('29f4921e-fc77-4bbe-b595-3a704ba17c2e','evening',0,'保留する原本'),('20000000-0000-4000-8000-000000000044','evening',0,'家庭で登録した本文') on conflict(recipe_id,phase,position) do nothing;
insert into public.plan_entries(household_id,date,meal_type,recipe_id,servings) select household_id,'2026-11-14','dinner','29f4921e-fc77-4bbe-b595-3a704ba17c2e',4 from public.profiles where id='10000000-0000-4000-8000-000000000041';
begin;
create temporary table protected_snapshot as select 'recipes' as kind, to_jsonb(r) as item from public.recipes r where household_id is not null
union all select 'steps',to_jsonb(s) from public.recipe_steps s
union all select 'plans',to_jsonb(p) from public.plan_entries p
union all select 'sides',to_jsonb(s) from public.side_dishes s
union all select 'breakfast',to_jsonb(b) from public.household_breakfast_versions b;
\ir ../../supabase/migrations/20261114080216_review_standard_recipe_provenance.sql
do $$ begin
 if exists((select * from protected_snapshot) except (select 'recipes',to_jsonb(r) from public.recipes r where household_id is not null union all select 'steps',to_jsonb(s) from public.recipe_steps s union all select 'plans',to_jsonb(p) from public.plan_entries p union all select 'sides',to_jsonb(s) from public.side_dishes s union all select 'breakfast',to_jsonb(b) from public.household_breakfast_versions b)) then raise exception 'preserved data changed'; end if;
 if exists(select 1 from public.recipe_content_holds where recipe_id='20000000-0000-4000-8000-000000000044') then raise exception 'household recipe held'; end if;
 if not exists(select 1 from public.recipe_content_holds where recipe_id='29f4921e-fc77-4bbe-b595-3a704ba17c2e') then raise exception 'standard not held'; end if;
 if (select count(*) from public.recipes where meta->>'nutrition_catalog_id' like 'reviewed-%' and household_id is null)<>12 then raise exception 'replacement missing'; end if;
end $$;
commit;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000041',false);
do $$ begin
 if exists(select 1 from public.recipes where id='29f4921e-fc77-4bbe-b595-3a704ba17c2e') then raise exception 'standard visible'; end if;
 if not exists(select 1 from public.recipes where id='20000000-0000-4000-8000-000000000044') then raise exception 'own recipe lost'; end if;
 if not exists(select 1 from public.plan_entries where recipe_id='29f4921e-fc77-4bbe-b595-3a704ba17c2e') then raise exception 'saved reference lost'; end if;
end $$;
reset role;
select '標準の非表示、新規12件、家庭内の料理・工程・副菜・朝食・献立の保持、再実行: 成功' as result;
